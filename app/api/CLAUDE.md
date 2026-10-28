# app/api

## Overview
The Next.js App Router REST surface. Every leaf holds a single `route.ts` that is transport only: it parses the request, calls an entry point from the `@/src/server` barrel (pure helpers from `@/src/core`), and maps the outcome to a status code. Domain logic, stores, and model calls never live here.

## Subdirectories & Boundaries
- activity: [./activity/CLAUDE.md](./activity/CLAUDE.md) - `GET` dock feed; [activity/abort](./activity/abort/CLAUDE.md) `POST` abort for jobs/extractions/turns.
- chat: [./chat/CLAUDE.md](./chat/CLAUDE.md) - `POST` turn submission (ack only; reply rides the chat stream).
- chats: [./chats/CLAUDE.md](./chats/CLAUDE.md) - session list/create; [chats/[id]](./chats/%5Bid%5D/CLAUDE.md) single-session read/rename/delete plus artifact-ui, dismiss, markdown, settings, steer, stream.
- events: [./events/CLAUDE.md](./events/CLAUDE.md) - `GET` SSE notification channel over the core event bus.
- graph: [./graph/CLAUDE.md](./graph/CLAUDE.md) - graph view, costs, extraction (coverage/extract, import), node delete, positions, render settings, status.
- jobs: [./jobs/CLAUDE.md](./jobs/CLAUDE.md) - `GET` chat-scoped sub-agent job status.
- keys: [./keys/CLAUDE.md](./keys/CLAUDE.md) - masked key list; [keys/[id]](./keys/%5Bid%5D/CLAUDE.md) save/delete one key.
- models: [./models/CLAUDE.md](./models/CLAUDE.md) - `GET` model catalog DTOs.
- search: [./search/CLAUDE.md](./search/CLAUDE.md) - `GET` search-engine availability.
- settings: [./settings/CLAUDE.md](./settings/CLAUDE.md) - settings record; [settings/[section]](./settings/%5Bsection%5D/CLAUDE.md) section writes; [settings/prompts](./settings/prompts/CLAUDE.md) prompt segments and overrides.
- stt: [./stt/CLAUDE.md](./stt/CLAUDE.md) - group for [stt/token](./stt/token/CLAUDE.md), Deepgram token mint.
- subscriptions: [./subscriptions/CLAUDE.md](./subscriptions/CLAUDE.md) - subscription-connection controls; [subscriptions/browser](./subscriptions/browser/CLAUDE.md) browser flow.
