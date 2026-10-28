/** The app's only path to the sandbox runner: loopback + token, never the
 *  browser. GET reports availability so the card is honest before Run. */
import { readFileSync } from "node:fs";
import {
	RUNNER_LANGUAGES,
	REMOTE_LANGUAGES,
	KOTLIN_CHECK_FILE,
	buildKotlinCheckFile,
	kotlinCheckFileBroken,
	parseRemoteKotlinChecks,
	parseRemoteKotlinRun,
	remoteLanguageFor,
	runnerLanguageFor,
	type RemoteCheck,
	type RemoteKotlinResponse,
	type RemoteKotlinTestResponse,
} from "@/src/core";

export const dynamic = "force-dynamic";

const RUNNER_URL = process.env.LH_RUNNER_URL ?? "http://127.0.0.1:3212";
const RUNNER_ENABLED = process.env.LH_RUNNER_ENABLED !== "0";
/** Each run may take 200% CPU; the box also serves the app, so cap in-flight
 *  sandbox jobs rather than letting a Run-spamming tab starve everything. */
const MAX_CONCURRENT = Number(process.env.LH_RUNNER_MAX_CONCURRENT ?? 2);
let inFlight = 0;

/** Read once at module load: a computed path in readFileSync makes the bundler
 *  trace the whole project (Turbopack warns), and the token does not rotate. */
const RUNNER_TOKEN = (() => {
	if (process.env.LH_RUNNER_TOKEN) return process.env.LH_RUNNER_TOKEN;
	try {
		return readFileSync("/etc/learnharness-runner/token", "utf8").trim();
	} catch {
		return "";
	}
})();

/** Remote compiler service (Kotlin). OFF unless LH_KOTLIN_URL is set:
 *  pointing it at the public endpoint sends the learner's code to a third
 *  party, which is a deployment decision and never a default. Point it at a
 *  self-hosted JetBrains/kotlin-compiler-server (Apache-2.0, same protocol) to
 *  keep the code on your own machines. */
const KOTLIN_URL = (process.env.LH_KOTLIN_URL ?? "").replace(/\/+$/, "");
/** Pinning is optional; unpinned follows the service's own latestStable so a
 *  deployment does not rot when a compiler version is retired. */
const KOTLIN_VERSION_PIN = process.env.LH_KOTLIN_VERSION;
const KOTLIN_VERSION_FALLBACK = "2.4.21";

interface RunnerHealth {
	languages: Array<{ id: string; label: string; available: boolean; version: string | null }>;
}

/** Availability flaps if every paint re-probes the runner; a short cache keeps
 *  the card's badge stable without hiding a real outage for long. */
let healthCache: { at: number; value: RunnerHealth | null } = { at: 0, value: null };
async function health(): Promise<RunnerHealth | null> {
	if (!RUNNER_ENABLED) return null;
	if (Date.now() - healthCache.at < 15_000) return healthCache.value;
	try {
		const res = await fetch(`${RUNNER_URL}/health`, { signal: AbortSignal.timeout(6000), cache: "no-store" });
		if (!res.ok) return null;
		const value = (await res.json()) as RunnerHealth;
		healthCache = { at: Date.now(), value };
		return value;
	} catch {
		healthCache = { at: Date.now(), value: null };
		return null;
	}
}

/** Reachability, not mere configuration: the card must never offer Run for a
 *  service that is down. Cached like the runner's health for the same reason. */
let kotlinCache: { at: number; value: { version: string } | null } = { at: 0, value: null };
async function kotlinHealth(): Promise<{ version: string } | null> {
	if (!KOTLIN_URL) return null;
	if (Date.now() - kotlinCache.at < 60_000) return kotlinCache.value;
	try {
		const res = await fetch(`${KOTLIN_URL}/versions`, { signal: AbortSignal.timeout(6000), cache: "no-store" });
		if (!res.ok) {
			kotlinCache = { at: Date.now(), value: null };
			return null;
		}
		const list = (await res.json()) as Array<{ version?: string; latestStable?: boolean }>;
		const stable = Array.isArray(list) ? list.find((v) => v?.latestStable)?.version : undefined;
		const value = { version: KOTLIN_VERSION_PIN ?? stable ?? KOTLIN_VERSION_FALLBACK };
		kotlinCache = { at: Date.now(), value };
		return value;
	} catch {
		kotlinCache = { at: Date.now(), value: null };
		return null;
	}
}

/** Does the sandbox actually serve this language right now? Only consulted
 *  when a remote fallback exists, so a runner-only deployment keeps its
 *  original behaviour (attempt, then report what happened). */
async function runnerSupports(runnerLanguage: string): Promise<boolean> {
	const h = await health();
	return (h?.languages ?? []).some((l) => l.id === runnerLanguage && l.available);
}

/** Normalised into the runner's own wire shape by parseRemoteKotlinRun, so the
 *  card has one result vocabulary.
 *
 *  Checks go through the service's JUnit endpoint rather than an appended
 *  harness: Kotlin has no runtime eval, but an expression over the learner's
 *  top-level declarations compiles against them from a second file. That
 *  endpoint runs the TESTS ONLY — it never calls main — so the program still
 *  has to run for stdout and the prediction. Both requests go out together:
 *  the cost is one round trip, not two. */
async function runRemoteKotlin(code: string, checks: RemoteCheck[]): Promise<Response> {
	const h = await kotlinHealth();
	if (!h) {
		return Response.json(
			{ error: "Kotlin compiler service unreachable.", code: "code_remote_unreachable" },
			{ status: 503 },
		);
	}
	// File.kt is the playground's own name; diagnostics come back keyed by it,
	// and a top-level main compiles to FileKt.
	const source = [{ name: "File.kt", text: code }];
	const post = (path: string, files: Array<{ name: string; text: string }>) =>
		fetch(`${KOTLIN_URL}/api/${h.version}/compiler/${path}`, {
			method: "POST",
			headers: { "content-type": "application/json", accept: "application/json" },
			body: JSON.stringify({ args: "", files }),
			signal: AbortSignal.timeout(60_000),
		});
	try {
		const [runRes, testRes] = await Promise.all([
			post("run", source),
			checks.length
				? post("test", [...source, { name: KOTLIN_CHECK_FILE, text: buildKotlinCheckFile(checks) }])
				: Promise.resolve(null),
		]);
		if (!runRes.ok) {
			return Response.json(
				{ error: `Kotlin compiler service error (${runRes.status}).`, code: "code_remote_error" },
				{ status: 502 },
			);
		}
		const mapped = parseRemoteKotlinRun((await runRes.json()) as RemoteKotlinResponse);
		let verdicts: Array<{ label: string; pass: boolean }> | undefined;
		let checksError: string | undefined;
		// Code that does not compile fails every check by definition; reporting
		// a wall of crosses on top of the compiler error teaches nothing.
		if (testRes?.ok && mapped.compile.ok) {
			const parsed = (await testRes.json()) as RemoteKotlinTestResponse;
			const broken = kotlinCheckFileBroken(parsed);
			// A check that will not compile is the author's mistake, not the
			// learner's: say so instead of marking their work wrong.
			if (broken) checksError = broken;
			else verdicts = parseRemoteKotlinChecks(parsed, checks);
		}
		return Response.json(
			{
				engine: "remote",
				language: "kotlin",
				version: h.version,
				...mapped,
				...(verdicts?.length ? { checks: verdicts } : {}),
				...(checksError ? { checksError } : {}),
			},
			{ headers: { "cache-control": "no-store" } },
		);
	} catch {
		return Response.json(
			{ error: "Kotlin compiler service unreachable.", code: "code_remote_unreachable" },
			{ status: 503 },
		);
	}
}

export async function GET() {
	const h = await health();
	const kotlin = await kotlinHealth();
	const available = new Set((h?.languages ?? []).filter((l) => l.available).map((l) => l.id));
	return Response.json(
		{
			runnerAvailable: available.size > 0,
			remoteAvailable: Boolean(kotlin),
			...(kotlin ? { remoteVersion: `Kotlin ${kotlin.version}` } : {}),
			// Kotlin is the only remote language today, so one reachability
			// answer covers the table; widen this when a second service lands.
			remoteLanguages: Object.fromEntries(Object.keys(REMOTE_LANGUAGES).map((id) => [id, Boolean(kotlin)])),
			versions: Object.fromEntries((h?.languages ?? []).map((l) => [l.id, l.version])),
			languages: Object.fromEntries(
				Object.entries(RUNNER_LANGUAGES).map(([canonical, runnerId]) => [canonical, available.has(runnerId)]),
			),
		},
		{ headers: { "cache-control": "no-store" } },
	);
}

export async function POST(req: Request) {
	let body: { language?: unknown; code?: unknown; stdin?: unknown; checks?: unknown };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return Response.json({ error: "invalid JSON" }, { status: 400 });
	}
	const language = typeof body.language === "string" ? body.language : "";
	const code = typeof body.code === "string" ? body.code : "";
	// Manifest ids only — never a client-supplied string.
	const runnerLanguage = runnerLanguageFor(language);
	const remoteLanguage = remoteLanguageFor(language);
	if (!runnerLanguage && !remoteLanguage) {
		return Response.json({ error: `not a runnable language: ${language}` }, { status: 400 });
	}
	if (!code.trim()) return Response.json({ error: "code required" }, { status: 400 });

	const busy = (message: string, code: string) =>
		inFlight >= MAX_CONCURRENT
			? Response.json({ error: message, code }, { status: 429, headers: { "retry-after": "2" } })
			: null;

	// Engine choice mirrors core's resolveEngine: the local sandbox first, a
	// remote service only as a fallback. With no LH_KOTLIN_URL this is false
	// and every line below is the original runner path.
	const authoredChecks: RemoteCheck[] = Array.isArray(body.checks)
		? (body.checks as RemoteCheck[])
				.slice(0, 12)
				.filter((c) => typeof c?.expr === "string" && c.expr.trim())
				.map((c) => ({ expr: c.expr, expect: String(c.expect ?? ""), label: String(c.label ?? c.expr) }))
		: [];

	const remoteCapable = Boolean(remoteLanguage) && Boolean(KOTLIN_URL);
	const useRemote =
		remoteCapable && !(RUNNER_ENABLED && runnerLanguage && (await runnerSupports(runnerLanguage)));

	if (useRemote) {
		// The work runs on someone else's machine, so this cap is outbound
		// politeness (and rate-limit insurance), not CPU protection.
		const wait = busy("The Kotlin compiler service is busy — try again in a moment.", "code_remote_busy");
		if (wait) return wait;
		inFlight += 1;
		try {
			return await runRemoteKotlin(code, authoredChecks);
		} finally {
			inFlight -= 1;
		}
	}
	if (!runnerLanguage) {
		return Response.json(
			{ error: "Kotlin compiler service is not configured or not reachable.", code: "code_remote_unreachable" },
			{ status: 503 },
		);
	}
	if (!RUNNER_ENABLED) {
		return Response.json(
			{ error: "Sandbox runner is disabled on this deployment.", code: "code_runner_not_configured" },
			{ status: 503 },
		);
	}

	const wait = busy("The sandbox is busy — try again in a moment.", "code_runner_busy");
	if (wait) return wait;
	inFlight += 1;
	try {
		const res = await fetch(`${RUNNER_URL}/execute`, {
			method: "POST",
			headers: { "content-type": "application/json", "x-lh-runner-token": RUNNER_TOKEN },
			body: JSON.stringify({
				language: runnerLanguage,
				code,
				stdin: body.stdin,
				checks: Array.isArray(body.checks) ? body.checks.slice(0, 12) : undefined,
			}),
			signal: AbortSignal.timeout(120_000),
		});
		if (res.status === 401) {
			return Response.json(
				{ error: "Sandbox runner rejected the app's token.", code: "code_runner_unauthorized" },
				{ status: 503 },
			);
		}
		if (!res.ok) {
			return Response.json(
				{ error: `Sandbox runner error (${res.status}).`, code: "code_runner_error" },
				{ status: 502 },
			);
		}
		return new Response(await res.text(), {
			status: 200,
			headers: { "content-type": "application/json", "cache-control": "no-store" },
		});
	} catch {
		return Response.json(
			{ error: "Sandbox runner unreachable.", code: "code_runner_unreachable" },
			{ status: 503 },
		);
	} finally {
		inFlight -= 1;
	}
}
