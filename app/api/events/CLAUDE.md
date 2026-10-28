# app/api/events

## Overview
`GET /api/events` is the notification channel: one SSE connection per open window over the core event bus, the endpoint the chat view, sidebar, and activity dock subscribe to instead of polling.

## Interface
- `GET()` — returns `eventsResponse()` from `@/src/server`. `export const dynamic = "force-dynamic"`.

## Invariants
- Response plumbing lives in the server seam (`events-stream.ts`); this route stays a thin wrapper.

## Side Effects
- Holds a long-lived SSE response open; subscribes to the in-process event bus.

## Verification
- Run: `npm test`
