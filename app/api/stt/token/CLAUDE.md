# app/api/stt/token

## Overview
`GET /api/stt/token` mints a short-lived Deepgram access token so the renderer never holds the real `DEEPGRAM_API_KEY`; audio then flows renderer → Deepgram directly.

## Interface
- `GET()` — `keyValue("DEEPGRAM_API_KEY")` from `@/src/server`; missing → 503; `fetch("https://api.deepgram.com/v1/auth/grant", { ttl_seconds: 300 })`; non-OK or missing `access_token` → 502; else `{ token }`.

## Invariants
- The key is only read server-side; only the temporary token reaches the client.
- Token TTL is 300s and is checked only at the WebSocket handshake.

## Side Effects
- Outbound HTTPS call to Deepgram on every request.

## Verification
- Run: `npm test`
