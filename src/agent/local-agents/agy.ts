import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Api, Model } from "@earendil-works/pi-ai";
import { PATHS } from "../../../config.ts";
import { appHeldEnvVars, resolveBinary } from "./binaries.ts";
import { BRIDGE_SERVER_NAME } from "./mcp-server.ts";
import type { AdapterProbe, LocalAgentAdapter, OpenRequest } from "./adapter.ts";
import type { LocalRun, RunSession } from "./run.ts";
import type { PromptBlock } from "./transcript.ts";

/**
 * Antigravity through the learner's own `agy` CLI (docs/architecture.md
 * §8.2). This is the second Antigravity route: the ACP server
 * (`antigravity.ts`) offers one model, while the CLI serves the full plan
 * catalogue — Gemini Flash plus the Claude and GPT-OSS models Google routes
 * through an Antigravity plan. The app never runs a Google sign-in and
 * never reads a token; `agy` uses whatever the learner signed in with.
 *
 * Protocol: the CLI's headless stream-json mode. Frames are keyed by
 * `event` (`init` / `step_update` / `result`), not by Anthropic's `type`,
 * so none of the Claude parser transfers. One process serves many turns:
 * each `{"event":"user",...}` line on stdin starts one, and each turn ends
 * with its own `result`.
 *
 * Isolation is weaker than the Claude route and the differences are real:
 * `agy` has no `--tools`, no `--setting-sources` and no session-persistence
 * switch, so its 60 native tools stay registered, it reads the learner's
 * global `~/.gemini` configuration, and it records conversation history.
 * What makes it safe enough is that headless mode cannot prompt for a
 * permission and therefore auto-denies every tool that needs one: shell,
 * writes and MCP calls all fail closed. The app opts exactly its own
 * bridged tools back in (see `ensureBridgePermissions`) and nothing else.
 */

const API: Api = "antigravity-cli";
const PROVIDER = "antigravity-cli";

/** The MCP server name agy derives for a plugin-provided server: `<plugin>_<server>`. */
const PLUGIN_NAME = BRIDGE_SERVER_NAME;
const MCP_SERVER_NAME = `${PLUGIN_NAME}_${BRIDGE_SERVER_NAME}`;

/** Env vars that would move agy off the learner's plan or onto another account. */
const SCRUBBED_ENV = [
	"GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_CLOUD_PROJECT",
	"GOOGLE_GENAI_USE_VERTEXAI", "GEMINI_MODEL",
];

export function agyChildEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = { ...base };
	for (const key of SCRUBBED_ENV) delete env[key];
	for (const name of appHeldEnvVars()) delete env[name];
	return env;
}

/**
 * Where agy keeps its credential and settings. Deliberately NOT
 * `GEMINI_HOME`: the ACP server honours that variable, but the CLI ignores
 * it (verified — it kept reading `~/.gemini` with GEMINI_HOME set), so
 * following it here would write the allow-rules into a file agy never
 * reads and every bridged tool would be denied. `LH_AGY_HOME` is a test
 * seam.
 */
function agyHome(): string {
	return process.env.LH_AGY_HOME ? path.resolve(process.env.LH_AGY_HOME) : path.join(os.homedir(), ".gemini");
}

function knownDirs(): string[] {
	const home = os.homedir();
	return [path.join(home, ".local", "bin"), path.join(home, ".gemini", "bin"), "/opt/homebrew/bin", "/usr/local/bin"];
}

export function resolveAgyBinary(): Promise<string | undefined> {
	return resolveBinary({ envVar: "LH_AGY_BIN", names: process.platform === "win32" ? ["agy.exe"] : ["agy"], knownDirs: knownDirs() });
}

/** Presence only — the credential's contents are never read. */
export function agyTokenPresent(): boolean {
	return fs.existsSync(path.join(agyHome(), "oauth_creds.json"));
}

function run(binary: string, args: string[], timeout: number): Promise<{ ok: boolean; stdout: string }> {
	return new Promise((resolve) => {
		execFile(binary, args, { timeout, env: agyChildEnv(), windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => resolve({ ok: !error, stdout: String(stdout) }));
	});
}

/**
 * No thinking level, by agy's own design: the effort is part of the model
 * id (`gemini-3.8-flash-high` vs `-low`), and passing `--effort` alongside
 * one is rejected outright — "--effort is not supported for model
 * claude-opus-4-6-thinking". The catalogue therefore offers each listed id
 * as its own model and the app never sends an effort flag.
 */
export function agyCatalogModel(id: string, name: string): Model<Api> {
	return {
		id,
		name,
		api: API,
		provider: PROVIDER,
		baseUrl: "",
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: /^gemini/i.test(id) ? 1_048_576 : 200_000,
		maxTokens: 65_536,
		reasoning: false,
		input: ["text"],
	} as unknown as Model<Api>;
}

/** `agy models` prints one `<id>\t<name>` row per model, after a status line. */
export function parseAgyModels(stdout: string): Model<Api>[] {
	const models: Model<Api>[] = [];
	for (const line of stdout.split("\n")) {
		const [id, ...rest] = line.trim().split("\t");
		if (!id || !rest.length) continue;
		const name = rest.join(" ").trim();
		if (!name || /\s/.test(id)) continue;
		models.push(agyCatalogModel(id, name));
	}
	return models;
}

export async function probeAgy(options: { discoverModels: boolean; previous: Model<Api>[] }): Promise<AdapterProbe> {
	const binary = await resolveAgyBinary();
	if (!binary) return { installed: false, signedIn: false, models: [] };
	if (!agyTokenPresent()) return { installed: true, binary, signedIn: false, models: [] };
	// Listing models is a network call; reuse the catalogue unless asked.
	if (!options.discoverModels && options.previous.length > 0) {
		return { installed: true, binary, signedIn: true, usesSubscription: true, models: options.previous };
	}
	const listed = await run(binary, ["models"], 45_000);
	const models = parseAgyModels(listed.stdout);
	if (!listed.ok || models.length === 0) {
		// A failed listing must not read as "signed out" and tear down live work.
		return { installed: true, binary, signedIn: true, usesSubscription: true, models: options.previous, uncertain: true, error: "The Antigravity CLI did not list any models. Sign in with `agy`, then refresh." };
	}
	return { installed: true, binary, signedIn: true, usesSubscription: true, models };
}

/**
 * agy denies every permissioned tool in headless mode, bridged MCP calls
 * included, and the allow-list it consults is global: a `permissions.allow`
 * entry inside a workspace is ignored (verified against agy 2.x). So the
 * app writes narrowly scoped rules — only its own MCP server, only the
 * tools it bridges — into the learner's settings file, and
 * `clearBridgePermissions` takes them out again when the connection is
 * switched off. Every other permission the learner has set is preserved.
 */
function settingsFile(): string { return path.join(agyHome(), "antigravity-cli", "settings.json"); }

function readSettings(file: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
	} catch { return {}; }
}

function writeSettings(file: string, settings: Record<string, unknown>): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
}

/** The rules this app owns, and only these, are ever added or removed. */
export function bridgeAllowRules(toolNames: string[]): string[] {
	return toolNames.map((name) => `mcp(${MCP_SERVER_NAME}/${name})`);
}

export function ensureBridgePermissions(toolNames: string[], file = settingsFile()): void {
	if (toolNames.length === 0) return;
	const settings = readSettings(file);
	const permissions = (settings.permissions && typeof settings.permissions === "object" && !Array.isArray(settings.permissions)
		? settings.permissions : {}) as Record<string, unknown>;
	const existing = Array.isArray(permissions.allow) ? permissions.allow.filter((rule): rule is string => typeof rule === "string") : [];
	const wanted = bridgeAllowRules(toolNames);
	const missing = wanted.filter((rule) => !existing.includes(rule));
	if (missing.length === 0) return;
	permissions.allow = [...existing, ...missing];
	settings.permissions = permissions;
	writeSettings(file, settings);
}

export function clearBridgePermissions(file = settingsFile()): void {
	if (!fs.existsSync(file)) return;
	const settings = readSettings(file);
	const permissions = settings.permissions as Record<string, unknown> | undefined;
	if (!permissions || !Array.isArray(permissions.allow)) return;
	const kept = permissions.allow.filter((rule) => typeof rule !== "string" || !rule.startsWith(`mcp(${MCP_SERVER_NAME}/`));
	if (kept.length === permissions.allow.length) return;
	if (kept.length === 0) delete permissions.allow; else permissions.allow = kept;
	if (Object.keys(permissions).length === 0) delete settings.permissions;
	writeSettings(file, settings);
}

/**
 * The shim agy spawns for the app's tools. Anchored at ROOT like the
 * prompt assets (`PATHS.teacherPrompt`), because the compiled module's own
 * location moves in a standalone build while the traced copy keeps its
 * `src/agent/local-agents/` path.
 */
export function shimPath(): string {
	return path.join(PATHS.root, "src", "agent", "local-agents", "agy-mcp-stdio.mjs");
}

function writeWorkspace(dir: string, request: OpenRequest): string {
	const cwd = path.join(dir, "workspace");
	fs.mkdirSync(cwd, { mode: 0o700 });
	// Rules are agy's only prompt-injection point: it has no
	// --system-prompt-file, and AGENTS.md in the working directory is read
	// before the first turn.
	fs.writeFileSync(path.join(cwd, "AGENTS.md"), request.systemPrompt, { mode: 0o600 });
	if (request.tools.length === 0) return cwd;
	const plugin = path.join(cwd, ".agents", "plugins", PLUGIN_NAME);
	fs.mkdirSync(plugin, { recursive: true, mode: 0o700 });
	fs.writeFileSync(path.join(plugin, "plugin.json"), JSON.stringify({ name: PLUGIN_NAME }), { mode: 0o600 });
	// The token travels in env, never on a command line or in a URL.
	fs.writeFileSync(path.join(plugin, "mcp_config.json"), JSON.stringify({
		mcpServers: {
			[BRIDGE_SERVER_NAME]: {
				command: process.execPath,
				args: [shimPath()],
				env: { LH_BRIDGE_URL: request.bridge.url, LH_BRIDGE_TOKEN: request.bridge.token, ELECTRON_RUN_AS_NODE: "1" },
			},
		},
	}), { mode: 0o600 });
	return cwd;
}

interface AgyStepUpdate {
	step_index?: number;
	state?: string;
	step_type?: string;
	text_delta?: string;
	tool_name?: string;
	tool_info?: { name?: string; parameters?: Record<string, unknown>; error?: { message?: string } };
	usage?: Record<string, number>;
}

function reportUsage(run: LocalRun, usage: Record<string, number> | undefined): void {
	if (!usage) return;
	run.usage({
		input: usage.input_tokens ?? 0,
		output: usage.output_tokens ?? 0,
		cacheRead: usage.cache_read_tokens ?? 0,
		cacheWrite: 0,
	});
}

/**
 * Feed one parsed stream-json frame into the run. Exported for tests.
 *
 * Tool calls are surfaced by the bridge when the MCP request arrives, not
 * from the stream: agy reports a generic `call_mcp_tool` step whose
 * parameters name the real tool, and it carries no id to correlate with.
 */
export function agyFrameHandler(run: LocalRun) {
	let sawResponse = false;
	return (frame: Record<string, any>) => {
		switch (frame.event) {
			case "init":
				return;
			case "step_update": {
				const step = (frame.step_update ?? {}) as AgyStepUpdate;
				if (step.step_type === "agent_response") {
					if (!sawResponse) { sawResponse = true; run.messageStarted(); }
					if (step.text_delta) run.text(step.text_delta);
					if (step.state === "DONE") { reportUsage(run, step.usage); run.endMessage("stop"); sawResponse = false; }
					return;
				}
				if (step.step_type === "tool" && step.state === "ERROR") {
					const message = step.tool_info?.error?.message ?? "";
					// A denied bridge call means the allow-rule did not take; the
					// learner would otherwise see a turn that silently does nothing.
					if (/permission/i.test(message) && message.includes(MCP_SERVER_NAME)) {
						run.fail("The Antigravity CLI denied LearnHarness's tools. Reconnect the connection and try again.");
					}
				}
				return;
			}
			case "result": {
				const result = (frame.result ?? {}) as { status?: string; error?: string; usage?: Record<string, number>; denied_actions?: Array<{ display_name?: string }> };
				reportUsage(run, result.usage);
				if (result.status && result.status !== "SUCCESS") {
					run.fail(result.error || `The Antigravity CLI reported ${result.status}.`);
					return;
				}
				run.endTurn("stop");
				return;
			}
			default:
				return;
		}
	};
}

function promptText(blocks: PromptBlock[]): string {
	return blocks.map((block) => block.type === "image" ? `[image omitted: ${block.mimeType}]` : block.text).join("");
}

function openAgy(run: LocalRun, request: OpenRequest): RunSession {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-agy-"));
	const cwd = writeWorkspace(dir, request);
	if (request.tools.length > 0) ensureBridgePermissions(request.tools.map((tool) => tool.name));
	const args = [
		"-p=", "--input-format", "stream-json", "--output-format", "stream-json",
		"--model", request.model.id,
		"--disable-slash-commands", "--print-timeout", "0",
	];
	const child = spawn(request.binary, args, { cwd, env: agyChildEnv(), stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
	let stderr = "";
	let disposed = false;
	const handle = agyFrameHandler(run);
	let buffer = "";
	child.stdout.setEncoding("utf8");
	child.stdout.on("data", (chunk: string) => {
		buffer += chunk;
		let newline: number;
		while ((newline = buffer.indexOf("\n")) >= 0) {
			const line = buffer.slice(0, newline).trim();
			buffer = buffer.slice(newline + 1);
			if (!line) continue;
			let parsed: Record<string, unknown>;
			try { parsed = JSON.parse(line); } catch { continue; }
			handle(parsed);
		}
	});
	child.stderr.setEncoding("utf8");
	child.stderr.on("data", (chunk: string) => { stderr = (stderr + chunk).slice(-4000); });
	child.on("error", (error) => run.fail(`The Antigravity CLI could not start: ${error.message}`));
	child.on("exit", (code) => { if (!disposed) run.fail(stderr.trim().split("\n").pop() || `The Antigravity CLI exited (${code ?? "signal"}).`); });
	child.stdin.on("error", () => { /* surfaced through exit */ });
	return {
		start(prompt) {
			const content = [{ type: "text", text: promptText(prompt) }];
			child.stdin.write(`${JSON.stringify({ event: "user", message: { role: "user", content } })}\n`);
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			child.stdin.end();
			child.kill("SIGTERM");
			const force = setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); }, 3_000);
			force.unref();
			fs.rm(dir, { recursive: true, force: true }, () => {});
		},
	};
}

export const agyAdapter: LocalAgentAdapter = {
	providerId: PROVIDER,
	// agy names the real tool only inside call_mcp_tool's parameters and
	// gives no call id, so the bridge request is what surfaces the call.
	surfaceOnArrival: true,
	// agy's stream-json input accepts text content blocks only.
	images: false,
	probe: probeAgy,
	open: async (run, request) => openAgy(run, request),
	onDisable: async () => { clearBridgePermissions(); },
};
