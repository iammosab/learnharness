# app/settings

## Overview
Legacy settings URL. The settings surface is a modal dialog over the app (opened from the sidebar or mod+,), so this page only redirects.

## Interface
- `default SettingsPage()` — `redirect("/chat/new")` from `next/navigation`.

## Invariants
- Nothing renders here; the route exists so old links never land on a dead page.

## Side Effects
- Issues a server-side redirect; no reads or writes.

## Verification
- Run: `npm test`
