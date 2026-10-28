# app/api/graph/nodes/[id]

## Overview
`DELETE /api/graph/nodes/[id]` removes a single graph node entirely: its lines, touching edges, naming events, mapping lines, and position in one atomic ledger rewrite.

## Interface
- `DELETE(_req, { params })` — `deleteGraphNode(id)` from `@/src/server`; failure forwards `{ error, code }` with the server's status (404 `not_found` for an unknown node, 409 while any extraction run is registered); success `{ stats, graphRevision }`.

## Invariants
- Full death: references from other sessions do not preserve the node.
- Never aborts an in-flight extraction; the UI retries once the dock drains.
- Orchestration is synchronous; derived data (partition, clusters) self-heals on read.

## Side Effects
- Rewrites graph ledgers and bumps `graphRevision`.

## Verification
- Run: `npm test`
