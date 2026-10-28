# app/api/settings/prompts/[...segment]

## Overview
Override text for one system-prompt segment: `PUT` writes the mirror file under `data/prompts/`, `DELETE` removes it and clears the record's ON switch in the same operation.

## Interface
- Local `segmentPathFrom(segments)` — decodes and joins the catch-all; `null` unless `isValidSegmentPath`.
- `PUT(request, ctx)` — 400 invalid path, 400 body not `{ text: string }`, 400 (with `supported`) if the path is not in `allSegmentPaths()`; `promptOverrides.writeOverride(path, text)`; returns `{ path, text }`.
- `DELETE(_request, ctx)` — 400 invalid path; clears `record.agent.prompts[path]` via `writeSettingsRecord` first, then `promptOverrides.deleteOverride(path)`; returns `{ path, deleted: true, switchCleared }`. Idempotent.

## Invariants
- Only current source segments may be overridden; no silent orphans.
- Delete order is switch-then-unlink so a crash leaves "off + file" (valid), never an orphaned ON.
- File presence alone is never the override; the switch lives in the record (`PUT /api/settings/agent`).

## Side Effects
- Writes/removes files under `data/prompts/`; may rewrite `data/settings.json`.

## Verification
- Run: `npm test`
