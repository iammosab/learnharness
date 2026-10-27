# app/api/settings/[section]

## Overview
`PUT /api/settings/[section]` writes one section of the user settings record replace-whole. Sections are independent, so partial writes never clobber each other.

## Interface
- `PUT(request, ctx)` — `section` looked up in `SETTINGS_SECTIONS` (404 with `supported` list if unknown); the section parser validates shape (400). Extra gates: `chat` → `validateChatSettings` then `clampChatLevel(..., effectiveSettings().models.strong)`; `models` → `validateModelsSettings` then `clampModelsLevels`; `agent` → orphan-heal of `prompts` switches whose segment is gone (`allSegmentPaths`) or whose override file is missing (`promptOverrides.readOverride === null`). Read-modify-write via `readSettingsRecord()` / `writeSettingsRecord(next)`; returns `{ settings: next }`.

## Invariants
- Absent fields mean absent overrides (house settings discipline).
- Thinking levels never reject a write; they clamp and the clamped value is stored.
- Orphaned ON prompt switches heal to OFF inside the write, never a 400; after every write, record and file reality agree.
- Static sibling `prompts` takes precedence over this dynamic segment.

## Side Effects
- Writes `data/settings.json` through the settings store; logs healed orphans with `console.info`.

## Verification
- Run: `npm test`
