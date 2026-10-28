# app/api/activity/abort

## Overview
`POST /api/activity/abort` is the activity dock's uniform END/ABORT control for every background process kind. The route is transport only: it validates the body and dispatches to the domain-owned abort mechanisms in `@/src/server`.

## Interface
- `POST(req)` — body `{ kind: "job" | "extraction" | "turn", id: string }`. `id` is the jobId for `job`, the chatId for `extraction` and `turn`.
- Calls `abortJob(id)`, `abortTurn(id)`, or `abortExtraction(id)` from `@/src/server`.
- Responses: 400 invalid JSON / shape / id charset (`^[A-Za-z0-9:_-]+$`); `job` not_found → 404, not_running → 409; `turn` not_running → 409; `extraction` always 200 (idempotent); success → `{ ok: true }`.

## Invariants
- Imports only from `@/src/server` (app import law, `eslint.config.mjs`).
- No abort logic lives here; outcomes and status mapping mirror the server functions' `{ ok, reason }` results.
- Extraction abort is idempotent by design: nothing in flight is still success.

## Side Effects
- Cancels in-memory running turns, sub-agent jobs, or extraction runs via the server registries; an aborted turn persists its partial reply through the normal settle path.

## Verification
- Run: `npm test`
