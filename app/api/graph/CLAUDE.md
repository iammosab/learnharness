# app/api/graph

## Overview
Knowledge-graph API surface. The root handler serves the home graph view; children cover costs, manual/imported extraction runs, node deletion, drag positions, render settings, and run status.

## Interface
- `GET()` — `Response.json(graphView())` from `@/src/server`: nodes, edges, session provenance, per-session understanding observations. `force-dynamic`.
- Subdirectories:
  - [costs](./costs/CLAUDE.md) — `GET` graph-pipeline cost fold.
  - [coverage](./coverage/CLAUDE.md) — group for [coverage/extract](./coverage/extract/CLAUDE.md), `POST` manual extraction.
  - [import](./import/CLAUDE.md) — `POST` multipart notes import.
  - [nodes](./nodes/CLAUDE.md) — group for [nodes/[id]](./nodes/%5Bid%5D/CLAUDE.md), `DELETE` one node.
  - [positions](./positions/CLAUDE.md) — `PUT` drag commit.
  - [render-settings](./render-settings/CLAUDE.md) — `GET`/`PUT` rendering controls.
  - [status](./status/CLAUDE.md) — `GET` in-flight extraction runs.

## Invariants
- Thin transport over `src/server/graph.ts` and the extraction module; no graph logic in routes.
- Graph ledger writes happen only via server entry points (`deleteGraphNode`, `commitPositions`, the extraction pipeline); turns and jobs never write the graph.

## Side Effects
- Children start background extraction runs and rewrite graph/position ledgers; the root `GET` is read-only.

## Verification
- Run: `npm test`
