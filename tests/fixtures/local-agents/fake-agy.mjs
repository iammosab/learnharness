#!/usr/bin/env node
// A scripted stand-in for the Antigravity CLI's headless stream-json
// protocol (tests/local-agents-agy.test.ts). It records how it was
// launched, then answers each {"event":"user"} line: "use the tool" → one
// bridged tool call, anything else → a plain text reply.
//
// Unlike the Claude stand-in it does NOT talk to the bridge directly: it
// spawns the real shim (src/agent/local-agents/agy-mcp-stdio.mjs) from the
// workspace plugin's mcp_config.json and speaks MCP over its stdio, the
// same way agy does. That keeps the shim on the tested path.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const log = (entry) => { if (process.env.FAKE_AGY_LOG) fs.appendFileSync(process.env.FAKE_AGY_LOG, `${JSON.stringify(entry)}\n`); };

if (args[0] === "models") {
	process.stdout.write("Fetching available models...\n");
	process.stdout.write(process.env.FAKE_AGY_MODELS ?? [
		"gemini-3.8-flash-high\tGemini 3.8 Flash (High)",
		"claude-opus-4-6-thinking\tClaude Opus 4.6 (Thinking)",
	].join("\n") + "\n");
	process.exit(Number(process.env.FAKE_AGY_MODELS_EXIT ?? 0));
}

const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const cwd = process.cwd();
const pluginDir = path.join(cwd, ".agents", "plugins", "learnharness");
const configFile = path.join(pluginDir, "mcp_config.json");
const server = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, "utf8")).mcpServers.learnharness : undefined;

log({
	type: "launch", args, cwd,
	agents: fs.existsSync(path.join(cwd, "AGENTS.md")) ? fs.readFileSync(path.join(cwd, "AGENTS.md"), "utf8") : null,
	model: flag("--model"), effort: flag("--effort"),
	mcp: server ? { command: server.command, args: server.args, env: server.env } : null,
	env: { GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? null, OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? null },
});

const emit = (frame) => process.stdout.write(`${JSON.stringify(frame)}\n`);
const conversation = "conv-test-1";
emit({ event: "init", conversation_id: conversation, init: { model: flag("--model"), cwd, tools: ["run_command", "call_mcp_tool"], permission_mode: "request-review" } });

/** The shim, spoken to exactly as agy would: MCP JSON-RPC over stdio. */
let shim, pending = new Map(), nextId = 1, ready;
function startShim() {
	if (ready) return ready;
	shim = spawn(server.command, server.args, { env: { ...process.env, ...server.env }, stdio: ["pipe", "pipe", "pipe"] });
	let buffer = "";
	shim.stdout.setEncoding("utf8");
	shim.stdout.on("data", (chunk) => {
		buffer += chunk;
		let nl;
		while ((nl = buffer.indexOf("\n")) >= 0) {
			const line = buffer.slice(0, nl).trim();
			buffer = buffer.slice(nl + 1);
			if (!line) continue;
			let message; try { message = JSON.parse(line); } catch { continue; }
			const resolve = pending.get(message.id);
			if (resolve) { pending.delete(message.id); resolve(message); }
		}
	});
	ready = rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake-agy", version: "1" } });
	return ready;
}
function rpc(method, params) {
	const id = nextId++;
	const wait = new Promise((resolve) => pending.set(id, resolve));
	shim.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
	return wait;
}

function textTurn(text) {
	emit({ event: "step_update", step_update: { conversation_id: conversation, step_index: 0, state: "DONE", step_type: "user_input" } });
	emit({ event: "step_update", step_update: { conversation_id: conversation, step_index: 1, state: "ACTIVE", step_type: "agent_response", text_delta: text.slice(0, 3) } });
	emit({ event: "step_update", step_update: { conversation_id: conversation, step_index: 1, state: "ACTIVE", step_type: "agent_response", text_delta: text.slice(3) } });
	emit({ event: "step_update", step_update: { conversation_id: conversation, step_index: 1, state: "DONE", step_type: "agent_response", usage: { input_tokens: 12, output_tokens: 5, thinking_tokens: 0, cache_read_tokens: 3, total_tokens: 20 } } });
	emit({ event: "result", result: { conversation_id: conversation, status: "SUCCESS", response: text, num_turns: 1, usage: { input_tokens: 12, output_tokens: 5, cache_read_tokens: 3, total_tokens: 20 } } });
}

async function toolTurn() {
	await startShim();
	await rpc("tools/list", {});
	emit({ event: "step_update", step_update: { conversation_id: conversation, step_index: 1, state: "ACTIVE", step_type: "tool", tool_name: "call_mcp_tool", tool_info: { name: "call_mcp_tool", parameters: { ServerName: "learnharness_learnharness", ToolName: "lookup", Arguments: { topic: "moons" } } } } });
	const reply = await rpc("tools/call", { name: "lookup", arguments: { topic: "moons" } });
	const text = reply?.result?.content?.map((part) => part.text).join("") ?? "<no result>";
	emit({ event: "step_update", step_update: { conversation_id: conversation, step_index: 1, state: "DONE", step_type: "tool", tool_name: "call_mcp_tool" } });
	textTurn(`tool said: ${text}`);
}

readline.createInterface({ input: process.stdin }).on("line", (line) => {
	const trimmed = line.trim();
	if (!trimmed) return;
	let message; try { message = JSON.parse(trimmed); } catch { return; }
	if (message.event !== "user") return;
	const text = (message.message?.content ?? []).map((block) => block.text ?? "").join("");
	log({ type: "turn", text });
	if (text.includes("use the tool") && server) void toolTurn();
	else textTurn(`echo:${text}`);
});
