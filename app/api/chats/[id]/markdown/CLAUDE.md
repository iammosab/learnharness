# app/api/chats/[id]/markdown

## Overview
`GET /api/chats/[id]/markdown` exports a whole session as one markdown file through the same session-markdown engine the extractor reads, minted without anchors.

## Interface
- `GET(_req, ctx)` — 404 unknown chat; else `sessionMarkdown(record.messages, { title, anchors: false })` from `@/src/core` returned as `text/markdown; charset=utf-8` with `Content-Disposition: attachment; filename="<slug>.md"`.
- Local helper `slugify(title)` — lowercase NFKD, non-alphanumerics to `-`, trimmed; falls back to `session`.

## Invariants
- Export carries no message ids (anchors are extraction provenance only).
- Both `teach` and `practice` sessions export through the same engine.

## Side Effects
- Read-only over the chat store.

## Verification
- Run: `npm test`
