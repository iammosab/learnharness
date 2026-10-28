# app/api/search

## Overview
`GET /api/search` reports search-engine availability for the settings UI's gray-out affordance and any client surface.

## Interface
- `GET()` — `Response.json(searchStatus())`: `{ available, engine, reason }`. `force-dynamic`.

## Invariants
- Never returns a key or secret; `engine` is the active engine, `reason` a one-line explanation.

## Side Effects
- Read-only over key configuration.

## Verification
- Run: `npm test`
