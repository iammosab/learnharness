# app/api/graph/coverage/extract

## Overview
`POST /api/graph/coverage/extract` is the manual extraction affordance: run the graph pipeline over one session's uncovered content, user-initiated, through the same batched/checkpointed run the automatic trigger fires.

## Interface
- `POST(request)` — body `{ chatId: string }` (400 invalid JSON or shape); 409 if `extractionStatuses()` already lists a `chat` run for that id; otherwise fire-and-forget `extraction.runExtraction(chatId)` and 202 `{ started: true }`.

## Invariants
- Never blocks on the pipeline; progress is observed via `/api/graph/status` and the dock.
- Pipeline failures are logged (`console.error`) and leave coverage untouched.

## Side Effects
- Starts a background extraction run (model calls, graph ledger writes, coverage checkpoints).

## Verification
- Run: `npm test`
