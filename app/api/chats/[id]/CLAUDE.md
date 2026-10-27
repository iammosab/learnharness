# app/api/chats/[id]

## Overview
Single-session resource: full record read (with liveness, cost, coverage), rename, and explicit-mode deletion. Child directories hold the session's action endpoints (artifact UI toggle, dismissal, markdown export, per-session settings, steering, the SSE turn stream).

## Interface
- `GET(_req, { params })` — 404 unknown chat; else the record spread plus `messages` (native agent history, verbatim), `pricing: sessionCost(chat)`, `turnInFlight`, `turnError: turnFailure(id)`, `compacting`, `coverage: sessionCoverage(id)`.
- `PUT(req, { params })` — rename; 404 unknown chat (checked before the body is read); body `{ title }` must be a non-empty trimmed string (400); `stores.chatStore.renameChat(id, title)`; returns `{ title }`.
- `DELETE(req, { params })` — `?mode=preserve-graph|delete-nodes` is required (400 `bad_mode`); `await deleteChatSession(id, mode)`; error outcomes forward `{ error, code, jobIds? }` with the server's status (404 `not_found`, 409 turn/job running, 503 extraction winding down); success `{ ok, mode, stats, jobsRemoved, graphRevision }`.
- Subdirectories:
  - [artifact-ui](./artifact-ui/CLAUDE.md) — persist a demo/figure steer's invert toggle.
  - [dismiss](./dismiss/CLAUDE.md) — silent ESC dismissal of a pending question.
  - [markdown](./markdown/CLAUDE.md) — session export as a markdown attachment.
  - [settings](./settings/CLAUDE.md) — per-session model/thinking settings (replace-whole).
  - [steer](./steer/CLAUDE.md) — mid-turn steering message for a running turn.
  - [stream](./stream/CLAUDE.md) — the per-chat SSE turn wire (replay + live).

## Invariants
- Messages are served verbatim; the client derives its view (`core/view.ts projectView`).
- Rename never bumps `updatedAt` (must not reorder the sidebar).
- Deletion mode has no default; `preserve-graph` keeps every merged graph contribution, `delete-nodes` erases the session's ledger traces and orphaned nodes.
- Gates for deletion live in `src/server/chats.ts deleteChatSession`, not here.

## Side Effects
- `PUT` writes the chat store; `DELETE` removes the session record, its jobs, coverage/checkpoint rows, and (in `delete-nodes` mode) graph ledger lines, bumping `graphRevision`.

## Verification
- Run: `npm test`
