# app/api/graph/status

## Overview
`GET /api/graph/status` lists in-flight background extraction runs (phase per job, oldest first) for the home graph and the dock's status chips.

## Interface
- `GET()` — maps `extractionStatuses()` to `{ runs: [{ id, chatId, title, phase, startedAt, usage }] }`. `id` is `chatId#i` for chunk jobs; `title` prefers `run.label`, then `chatStore.getChat(chatId)?.title`, then the id, with `· i/N` appended for chunks.

## Invariants
- `chatId` stays the source id even for chunk rows (reveal/cost tracking is source-scoped).
- A missing chat record still reports the run.
- No dollars are stored; `usage` is raw per-step usage for the consumer to fold.

## Side Effects
- Read-only over the extraction registry and the chat store.

## Verification
- Run: `npm test`
