# app/api/keys/[id]

## Overview
Save or remove one API key by env-var name (e.g. `OPENROUTER_API_KEY`). Validation is shape-only; saves take effect immediately without restart.

## Interface
- `PUT(req, { params })` — 404 unless `isWritableAuthKey(id)`; body must be JSON `{ value: string }` (400); `saveKey(id, value)` → 400 with `error` on shape failure, else `{ status }` (status row includes `shadowedByEnv`).
- `DELETE(_req, { params })` — 404 unless writable; `{ status: deleteKey(id) }`. Idempotent.

## Invariants
- Writable ids = curated catalog ∪ model-provider env vars; unknown file vars are preserved but not editable.
- Env always wins: a var owned by the real environment is persisted but not reflected.
- No live provider pings during validation.

## Side Effects
- Writes/removes entries in the auth key file and mirrors them into `process.env` when the store owns the reflection.

## Verification
- Run: `npm test`
