# app/api/chats/[id]/steer

## Overview
`POST /api/chats/[id]/steer` is the composer's mid-turn steering rail: the learner's message for a running turn is queued onto the agent's steering queue and drained at the next response boundary inside the same run.

## Interface
- `POST(request, ctx)` — 404 unknown chat; body `{ input }` via `parseUserSteerInput` (`ChatInputError` → 400); `newUserSteer(text, id)` from `@/src/core`; `steerLiveChat(id, message)` from `@/src/server`; false → 409 `no live turn to steer`; else `{ ok: true }`.

## Invariants
- Steering never starts a turn and never extends an ended one; 409 means the client falls back to a plain send.
- The message id is client-minted so the live stream's forwarded copy upserts the same card.
- Persistence happens through the turn's own settlement, not here.

## Side Effects
- Mutates the running turn's steering queue in the server registry.

## Verification
- Run: `npm test`
