# app/api/graph/coverage

## Overview
Route group for extraction-coverage actions. No direct handler here; the former all-sessions coverage GET was retired, and per-session coverage is served by `GET /api/chats/[id]`.

## Subdirectories & Boundaries
- extract: [./extract/CLAUDE.md](./extract/CLAUDE.md) - `POST` manual extraction run for one session (202, 409 while in flight).
