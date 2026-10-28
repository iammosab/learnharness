# app/api/chats

## Overview
Session collection endpoint: the sidebar's session list and session creation. This route is the merge point between store-derived summaries and live liveness, and it stamps a new session's model settings and optional graph-context marker at birth.

## Interface
- `GET()` — `{ chats: ChatListItem[] }`: `listChats()` entries plus `busy: isTurnRunning(id)` and `compacting: compactionInFlight(id)`.
- `POST(req)` — body `{ title?, kind?: "practice", graphContext?: { propositions: GraphContextPick[] } }`. Calls `createChat(titleFromPrompt(...), kind)`; if the settings record has a `models.strong` slot, `stores.chatStore.saveSettings(id, { model, thinkingLevel })`; if picks are present (max 64, validated shape), saves `newGraphContextMessage(picks, chainLines)` as message[0] using `chainsForSelection` / `formatChainLine` from `@/src/core`. Returns `{ id, title }`.
- Subdirectories: [[id]](./%5Bid%5D/CLAUDE.md) — single-session GET/PUT/DELETE and its action sub-routes.

## Invariants
- `busy` means exactly "a teach turn is in flight"; background jobs do not count.
- The strong slot is copied once at creation; afterwards only `PUT /api/chats/[id]/settings` writes a session's models.
- No strong slot configured → no stamp; the turn gate refuses later with 503.
- A graph-context marker, when present, is a separate custom message placed before the learner's first user message.

## Side Effects
- `POST` writes the chat store (new record, settings, optional first message) and reads the graph store (nodes, chains).

## Verification
- Run: `npm test`
