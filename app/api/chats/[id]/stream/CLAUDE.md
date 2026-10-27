# app/api/chats/[id]/stream

## Overview
`GET /api/chats/[id]/stream` is the turn wire: one SSE stream per chat. A running turn gets a full replay of its event log then live chunks until `[DONE]`; no running turn gets a cheap terminal so the client refetches the record.

## Interface
- `GET(_req, ctx)` — 404 unknown chat; `runningTurn(id)` handle present → `piTurnResponse(handle)`; absent → `settledTurnResponse(id)` (`{"type":"turn-settled"}` + `[DONE]`, preceded by any retained settlement-failure notice). All from `@/src/server`.

## Invariants
- The submitter of `POST /api/chat` attaches here too; the POST never carries the reply.
- Replay-then-live ordering is owned by the server seams (`turn-runs`, `ui-stream`); tests drive those seams directly.

## Side Effects
- Holds a long-lived SSE response open; subscribes to the live turn object.

## Verification
- Run: `npm test`
