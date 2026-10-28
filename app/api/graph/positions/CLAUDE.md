# app/api/graph/positions

## Overview
`PUT /api/graph/positions` commits the client's annealed drag positions. The server sanitizes, writes the position ledger, and runs one incremental settle if the graph grew mid-drag.

## Interface
- `PUT(request)` — 400 invalid JSON; returns `{ positions: commitPositions(body) }` (`@/src/server`), i.e. whatever survived sanitizing (empty object = nothing written).

## Invariants
- Only finite coordinates for known node ids are persisted.
- Sanitizing and settling live in `src/server/commit-positions.ts`, not here.

## Side Effects
- Writes the positions ledger; may run an incremental layout settle.

## Verification
- Run: `npm test`
