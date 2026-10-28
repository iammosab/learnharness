# app/api/graph/costs

## Overview
`GET /api/graph/costs` feeds the graph view's cost pill: what the graph pipeline cost, folded at read time from the chat-extraction, notes-source, and cluster-naming usage channels.

## Interface
- `GET()` — `Response.json(graphCosts())` from `@/src/server`. `force-dynamic`.

## Invariants
- Scope is the graph pipeline only; teaching turns and sub-agent jobs have separate cost channels.
- Dollars are computed from the model catalog at read time and never stored.

## Side Effects
- Read-only over the graph and usage ledgers.

## Verification
- Run: `npm test`
