import assert from "node:assert/strict";
import { after, test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Agent } from "@earendil-works/pi-agent-core";
import { Type, type AssistantMessage, type ToolResultMessage } from "@earendil-works/pi-ai";

// Local agent connection — Antigravity through the learner's own `agy` CLI
// (docs/architecture.md §8.2), driven end to end through pi-agent-core
// against a scripted stand-in for the CLI's stream-json protocol. The
// stand-in spawns the real stdio→HTTP MCP shim, so the bridged tool call
// exercises the shipped shim rather than a double.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lh-local-agy-"));
const fake = fileURLToPath(new URL("./fixtures/local-agents/fake-agy.mjs", import.meta.url));
fs.chmodSync(fake, 0o755);
const logFile = path.join(directory, "agy.log");
process.env.LH_DATA_DIR = path.join(directory, "data");
process.env.LH_AUTH_FILE = path.join(directory, "auth.json");
// agy's home is redirected so the suite never reads or writes the real one.
process.env.LH_AGY_HOME = path.join(directory, "gemini");
fs.mkdirSync(process.env.LH_DATA_DIR, { recursive: true });
fs.mkdirSync(process.env.LH_AGY_HOME, { recursive: true });
fs.writeFileSync(process.env.LH_AUTH_FILE, "{}");
fs.writeFileSync(path.join(process.env.LH_AGY_HOME, "oauth_creds.json"), "{}");
fs.writeFileSync(path.join(process.env.LH_DATA_DIR, "local-agents.json"), JSON.stringify({ "antigravity-cli": { enabled: true, allowBackgroundUse: true } }));
process.env.LH_AGY_BIN = fake;
process.env.FAKE_AGY_LOG = logFile;
// App-held keys and Google auth reroutes must never reach the learner's CLI.
process.env.GEMINI_API_KEY = "gk-should-not-leak";
process.env.OPENROUTER_API_KEY = "sk-or-should-not-leak";

await import("../src/server/local-agents.ts");
const { refreshLocalAgents, localAgentStatus } = await import("../src/agent/local-agents/index.ts");
const { findRun } = await import("../src/agent/local-agents/run.ts");
const { parseAgyModels, bridgeAllowRules, ensureBridgePermissions, clearBridgePermissions } = await import("../src/agent/local-agents/agy.ts");
const { piEngineForSpec } = await import("../src/agent/models.ts");

after(() => fs.rmSync(directory, { recursive: true, force: true }));

function logEntries(type: string): Array<Record<string, any>> {
	if (!fs.existsSync(logFile)) return [];
	return fs.readFileSync(logFile, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)).filter((entry) => entry.type === type);
}

const SYSTEM = "You are the test teacher.";
let executions = 0;
const lookup = {
	name: "lookup", label: "Lookup", description: "Look up the secret word for a topic.",
	parameters: Type.Object({ topic: Type.String() }),
	execute: async (_id: string, params: unknown) => { const args = params as { topic: string }; executions++; return { content: [{ type: "text" as const, text: args.topic === "moons" ? "PHOBOS" : "OTTER" }], details: {} }; },
};
function agent() {
	const engine = piEngineForSpec({ provider: "antigravity-cli", id: "claude-opus-4-6-thinking", thinkingLevel: "low" }, false);
	return new Agent({ sessionId: "chat-agy", initialState: { systemPrompt: SYSTEM, model: engine.model, thinkingLevel: engine.level, tools: [lookup], messages: [] }, streamFn: engine.streamFn });
}

test("the catalogue is whatever `agy models` lists — the plan's models, not one", async () => {
	await refreshLocalAgents({ force: true });
	const status = localAgentStatus("antigravity-cli");
	assert.equal(status.installed, true);
	assert.equal(status.signedIn, true);
	assert.equal(status.usesSubscription, true);
	assert.equal(status.connected, true);
	assert(!JSON.stringify(status).includes("gk-"));
});

test("parseAgyModels reads the tab-separated rows and ignores the status line", () => {
	const models = parseAgyModels("Fetching available models...\ngemini-3.8-flash-low\tGemini 3.8 Flash (Low)\nclaude-opus-4-6-thinking\tClaude Opus 4.6 (Thinking)\n\n");
	assert.deepEqual(models.map((m) => [m.id, m.name]), [["gemini-3.8-flash-low", "Gemini 3.8 Flash (Low)"], ["claude-opus-4-6-thinking", "Claude Opus 4.6 (Thinking)"]]);
	assert.equal(models[0]!.provider, "antigravity-cli");
	assert.deepEqual(models.map((m) => m.cost.input), [0, 0]);
	// A Gemini row gets the long window; a routed model keeps the 200K one.
	assert.deepEqual(models.map((m) => m.contextWindow), [1_048_576, 200_000]);
});

test("no --effort is ever sent: agy bakes the level into the model id and rejects the flag", () => {
	// Verified against agy: `--model claude-opus-4-6-thinking --effort low`
	// fails with "--effort is not supported for model ...".
	const launch = logEntries("launch")[0];
	if (launch) assert.equal((launch.args as string[]).includes("--effort"), false);
	assert.equal(parseAgyModels("a\tA")[0]!.reasoning, false);
});

let teacher: ReturnType<typeof agent>;
test("a bridged tool call reaches the app through the real stdio shim", { timeout: 30_000 }, async () => {
	teacher = agent();
	await teacher.prompt("please use the tool");
	const messages = teacher.state.messages;
	const call = messages.find((m): m is AssistantMessage => m.role === "assistant" && m.stopReason === "toolUse");
	assert(call, "the bridged call should surface as a tool-use step");
	assert.deepEqual(call.content.filter((c) => c.type === "toolCall").map((c) => c.type === "toolCall" ? [c.name, c.arguments] : null), [["lookup", { topic: "moons" }]]);
	assert.equal((messages.find((m) => m.role === "toolResult") as ToolResultMessage).content[0]!.type, "text");
	assert.equal(executions, 1);
	const final = messages.at(-1) as AssistantMessage;
	assert.equal(final.stopReason, "stop");
	assert.match(final.content.map((c) => c.type === "text" ? c.text : "").join(""), /PHOBOS/);
	assert.equal(final.provider, "antigravity-cli");
	// One process served both steps, and the finished turn released it.
	assert.equal(logEntries("launch").length, 1);
	assert.equal(findRun("chat-agy"), undefined);
});

test("usage comes from the CLI's own counters, not zeros", () => {
	const final = teacher.state.messages.at(-1) as AssistantMessage;
	assert.deepEqual([final.usage.input, final.usage.output, final.usage.cacheRead], [12, 5, 3]);
});

test("the workspace carries the prompt as AGENTS.md and the bridge as a plugin with the token in env", () => {
	const launch = logEntries("launch")[0]!;
	const args = launch.args as string[];
	const after_ = (flag: string) => args[args.indexOf(flag) + 1];
	assert(args.includes("-p="), "the prompt flag must be empty so stdin drives the turns");
	assert.equal(after_("--input-format"), "stream-json");
	assert.equal(after_("--output-format"), "stream-json");
	assert.equal(after_("--model"), "claude-opus-4-6-thinking");
	assert(args.includes("--disable-slash-commands"));
	// agy has no --system-prompt-file; rules are the injection point.
	assert.equal(launch.agents, SYSTEM);
	// The per-run token never appears on a command line.
	assert.equal(launch.mcp.env.LH_BRIDGE_TOKEN.length > 0, true);
	assert(!args.join(" ").includes(launch.mcp.env.LH_BRIDGE_TOKEN));
	assert.match(String(launch.mcp.env.LH_BRIDGE_URL), /^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
	assert.match(String(launch.mcp.args[0]), /agy-mcp-stdio\.mjs$/);
	assert.deepEqual(launch.env, { GEMINI_API_KEY: null, OPENROUTER_API_KEY: null });
});

test("allow-rules are scoped to this app's own server and removed again", () => {
	const file = path.join(directory, "settings-probe.json");
	fs.writeFileSync(file, JSON.stringify({ trustedWorkspaces: ["/somewhere"], permissions: { allow: ["command(git status)"] } }));
	assert.deepEqual(bridgeAllowRules(["quiz"]), ["mcp(learnharness_learnharness/quiz)"]);
	ensureBridgePermissions(["quiz", "explain"], file);
	let settings = JSON.parse(fs.readFileSync(file, "utf8"));
	assert.deepEqual(settings.permissions.allow, ["command(git status)", "mcp(learnharness_learnharness/quiz)", "mcp(learnharness_learnharness/explain)"]);
	// Idempotent: a second ensure adds nothing.
	ensureBridgePermissions(["quiz", "explain"], file);
	settings = JSON.parse(fs.readFileSync(file, "utf8"));
	assert.equal(settings.permissions.allow.length, 3);
	clearBridgePermissions(file);
	settings = JSON.parse(fs.readFileSync(file, "utf8"));
	// The learner's own rule and unrelated settings survive.
	assert.deepEqual(settings.permissions.allow, ["command(git status)"]);
	assert.deepEqual(settings.trustedWorkspaces, ["/somewhere"]);
});

test("a settings file the app never wrote to is left exactly as it is", () => {
	const file = path.join(directory, "untouched.json");
	fs.writeFileSync(file, JSON.stringify({ trustedWorkspaces: [] }));
	const before = fs.readFileSync(file, "utf8");
	clearBridgePermissions(file);
	assert.equal(fs.readFileSync(file, "utf8"), before);
});
