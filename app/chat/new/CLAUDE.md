# app/chat/new

## Overview
The draft view behind "+ New session": a sessionless empty chat. No record is created until the first send, which creates the chat and redirects to `/chat/[id]?prompt=`.

## Interface
- `default async NewSessionPage({ searchParams })` — `searchParams: { mode? }`; renders `<NewSession initialConfigured={slotsConfigured(readSettingsRecord()?.models)} mode={"practice" | "teach"} />`.
- `export const dynamic = "force-dynamic"`.

## Invariants
- The static `new` segment always beats the dynamic `[id]` route; `new` is never a chat id.
- The draft's model control binds the strong slot; the created session is stamped from it server-side (`POST /api/chats`).
- Only `mode=practice` selects practice; anything else is `teach`.

## Side Effects
- Reads the settings record; no writes.

## Verification
- Run: `npm test`
