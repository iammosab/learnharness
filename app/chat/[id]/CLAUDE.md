# app/chat/[id]

## Overview
The session page: a dynamic server component that loads one chat record and seeds the client `Chat` view with native message history, liveness, failure state, and the first-run configuration gate.

## Interface
- `default async ChatPage({ params, searchParams })` — `params: { id }`, `searchParams: { prompt? }`. `getChat(id)` → `notFound()` when missing. Renders `<Chat key={id} chatId title kind initialMessages initialError initialConfigured initialPrompt initiallyInFlight initiallyCompacting />` using `turnFailure`, `isTurnRunning`, `compactionInFlight`, `readSettingsRecord` (`@/src/server`) and `slotsConfigured` (`@/src/core`).
- `export const dynamic = "force-dynamic"`.

## Invariants
- Server-rendered per navigation; never cached.
- `initialMessages` is the record's native agent history verbatim; the client derives its view.
- A turn that outlived its client is re-attached (`initiallyInFlight`), never resurrected from a stale record.
- The `?prompt=` search param delivers turn 1 for sessions created from the draft view.

## Side Effects
- Reads the chat store and settings record on each request; no writes.

## Verification
- Run: `npm test`
