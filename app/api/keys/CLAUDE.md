# app/api/keys

## Overview
`GET /api/keys` is the settings/auth page's key list: every curated key (present or not), unknown file vars as generic rows, and the provider table for the dropdown.

## Interface
- `GET()` — `{ keys: keyStatuses(), providers: providerKeyList() }` from `@/src/server`. `force-dynamic`.
- Subdirectories: [[id]](./%5Bid%5D/CLAUDE.md) — `PUT`/`DELETE` one key.

## Invariants
- Masked only (last 4 + length); plaintext never leaves the store through this API.
- Absent provider keys do not produce status rows; `providers` is the discovery surface.

## Side Effects
- Read-only over the auth key file and environment.

## Verification
- Run: `npm test`
