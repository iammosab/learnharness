# src/server/pi

## Overview

The bridge from `@earendil-works/pi-agent-core` to the HTTP wire.
`ui-stream.ts` runs one agent turn as a server-side background object and
streams native pi `AgentEvent`s verbatim as SSE `data:` frames, keeping a
compacted in-memory event log that any number of subscriber views can
replay from. `call-ids.ts` uniquifies tool-call ids that providers reset
every response (for example DeepSeek's `call_0`) once, at the wire
boundary, and applies the same remapping to the settled transcript.

The server barrel (`src/server/index.ts`) re-exports `runPiTurn`,
`piTurnResponse`, `PiTurnHandle`, and `PiTurnSpec` from here. The only
agent-layer dependency is the type `ChatGPTRequestCycle` from
`src/agent/chatgpt-request-cycle.ts`.

## Interface

- `call-ids.ts`
  - `collectToolCallIds(messages: readonly unknown[]): string[]` - every
    `toolCall` block id from assistant messages and every `toolCallId`
    from toolResult messages, duplicates included.
  - `class ToolCallIdUniquifier` - `constructor(usedIds: Iterable<string>)`,
    `event(event: AgentEvent): AgentEvent`,
    `remapSettled(messages: readonly unknown[]): unknown[]`.
- `ui-stream.ts`
  - `type TurnWireEvent = AgentEvent | { type: "message_update"; message }
    | { type: "error"; errorText }`.
  - `interface PiTurnSpec` - `agent`, `onFinish(messages, isAborted)`,
    optional `requestCycle`, `onError`, `onSettleError`,
    `onSettleFailure`, `usedToolCallIds`, `updateFlushMs` (default 100).
  - `interface PiTurnSubscriber` - `push(event)`, `done()`.
  - `interface PiTurnHandle` - `subscribe(): ReadableStream<Uint8Array>`,
    `abort(): void`.
  - `runPiTurn(spec: PiTurnSpec): PiTurnHandle`.
  - `piTurnResponse(handle: PiTurnHandle): Response` - headers
    `text/event-stream`, `Cache-Control: no-cache, no-transform`,
    `X-Accel-Buffering: no`.

## Invariants

- Wire format: each event is `data: ${JSON.stringify(event)}\n\n`; the
  stream ends with `data: [DONE]\n\n`. Events are native pi `AgentEvent`s
  and are never assembled into AI-SDK UIMessage parts (the
  `docs/architecture.md` description of this file as a UIMessage
  converter is out of date).
- `message_update` on the wire is rebuilt as `{ type, message }` with the
  full partial message, so views replace their copy rather than append
  deltas.
- `{ type: "error", errorText }` is the only app-level event emitted here
  (loop throw or settlement failure). `turn-settled` is served by
  `src/server/turn-runs.ts`, not this folder.
- Id claiming is deterministic given the seed set and event order:
  `claim(orig)` keeps `orig` if unseen, otherwise takes the first unused
  `${orig}~n` for n = 2, 3, ... The seed set comes from
  `usedToolCallIds` (collected from the chat record by the caller). If
  `usedToolCallIds` is absent, no uniquifier is created and ids pass
  through unchanged.
- Each assistant `message_start` opens a fresh epoch table; an orig id is
  claimed once per message, so remapping repeated partials is idempotent;
  the same orig id in a later message of the turn gets its own mint.
  `tool_execution_*` events resolve through the current epoch;
  `turn_end` and `agent_end` remap their messages. `remapSettled`
  rewrites only assistant messages registered during this turn; earlier
  history passes through unchanged.
- Unchanged events and messages are returned as the same object; changed
  ones are shallow-cloned, never mutated in place.
- Log compaction: `message_update` shares one slot; each
  `tool_execution_update` has its own slot keyed by `toolCallId`; slots
  hold only the latest snapshot and are freed on `message_end` /
  `tool_execution_end`; all other events append verbatim.
- Live fan-out of update events is coalesced to at most one flush per
  `updateFlushMs`; `flushPending()` runs before any non-update event is
  sent, so pending updates always precede the next event and `[DONE]`.
- `subscribe()` adds the subscriber and then replays the whole log
  synchronously, so no event can fall between replay and live delivery.
  A view attaching after settlement gets the full replay then `[DONE]`.
- Cancelling a view removes only that subscriber; the turn keeps running.
  `abort()` is the only early kill (sets `sawAbort`, calls
  `requestCycle?.abort()` and `agent.abort()`).
- Settlement runs once, on `agent_end` or on the loop-failure catch path (after the `error` event): system-role messages are filtered
  out of `agent.state.messages`, `remapSettled` is applied, and
  `onFinish(messages, sawAbort)` is called; after `settled` all further
  events are ignored. `sawAbort` is also set when an assistant
  `message_end` carries `stopReason: "aborted"`.

## Side Effects

- `call-ids.ts`: no IO; per-instance state only (`seen` set, `tables`
  WeakMap, `epoch`), scoped to one turn.
- `ui-stream.ts`: per-turn closure state (`log`, `updateSlots`,
  `pending`, `subscribers`, `settled`, `sawAbort`); no module-level
  state and no disk IO of its own (persistence is delegated to
  `onFinish`).
- One `setTimeout` flush timer per window, `unref()`'d and cleared in
  `flushPending`.
- `runPiTurn` starts the agent loop as a fire-and-forget async IIFE
  (`await agent.continue()` until `sawAbort`), subscribes to agent
  events, and when a `requestCycle` is present injects a synthetic `agent_end` whenever `finishNativeCycle()` does not return `resumeForeground`, and replaces `agent.state.messages` only if the request was denied before dispatch. `console.error` on settlement, cleanup, and loop
  failures.
- Produces a network-facing `ReadableStream` / `Response`.

## Verification

- Run: `npm test`
- Also: `npm run lint` and `npm run typecheck`.
