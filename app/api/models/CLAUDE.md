# app/api/models

## Overview
`GET /api/models` serves the model picker's data: the configured-provider catalog as client-safe DTOs (id, name, cost, context, modality, supported thinking levels).

## Interface
- `GET()` — `await refreshConnectionCatalog()`, then `Response.json(modelCatalog(), { headers: { "Cache-Control": "no-store" } })`.

## Invariants
- Never cached by the client (`no-store`).
- Catalog shape is stable within a pi-ai version; the refresh step reconciles subscription-connection models before serving.

## Side Effects
- `refreshConnectionCatalog()` may touch subscription-connection state before the read.

## Verification
- Run: `npm test`
