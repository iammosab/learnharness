/**
 * stdio -> loopback-HTTP MCP shim for the Antigravity CLI (agy).
 *
 * The app's tool bridge (./mcp-server.ts) is a Streamable HTTP MCP server
 * that authenticates with a per-run `Authorization: Bearer` header — the
 * header is the boundary (a browser cannot set it cross-origin), so the
 * token never belongs in a URL. agy's MCP config has no header field, only
 * `command`/`args`/`env` for stdio servers, so this shim is the adapter
 * between the two: agy spawns it over stdio, and it forwards every
 * JSON-RPC message to the bridge with the header attached.
 *
 * The token arrives in LH_BRIDGE_TOKEN, which never appears on a command
 * line. Plain JS on purpose: agy spawns it with the app's own node binary,
 * outside the TypeScript build.
 */
import readline from "node:readline";

const URL_ = process.env.LH_BRIDGE_URL;
const TOKEN = process.env.LH_BRIDGE_TOKEN;

const write = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const rpcError = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

if (!URL_ || !TOKEN) {
	process.stderr.write("lh-mcp-shim: LH_BRIDGE_URL and LH_BRIDGE_TOKEN are required\n");
	process.exit(2);
}

/** One JSON-RPC message in, zero or more out (a tools/call answers over SSE). */
async function forward(message) {
	const id = message?.id ?? null;
	let response;
	try {
		response = await fetch(URL_, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
				Authorization: `Bearer ${TOKEN}`,
			},
			body: JSON.stringify(message),
		});
	} catch (error) {
		if (id !== null) write(rpcError(id, -32603, `tool bridge unreachable: ${error?.message ?? error}`));
		return;
	}
	// Notifications and empty batches: nothing to deliver.
	if (response.status === 202 || response.status === 204) return;
	if (!response.ok) {
		if (id !== null) write(rpcError(id, -32603, `tool bridge returned HTTP ${response.status}`));
		return;
	}
	const type = response.headers.get("content-type") ?? "";
	if (!type.includes("text/event-stream")) {
		const text = await response.text();
		if (!text.trim()) return;
		try { write(JSON.parse(text)); }
		catch { if (id !== null) write(rpcError(id, -32603, "tool bridge sent a malformed reply")); }
		return;
	}
	// SSE: keep-alive comments until the parked call resolves, then one event.
	const decoder = new TextDecoder();
	let buffer = "";
	for await (const chunk of response.body) {
		buffer += decoder.decode(chunk, { stream: true });
		let split;
		while ((split = buffer.indexOf("\n\n")) >= 0) {
			const frame = buffer.slice(0, split);
			buffer = buffer.slice(split + 2);
			const data = frame
				.split("\n")
				.filter((line) => line.startsWith("data:"))
				.map((line) => line.slice(5).trim())
				.join("");
			if (!data) continue; // ": keep-alive" comment frames
			try { write(JSON.parse(data)); } catch { /* ignore a partial frame */ }
		}
	}
}

// Each message is forwarded on its own: a tools/call parks for as long as
// the learner takes to answer, and must never hold up a ping or a second
// call behind it. JSON-RPC ids correlate the replies, so order is free.
readline.createInterface({ input: process.stdin }).on("line", (line) => {
	const trimmed = line.trim();
	if (!trimmed) return;
	let message;
	try { message = JSON.parse(trimmed); } catch { return; }
	void forward(message).catch(() => {});
});

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
