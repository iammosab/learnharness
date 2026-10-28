# app/api/settings

## Overview
The user settings record API. The root `GET` returns the whole non-secret delta record (`data/settings.json`); section writes and prompt overrides live in the children.

## Interface
- `GET()` — `{ settings: settingsStore.readSettings() }` (sanitized delta record, or `null` on first boot). `force-dynamic`.
- Subdirectories:
  - [[section]](./%5Bsection%5D/CLAUDE.md) — `PUT` one section replace-whole (`general | chat | agent | appearance | graph | compaction | models`).
  - [prompts](./prompts/CLAUDE.md) — `GET` effective prompt segments; [prompts/[...segment]](./prompts/%5B...segment%5D/CLAUDE.md) for override text.

## Invariants
- Absent keys mean factory default; resolution to concrete values is `core/settings-resolution.ts resolveSettings`, never guessed server-side.
- Secrets never enter this record (they live in `auth.json` / `.env.local`).

## Side Effects
- Root `GET` is read-only; children write `data/settings.json` and `data/prompts/`.

## Verification
- Run: `npm test`
