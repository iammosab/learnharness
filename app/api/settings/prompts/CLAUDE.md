# app/api/settings/prompts

## Overview
`GET /api/settings/prompts` returns the effective system-prompt segments for both agents, derived from source at runtime with override text and switch state.

## Interface
- `GET()` — `{ prober: PromptSegmentInfo[], teacher: PromptSegmentInfo[] }` from `effectivePromptSegments(agent, switches)` where `switches = readSettingsRecord()?.agent?.prompts ?? {}`. `PromptSegmentInfo = { path, sourceText, overrideText, enabled, shared }` (declared in `src/core/prompt-segments.ts`).
- Subdirectories: [[...segment]](./%5B...segment%5D/CLAUDE.md) — `PUT`/`DELETE` override text for one segment.

## Invariants
- The shared base appears in both lists under the same path (`system-prompt.md`).
- Switches are written via `PUT /api/settings/agent`, text via the catch-all child; this route only reads.

## Side Effects
- Read-only over source prompt segments, override files, and the settings record.

## Verification
- Run: `npm test`
