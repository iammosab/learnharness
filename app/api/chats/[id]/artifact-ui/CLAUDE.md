# app/api/chats/[id]/artifact-ui

## Overview
`POST /api/chats/[id]/artifact-ui` persists the learner's invert switch on a demo/figure steer message (`details.ui.inverted`) so it survives navigation and restarts. Silent by design: no turn, no agent, no SSE.

## Interface
- `POST(req, ctx)` — body `{ input: { messageId: string, inverted: boolean } }`. 404 unknown chat; 400 bad shape or when the target message is not a `demo`/`visual` steer (`SteerDetails.kind`). Applies `setSteerUiInverted(messages, messageId, inverted)` from `@/src/core` and `stores.chatStore.saveMessages(id, messages)`. Returns `{ ok: true }`.

## Invariants
- The record is the only state that moves; the client already holds the toggled state optimistically.
- Only demo/visual steer messages may be targeted.

## Side Effects
- Rewrites the chat's message list in the chat store.

## Verification
- Run: `npm test`
