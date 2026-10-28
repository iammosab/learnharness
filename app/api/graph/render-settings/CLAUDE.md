# app/api/graph/render-settings

## Overview
Server persistence for the graph view's rendering controls (node/edge/arrow/label sizes, label-zoom threshold, cluster-labels toggle), stored at `data/render-settings.json`.

## Interface
- `GET()` — `readRenderSettings()`: the saved settings, or `null` on first boot.
- `PUT(request)` — 400 invalid JSON; `writeRenderSettings(body)` returns the sanitized copy actually persisted.

## Invariants
- Every body passes through `sanitizeRenderSettings` before disk; garbage clamps or falls back to defaults, never throws.
- `null` on GET means the client keeps in-memory defaults.

## Side Effects
- Reads/writes `config.RENDER_SETTINGS_FILE` on disk.

## Verification
- Run: `npm test`
