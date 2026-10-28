# app/api/chat

## Overview
`POST /api/chat` is the turn submission endpoint. Since the "connection diet" the handler acknowledges and closes; the turn's event stream is consumed through `GET /api/chats/[id]/stream`.

## Interface
- `POST(req)` — returns `handleChatRequest(req)` from `@/src/server` unchanged.

## Invariants
- Zero logic in the route: body parsing, the models-configured gate (503 `models_not_configured`), and turn start all belong to `handleChatRequest`.
- The reply is delivered on the per-chat SSE stream, never on this response (see [../chats/[id]/stream](../chats/%5Bid%5D/stream/CLAUDE.md)).

## Side Effects
- Starts a background teacher/practice turn (model calls, chat record write-ahead) via the server handler.

## Verification
- Run: `npm test`
