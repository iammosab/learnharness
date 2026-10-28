/**
 * code-playground — the tool contract and the pure engine registry.
 * Engines: native / pyodide / pglite in the browser, the sandbox runner for
 * compiled languages, or none — which must say so rather than fail.
 */
import { Type, type Static } from "typebox";

// ─── the tool contract ──────────────────────────────────────────────────────

/** A post-run assertion; compare as text so teachers need no type games. */
const checkProps = {
	expr: Type.String({ description: "Expression evaluated after the program runs, e.g. 'predict(150, 20, 3)'" }),
	expect: Type.String({ description: "Expected value as text, e.g. '470'" }),
	label: Type.Optional(Type.String({ description: "Short label shown next to the tick/cross" })),
};

export const CODE_PLAYGROUND_MODES = ["implement", "bug-hunt", "error-read", "syntax"] as const;
export type CodePlaygroundMode = (typeof CODE_PLAYGROUND_MODES)[number];

/** What each mode requires of the authored card. Pure, so the contract and the
 *  tests agree about what a valid card looks like. */
export function modeRequirements(mode: CodePlaygroundMode): {
	needsStarter: boolean;
	needsPair: boolean;
	needsErrorText: boolean;
	editable: boolean;
} {
	switch (mode) {
		case "bug-hunt":
			return { needsStarter: true, needsPair: false, needsErrorText: false, editable: true };
		case "error-read":
			return { needsStarter: true, needsPair: false, needsErrorText: true, editable: false };
		case "syntax":
			return { needsStarter: true, needsPair: true, needsErrorText: false, editable: false };
		default:
			return { needsStarter: true, needsPair: false, needsErrorText: false, editable: true };
	}
}

export const codePlaygroundInputObject = Type.Object(
	{
		mode: Type.Optional(
			Type.Union([Type.Literal("implement"), Type.Literal("bug-hunt"), Type.Literal("error-read"), Type.Literal("syntax")], {
				description:
					"implement (write it) | bug-hunt (compiles, behaviour is wrong — find the defect) | " +
					"error-read (no code to fix: interpret this error) | syntax (contrast a correct line with a broken twin)",
			}),
		),
		language: Type.String({
			description:
				"Language the lesson is actually using, free-form: 'c', 'cpp', 'rust', 'csharp', 'go', 'java', " +
				"'python', 'javascript', 'sql', … The card resolves it to an available engine and says so.",
		}),
		task: Type.String({
			description: "One sentence, imperative: what the learner must write or fix. No hints in it.",
		}),
		starter: Type.String({
			description:
				"Editable starting code. Should parse and run (or nearly) so the learner edits rather than starts from void.",
		}),
		checks: Type.Optional(Type.Array(Type.Object(checkProps), { description: "Optional post-run assertions." })),
		/** error-read: the compiler/runtime text the learner must interpret. */
		errorText: Type.Optional(Type.String({ description: "The error output to read (mode: error-read)." })),
		/** syntax: the broken twin of `starter`, for a contrast pair. */
		pair: Type.Optional(Type.String({ description: "The broken variant shown next to the starter (mode: syntax)." })),
		nodeId: Type.Optional(
			Type.String({ description: "Plan node this step belongs to (same convention as quiz)." }),
		),
	},
	{ additionalProperties: false },
);

export type CodePlaygroundInput = Static<typeof codePlaygroundInputObject>;

/** What the card sends back to the teacher as the learner's turn. */
/** Why a run failed — so the teacher picks the repair instead of parsing stderr.
 *  Engine-agnostic: every engine maps its own signal onto this. */
export type RunErrorKind = "none" | "syntax" | "runtime" | "timeout" | "checks" | "not-run";

export interface CodePlaygroundRun {
	ok: boolean;
	stdout?: string;
	stderr?: string;
	compileError?: string;
	timedOut?: boolean;
	errorKind: RunErrorKind;
	/** The learner's pre-run guess, when they gave one. */
	prediction?: string;
	/** Whether that guess matched what the program actually printed. */
	predictionMatch?: boolean;
	checks?: Array<{ label: string; pass: boolean }>;
}

export interface CodePlaygroundReport {
	language: string;
	engine: EngineKind;
	code: string;
	attempts: number;
	sentAt: string;
	runs: CodePlaygroundRun[];
}

// ─── engine registry (pure; the truth table the tests pin) ──────────────────

export type EngineKind = "native" | "pyodide" | "pglite" | "runner" | "remote" | "none";

export interface Engine {
	kind: EngineKind;
	/** Human label for the card's chip. */
	label: string;
	/** Runner manifest id when kind === "runner". */
	runnerLanguage?: string;
	/** Remote compiler-service id when kind === "remote". */
	remoteLanguage?: string;
	/** null when nothing can execute the language. */
	runnable: boolean;
	/** Stated reason when runnable === false. */
	reason?: string;
}

/** Aliases → canonical id. Keys are normalized (lowercase, no spaces/punct). */
const ALIASES: Record<string, string> = {
	js: "javascript",
	javascript: "javascript",
	node: "javascript",
	nodejs: "javascript",
	mjs: "javascript",
	ts: "typescript",
	typescript: "typescript",
	tsx: "typescript",
	jsx: "javascript",
	py: "python",
	python: "python",
	python3: "python",
	py3: "python",
	sql: "sql",
	sqlite: "sql",
	sqlite3: "sql",
	postgres: "sql",
	postgresql: "sql",
	psql: "sql",
	"c++": "cpp",
	cpp: "cpp",
	cxx: "cpp",
	cc: "cpp",
	c: "c",
	cs: "csharp",
	csharp: "csharp",
	"c#": "csharp",
	go: "go",
	golang: "go",
	java: "java",
	kotlin: "kotlin",
	kt: "kotlin",
	rust: "rust",
	rs: "rust",
	rb: "ruby",
	ruby: "ruby",
	php: "php",
	lua: "lua",
	pl: "perl",
	perl: "perl",
	bash: "bash",
	sh: "bash",
	shell: "bash",
	zsh: "bash",
	r: "r",
	octave: "octave",
	matlab: "octave",
	hs: "haskell",
	haskell: "haskell",
	lisp: "lisp",
	commonlisp: "lisp",
	sbcl: "lisp",
	f90: "fortran",
	fortran: "fortran",
	jl: "julia",
	julia: "julia",
	dart: "dart",
	swift: "swift",
	erlang: "erlang",
};

/** Browser-hosted engines the card can actually execute today. */
const BROWSER: Record<string, Engine> = {
	javascript: { kind: "native", label: "JavaScript", runnable: true },
	typescript: { kind: "native", label: "TypeScript", runnable: true },
};

/** Declared but NOT yet implemented in the card (WASM runtimes land later).
 *  These resolve to the sandbox runner when one is available — a language must
 *  never be advertised as runnable and then fail with "no engine". */
const BROWSER_PENDING = new Set(["python", "sql"]);

/** Canonical id → runner manifest id (mirrors runner/languages.json; a test
 *  asserts the two stay in sync). */
export const RUNNER_LANGUAGES: Record<string, string> = {
	python: "python",
	sql: "sql",
	c: "c",
	cpp: "cpp",
	rust: "rust",
	csharp: "csharp",
	go: "go",
	java: "java",
	kotlin: "kotlin",
	ruby: "ruby",
	php: "php",
	lua: "lua",
	perl: "perl",
	bash: "bash",
	r: "r",
	octave: "octave",
	haskell: "haskell",
	lisp: "lisp",
	fortran: "fortran",
	jl: "julia",
	julia: "julia",
	dart: "dart",
	swift: "swift",
	erlang: "erlang",
};

const RUNNER_LABELS: Record<string, string> = {
	c: "C",
	cpp: "C++",
	rust: "Rust",
	csharp: "C#",
	go: "Go",
	java: "Java",
	kotlin: "Kotlin",
	ruby: "Ruby",
	php: "PHP",
	lua: "Lua",
	perl: "Perl",
	bash: "Bash",
	r: "R",
	octave: "Octave",
	haskell: "Haskell",
	lisp: "Lisp",
	fortran: "Fortran",
	python: "Python",
	sql: "SQL",
	julia: "Julia",
	dart: "Dart",
	swift: "Swift",
	erlang: "Erlang",
};

/** Languages a remote compiler service can execute. Kotlin's playground API
 *  (JetBrains/kotlin-compiler-server, Apache-2.0) speaks one protocol whether
 *  it is the public endpoint or an instance you host, so one id covers both.
 *  A remote engine is always a FALLBACK: see resolveEngine's precedence. */
export const REMOTE_LANGUAGES: Record<string, string> = {
	kotlin: "kotlin",
};

/** The remote service's id for a declared language, or null. Canonicalises
 *  first, so "Kotlin", "kotlin" and "kt" all reach the same entry. */
export function remoteLanguageFor(language: string): string | null {
	return REMOTE_LANGUAGES[canonicalLanguage(language)] ?? null;
}

/** Real programming languages we do not run yet (Zig, Swift, …). A card for
 *  these is still legitimate: it edits, highlights and reports the code; Run is
 *  disabled with the reason. Anything outside this set and the registry —
 *  "spanish", "history", "cooking" — must not produce a card at all. */
const KNOWN_CODE_LANGUAGES = new Set([
	"zig", "swift", "scala", "elixir", "erlang", "clojure", "ocaml", "fsharp", "f#", "nim", "crystal",
	"groovy", "vb", "vbnet", "cobol", "pascal", "prolog", "scheme", "racket", "awk", "livescript",
	"reasonml", "solidity", "vhdl", "verilog", "assembly", "asm", "cuda", "glsl", "hlsl", "wgsl",
	// Markup and styling are code; data/document formats are not.
	"html", "css",
]);

/** True only for languages this registry knows how to treat AS CODE. The
 *  playground must never appear for prose subjects ("spanish", "history"). */
export function isCodingLanguage(language: string): boolean {
	if (typeof language !== "string" || !language.trim()) return false;
	const id = canonicalLanguage(language);
	return Boolean(BROWSER[id] || BROWSER_PENDING.has(id) || RUNNER_LANGUAGES[id] || ALIASES[id] || KNOWN_CODE_LANGUAGES.has(id));
}

/** Normalize a free-form language string the teacher wrote. */
export function canonicalLanguage(language: string): string {
	const n = language.toLowerCase().trim().replace(/[\s_.-]+/g, "");
	return ALIASES[n] ?? ALIASES[language.toLowerCase().trim()] ?? n;
}

/**
 * Resolve a declared language to an engine.
 *
 * `runnerAvailable` is the runtime truth the caller passes in (the app asks its
 * runner's /health once per request; tests pass it directly). A language whose
 * engine exists but whose runner is down resolves to `none` with an explicit
 * reason — the card must never claim it can run something it cannot.
 */
/** Does this language have an engine at all? `null` means no runtime exists in
 *  this deployment, so a card that needs to execute must not be authored. */
export function engineKindFor(language: string): "native" | "runner" | null {
	const id = canonicalLanguage(language);
	if (BROWSER[id]) return "native";
	return RUNNER_LANGUAGES[id] ? "runner" : null;
}

/** Modes that must execute the learner's code. error-read and syntax are
 *  read-only drills: they work for any language, running or not. */
export function modeNeedsExecution(mode: CodePlaygroundMode): boolean {
	return mode === "implement" || mode === "bug-hunt";
}

/** The runner's id for a declared language, or null when it is not runner-backed.
 *  Canonicalises first: a teacher writes "C++", "c++" or "cpp" and all three must
 *  reach the same manifest entry — the table is keyed by canonical ids only. */
export function runnerLanguageFor(language: string): string | null {
	return RUNNER_LANGUAGES[canonicalLanguage(language)] ?? null;
}

export function resolveEngine(
	language: string,
	runnerAvailable = false,
	runnerVersion?: string,
	remote?: { available: boolean; version?: string },
): Engine {
	const id = canonicalLanguage(language);
	const browser = BROWSER[id];
	if (browser) return browser;
	// python/sql fall through to the runner below rather than pretending.

	const runnerId = RUNNER_LANGUAGES[id];
	const remoteId = REMOTE_LANGUAGES[id];
	if (runnerId || remoteId) {
		const label = RUNNER_LABELS[id] ?? language;
		// The local sandbox wins whenever it can serve the language: the code
		// never leaves the host and stdin works there. A remote compiler
		// service is the fallback, never the preference.
		if (runnerId && runnerAvailable) {
			return {
				kind: "runner",
				label,
				runnerLanguage: runnerId,
				runnable: true,
				...(runnerVersion ? { reason: runnerVersion } : {}),
			};
		}
		if (remoteId && remote?.available) {
			return {
				kind: "remote",
				label,
				remoteLanguage: remoteId,
				runnable: true,
				...(remote.version ? { reason: remote.version } : {}),
			};
		}
		const how =
			runnerId && remoteId
				? `${label} runs in the sandbox runner or a remote compiler service; neither is configured or reachable.`
				: runnerId
					? `${label} runs in the sandbox runner, which is not configured or not reachable.`
					: `${label} runs in a remote compiler service, which is not configured.`;
		return { kind: "none", label, runnable: false, reason: `${how} Editing and feedback still work.` };
	}

	return {
		kind: "none",
		label: language.trim() || "unknown language",
		runnable: false,
		reason: `No engine for "${language.trim()}" in this deployment. You can still write it, get syntax feedback, and send it to the teacher.`,
	};
}

/** Compare a prediction with actual stdout without punishing formatting:
 *  numeric equality first, then whitespace/quote-normalised text. Pure. */
export function predictionMatches(prediction: string, stdout: string): boolean {
	const clean = (s: string) => s.trim().replace(/\s+/g, " ").replace(/^["']|["']$/g, "");
	const a = clean(prediction);
	const b = clean(stdout);
	if (!a) return false;
	if (a === b) return true;
	const na = Number(a);
	const nb = Number(b);
	return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

/** Classify a run from engine-independent facts. Pure. */
export function classifyRun(r: {
	compileOk?: boolean;
	timedOut?: boolean;
	exit?: number | null;
	checks?: Array<{ pass: boolean }>;
	errName?: string | null;
	ran?: boolean;
}): RunErrorKind {
	if (r.ran === false) return "not-run";
	if (r.compileOk === false) return "syntax";
	if (r.timedOut) return "timeout";
	if (r.errName === "SyntaxError") return "syntax";
	if (r.exit !== undefined && r.exit !== null && r.exit !== 0) return "runtime";
	if (r.checks?.some((c) => !c.pass)) return "checks";
	return "none";
}

/** Render the report the teacher sees. Pure so tests can pin the wording. */
export function formatReport(r: CodePlaygroundReport): string {
	const lines: string[] = [];
	lines.push(`Here is my code (${r.language}, engine: ${r.engine}) after ${r.attempts} attempt(s):`);
	lines.push("```" + r.language);
	lines.push(r.code.trimEnd());
	lines.push("```");
	const last = r.runs[r.runs.length - 1];
	if (!last || last.errorKind === "not-run") {
		lines.push("I did not run it before sending.");
		return lines.join("\n");
	}
	if (last.prediction !== undefined) {
		lines.push(
			`Before running I predicted: ${JSON.stringify(last.prediction)} — ` +
				(last.predictionMatch ? "that matched." : "it did not match what it printed."),
		);
	}
	lines.push(`Failure kind: ${last.errorKind}.`);
	if (last.compileError) lines.push(`It does not compile:\n${last.compileError.trim()}`);
	else if (last.timedOut) lines.push("It ran but timed out (infinite loop or too slow).");
	else {
		// Both streams, and not as alternatives: a program can print and THEN
		// throw. The sandbox runner merges them with 2>&1 so its stderr is
		// empty here, but engines that keep them apart (native, remote) carry
		// the exception text in stderr — without this the teacher is told only
		// "Failure kind: runtime" and cannot name the fault the learner saw.
		if (last.stdout) lines.push(`Output:\n${last.stdout.trim()}`);
		if (last.stderr) lines.push(`Error output:\n${last.stderr.trim()}`);
	}
	if (last.checks?.length) {
		lines.push("Checks:");
		for (const c of last.checks) lines.push(`- ${c.pass ? "PASS" : "FAIL"} ${c.label}`);
	}
	if (r.runs.length > 1) lines.push(`(I ran it ${r.runs.length} times; the last run is above.)`);
	return lines.join("\n");
}

// ─── remote Kotlin compiler service (pure wire mapping) ─────────────────────

/**
 * The compiler service's reply, as observed against
 * `api.kotlinlang.org/api/<version>/compiler/run` (2026-10-28) and the
 * self-hosted JetBrains/kotlin-compiler-server, which speak the same protocol.
 *
 * Every outcome — success, compile error, thrown exception, execution cap —
 * arrives as HTTP 200 with the verdict in the body, so the status line says
 * nothing and this mapping is the only thing that decides what happened.
 */
export interface RemoteKotlinResponse {
	/** Keyed by file name; holds ERRORs and WARNINGs together. */
	errors?: Record<
		string,
		Array<{
			message?: string;
			severity?: string;
			/** Zero-based line/column, unlike every compiler that prints text. */
			interval?: { start?: { line?: number; ch?: number } | null } | null;
		}> | null
	> | null;
	exception?: {
		message?: string | null;
		fullName?: string | null;
		stackTrace?: Array<{
			className?: string | null;
			methodName?: string | null;
			fileName?: string | null;
			lineNumber?: number | null;
		}> | null;
	} | null;
	/** Program output, wrapped in `<outStream>`/`<errStream>` pseudo-tags. */
	text?: string | null;
}

/** The sandbox runner's wire shape. The remote engine normalises into it so
 *  that ONE card branch and one `classifyRun` call serve both engines — a new
 *  engine must not grow a second result vocabulary. */
export interface SandboxRunBody {
	compile: { ok: boolean; stderr: string; exit: number | null };
	run: { stdout: string; stderr?: string; exit: number | null; timedOut: boolean };
}

/** The service's wording when it cuts an execution short. Matched loosely: it
 *  is prose, not a contract, and it has carried a stray glyph. */
export const REMOTE_TIMEOUT_MARKER = "taking too long";

/** `timeout(1)`'s exit code, which the sandbox runner reports for the same
 *  condition. Kept identical so neither engine is a special case downstream. */
const TIMEOUT_EXIT = 124;

const STREAM_SEGMENT = /<(outStream|errStream)>([\s\S]*?)<\/\1>/g;

/** Map one remote reply onto the runner's shape. Pure: the route does IO, this
 *  decides meaning, and the tests pin every branch. */
export function parseRemoteKotlinRun(raw: RemoteKotlinResponse): SandboxRunBody {
	// Only ERROR stops a compile; WARNINGs (deprecations, unused values) would
	// otherwise read to the learner as "your code is broken".
	const diagnostics = Object.entries(raw.errors ?? {}).flatMap(([file, list]) =>
		(list ?? [])
			.filter((d) => (d.severity ?? "").toUpperCase() === "ERROR")
			.map((d) => {
				const line = (d.interval?.start?.line ?? 0) + 1;
				const ch = (d.interval?.start?.ch ?? 0) + 1;
				return `${file}:${line}:${ch}: error: ${d.message ?? "error"}`;
			}),
	);
	if (diagnostics.length) {
		return {
			compile: { ok: false, stderr: diagnostics.join("\n"), exit: 1 },
			run: { stdout: "", exit: null, timedOut: false },
		};
	}

	let stdout = "";
	let stderr = "";
	for (const seg of (raw.text ?? "").matchAll(STREAM_SEGMENT)) {
		if (seg[1] === "outStream") stdout += seg[2];
		else stderr += seg[2];
	}

	// The cap is reported as prose on the error stream, never as an exception.
	if (stderr.includes(REMOTE_TIMEOUT_MARKER)) {
		return {
			compile: { ok: true, stderr: "", exit: 0 },
			run: { stdout, stderr: stderr.trim(), exit: TIMEOUT_EXIT, timedOut: true },
		};
	}

	if (raw.exception) {
		const head = [raw.exception.fullName, raw.exception.message].filter(Boolean).join(": ");
		// Keep only frames a learner can act on: no fileName means a JDK
		// internal, and a non-positive line is a synthetic frame the service
		// emits for the entry point.
		const frames = (raw.exception.stackTrace ?? [])
			.filter((f) => f?.fileName && (f.lineNumber ?? 0) > 0)
			.map((f) => `\tat ${f.className ?? "?"}.${f.methodName ?? "?"}(${f.fileName}:${f.lineNumber ?? "?"})`);
		return {
			compile: { ok: true, stderr: "", exit: 0 },
			run: {
				stdout,
				stderr: [head || "exception", ...frames].join("\n"),
				exit: 1,
				timedOut: false,
			},
		};
	}

	return {
		compile: { ok: true, stderr: "", exit: 0 },
		run: { stdout, ...(stderr.trim() ? { stderr: stderr.trim() } : {}), exit: 0, timedOut: false },
	};
}

// ─── remote Kotlin checks, via the JUnit endpoint ───────────────────────────

/** One authored check, as the tool contract carries it. */
export interface RemoteCheck {
	expr: string;
	expect: string;
	label: string;
}

/** `/compiler/test`'s reply: JUnit results keyed by class, plus the same
 *  per-file diagnostics `/compiler/run` returns. */
export interface RemoteKotlinTestResponse {
	testResults?: Record<
		string,
		Array<{
			methodName?: string | null;
			status?: string | null;
			output?: string | null;
			comparisonFailure?: { message?: string | null } | null;
			exception?: { message?: string | null; fullName?: string | null } | null;
		}> | null
	> | null;
	errors?: RemoteKotlinResponse["errors"];
}

/** The generated test class and its method prefix. Deterministic, because the
 *  verdicts come back keyed by method name in whatever order JUnit ran them. */
export const KOTLIN_CHECK_CLASS = "LhChecks";
export const KOTLIN_CHECK_FILE = "lh-checks.kt";
const checkMethod = (i: number) => `check${i}`;

/** Kotlin string literals interpolate `$`, so it escapes alongside the usual
 *  backslash, quote and newline. */
function kotlinLiteral(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$").replace(/\r?\n/g, "\\n");
}

/**
 * Compile the authored checks into a JUnit class.
 *
 * Kotlin has no runtime eval, so a check cannot be evaluated the way Python's
 * and Ruby's harnesses do. It does not need to be: an expression over the
 * learner's TOP-LEVEL declarations compiles against them from a second file,
 * and JUnit reports each one. Comparison stays textual, which is what the
 * contract promises ("compare as text so teachers need no type games").
 */
export function buildKotlinCheckFile(checks: RemoteCheck[]): string {
	const methods = checks.map((c, i) => {
		const expect = kotlinLiteral(c.expect);
		// Two-arg assertEquals on purpose: JUnit would otherwise echo the
		// message back inside comparisonFailure, and the card prepends the
		// label itself — the three-arg form reads as a stutter.
		// The expression is Kotlin source, not data — it is the authored check.
		return `\t@Test fun ${checkMethod(i)}() {\n\t\tAssert.assertEquals("${expect}", (${c.expr}).toString())\n\t}`;
	});
	return ["import org.junit.Assert", "import org.junit.Test", "", `class ${KOTLIN_CHECK_CLASS} {`, ...methods, "}", ""].join("\n");
}

/** Did the generated check file itself fail to compile? That is the author's
 *  mistake, never the learner's, and it must not be reported as "your code
 *  does not compile". */
export function kotlinCheckFileBroken(raw: RemoteKotlinTestResponse): string | null {
	const list = raw.errors?.[KOTLIN_CHECK_FILE] ?? null;
	const errs = (list ?? []).filter((d) => (d.severity ?? "").toUpperCase() === "ERROR");
	return errs.length ? errs.map((d) => d.message ?? "error").join("; ") : null;
}

/**
 * Map JUnit results back onto the card's verdicts, by METHOD NAME: JUnit makes
 * no promise about execution order, so position would be a guess. A check the
 * run never reported is reported as failed rather than quietly dropped.
 */
export function parseRemoteKotlinChecks(
	raw: RemoteKotlinTestResponse,
	checks: RemoteCheck[],
): Array<{ label: string; pass: boolean }> {
	const byMethod = new Map<string, { status: string; detail: string }>();
	for (const results of Object.values(raw.testResults ?? {})) {
		for (const r of results ?? []) {
			if (!r?.methodName) continue;
			const detail =
				r.comparisonFailure?.message ??
				[r.exception?.fullName, r.exception?.message].filter(Boolean).join(": ");
			byMethod.set(r.methodName, { status: (r.status ?? "").toUpperCase(), detail: detail ?? "" });
		}
	}
	return checks.map((c, i) => {
		const label = c.label || c.expr;
		const got = byMethod.get(checkMethod(i));
		if (!got) return { label, pass: false };
		if (got.status === "OK") return { label, pass: true };
		// The teacher reads these: "expected:<99> but was:<2>" is the whole
		// point of using real assertions instead of a string compare.
		return { label: got.detail ? `${label} — ${got.detail}` : label, pass: false };
	});
}
