# app/api/chats/[id]/dismiss

## Overview
`POST /api/chats/[id]/dismiss` is the silent dismissal route: ESC-abort from a pending question writes the dismissed tool result to the record and wakes nothing (no `beginTurn`, no tokens). The session enters the derived dismissal pause until the learner's next plain message.

## Interface
- `POST(req, ctx)` — body `{ input }` parsed by `parseDismissInput` (`ChatInputError` → 400). 404 unknown chat.
- Running turn → `parkDismissal(id, input)` and 202 `{ ok: true, parked: true }`; the turn's settle path applies it.
- Idle → `dismissAppends(chat, input)` (400 if it targets no dangling question call), `stores.chatStore.saveMessages(id, [...messages, ...appends])`, `emit("record-changed", { chatId })`, 200 `{ ok: true }`.

## Invariants
- Each dismissal completes exactly its own tool call (bound by `toolCallId`, not position).
- A running turn owns the record; dismissals against it are parked, never validated against stale truth.
- No model call is ever made from this route.

## Side Effects
- Writes the chat store (idle path) or the server's parked-dismissal registry (running path); emits `record-changed` on the core event bus.

## Verification
- Run: `npm test`
