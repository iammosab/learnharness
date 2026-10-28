# app/api/graph/import

## Overview
`POST /api/graph/import` is the format-agnostic notes front door: multipart files in, one extraction run per file through the same pipeline sessions use, with a 3-wide worker pool to stay under provider rate limits.

## Interface
- `POST(request)` — `formData()` field `files` (400 `no files` when empty). For each file: `extraction.importNotes({ filePath: file.name, text })`. Returns `{ results: ImportResult[] }`.
- `ImportResult` (local type): `{ requestIndex, outcome: "completed" | "failed" | "partial" | "aborted" | "busy", filePath, ok, stats?, error?, code?, missing?, provider?, slots? }`.
- Config refusals map to `code: "models_not_configured"` (`ModelsNotConfiguredError`) or `PROVIDER_KEY_MISSING_CODE` (`ProviderKeyMissingError`); `NotesImportError` forwards its `outcome`, with `partialStats` copied into the result's `stats` field.

## Invariants
- At most 3 concurrent imports; results are collected per file, never aborting the batch on one failure.
- Response waits for every worker to finish (not fire-and-forget, unlike coverage/extract).

## Side Effects
- Model calls through the extraction pipeline; persists source records and graph ledger merges; registry rows visible on `/api/graph/status`.

## Verification
- Run: `npm test`
