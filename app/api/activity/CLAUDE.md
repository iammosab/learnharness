# app/api/activity

## Overview
`GET /api/activity` is the activity dock's single poll: every running background process (turns, sub-agent jobs, extraction runs) across all views, with costs already projected server-side.

## Interface
- `GET()` — returns `Response.json(activityFeed())` from `@/src/server`. `export const dynamic = "force-dynamic"`.
- Subdirectories: [abort](./abort/CLAUDE.md) — `POST` abort control for jobs, extractions, and turns.

## Invariants
- Composition only; the feed is built in `src/server/observability.ts`. `/api/jobs` stays chat-scoped and separate.
- Never cached (`force-dynamic`).

## Side Effects
- Read-only over in-memory registries and the stores; no writes.

## Verification
- Run: `npm test`
