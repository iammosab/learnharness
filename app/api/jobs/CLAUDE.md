# app/api/jobs

## Overview
`GET /api/jobs?chatId=` is the chat view's sub-agent job status fetch (the async protocol's status endpoint), fetched on mount, per `jobs-changed` announcement, and on channel resync.

## Interface
- `GET(req)` — `chatId` query required (400 missing; 400 if not `^[A-Za-z0-9_-]+$`); returns `{ jobs: listJobs(chatId), turnInFlight: isTurnRunning(chatId) }`. `force-dynamic`.

## Invariants
- Chat-scoped by design; cross-view process status is `/api/activity`.
- `turnInFlight` rides along for the client's settle/idle check.

## Side Effects
- Read-only over the jobs store and turn registry.

## Verification
- Run: `npm test`
