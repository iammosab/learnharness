# app/api/chats/[id]/settings

## Overview
`PUT /api/chats/[id]/settings` is the only in-session writer of a session's model and thinking level. Replace-whole semantics: the picker sends the complete desired `ChatSettings` object; `{}` clears all overrides.

## Interface
- `PUT(req, { params })` — 404 unknown chat; `parseSettingsBody(body)` (400 on bad shape); `validateChatSettings` catalog gate (400 with `supported` on unknown provider/model); `clampChatLevel(settings, effectiveSettings().models.strong)`; `stores.chatStore.saveSettings(id, settings)`; returns `{ settings }`.

## Invariants
- Replace-whole, no merges: a stale client can never resurrect a cleared override.
- Thinking levels never reject; they clamp to the named model's nearest supported level and the clamped value is what is stored.
- The strong slot is only the birth default; this route never reads it except as the clamp fallback.
- Effective on the next turn by construction (agents are stateless per turn).

## Side Effects
- Writes the session's settings in the chat store.

## Verification
- Run: `npm test`
