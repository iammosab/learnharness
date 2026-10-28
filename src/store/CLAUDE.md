# src/store

## Overview

The synchronous `node:fs` adapters behind the core ports. `chats.ts`,
`graph.ts`, and `jobs.ts` implement `ChatStore`, `GraphStore`, and
`JobStore`; `settings.ts`, `prompt-overrides.ts`, and `auth.ts` implement
`SettingsStore`, `PromptOverrideStore`, and `AuthStore` (all from
`src/core/ports.ts`). `render-settings.ts` is a portless free-function
adapter and `graph-format.ts` is the internal version-stamp helper for
everything under `data/graph`. These are the only modules that touch the
data directory; every path comes from `config.ts` (`PATHS`,
`LEDGER_FILES`, `*_FILE` constants) under `DATA_ROOT` (default
`ROOT/data`, movable with `LH_DATA_DIR`), with the one exception of
`AUTH_FILE` (default `ROOT/auth.json`, or `LH_AUTH_FILE`).

The storage composition root that wires these singletons is
`src/server/stores.ts`; nothing in `src/core` or `src/agent` imports this
directory (lint-enforced).

## Interface

- `auth.ts`: `authStore: AuthStore { authVars, setAuthVar, deleteAuthVar }`.
- `chats.ts`: `chatStore: ChatStore { createChat, getChat, listChats,
  saveMessages, saveTree, saveSettings, renameChat, deleteChat,
  appendTurnUsage, appendExtractionUsage }`.
- `graph.ts`: `graphStore: GraphStore { appendNode, readNodes,
  appendChain, readChains, appendCheckpoint, readCheckpoints,
  appendCoverage, readCoverage, upsertSource, readSources,
  appendSourceUsage, readPositions, writePositions, rewriteLedgers }`.
- `graph-format.ts`: `assertGraphFormat()` (read-side check; throws if
  the stamp is newer than this build), `ensureGraphFormat()` (creates
  `format.json` lazily on first write). Implements no port.
- `jobs.ts`: `jobStore: JobStore { createJob, getJob, updateJob,
  listJobs, findJobByToolCallId, deleteJobsForChat }`.
- `prompt-overrides.ts`: `promptOverrides: PromptOverrideStore
  { listOverrides, readOverride, writeOverride, deleteOverride }`.
- `render-settings.ts`: `readRenderSettings(): GraphRenderSettings | null`,
  `writeRenderSettings(raw: unknown): GraphRenderSettings`, re-export of
  `DEFAULT_RENDER_SETTINGS`.
- `settings.ts`: `readSettings()`, `writeSettings(raw)`, and
  `settingsStore: SettingsStore { readSettings, writeSettings }`.

## Invariants

- Every fs call is synchronous (`readFileSync`, `writeFileSync`,
  `appendFileSync`, `renameSync`, `unlinkSync`, `readdirSync`,
  `mkdirSync`, `rmSync`); no `fs/promises`, no `await`. Atomicity rides
  the single-process Node event loop.
- Graph ledgers (`nodes`, `chains`, `sessions`, `coverage` `.jsonl`) are
  append-only via `appendFileSync`. The only non-append path is
  `rewriteLedgers`, an explicitly destructive full rewrite used by
  deletion (`src/core/graph-deletion.ts`).
- Ledger reads tolerate corruption: blank and unparseable lines are
  skipped, a missing file reads as `[]`, and strict type guards
  (`isGraphNode`, `isGraphChain` requiring `premises.length > 0`,
  `isPosition` requiring finite x/y, ...) drop invalid lines rather than
  guess.
- No merging or derivation in the store: `readNodes` returns raw lines
  (ids may repeat), chain lines are not merged, and there is no edges
  ledger (edges are derived in `src/core/graph.ts`). The only store-side
  dedup is idempotency: `appendTurnUsage` by entry id,
  `appendExtractionUsage` / `appendSourceUsage` by `startedAt`.
  `listChats` computes `phase` / `pendingQuestion` with core helpers
  (`phaseAt3Lh`, `danglingQuestionOf`) but owns no logic of its own.
- Chats, jobs, `settings.json`, `sources.json`, `positions.json`,
  `render-settings.json`, and `auth.json` are whole-file
  read-modify-write JSON.
- Version guards: `writeChat` stamps `CURRENT_CHAT_VERSION` and
  `getChat` returns `null` for a newer record; every graph-family read calls `assertGraphFormat`; appends (`appendLine`) and `writeSourceMap` call `ensureGraphFormat`, while `rewriteLedgers` and positions do not (positions are rebuildable and skip both).
- Ids used in filenames must match `/^[A-Za-z0-9_-]+$/` (chats, jobs);
  prompt-override paths go through `isValidSegmentPath` (no traversal,
  `.md` only).
- Reads never throw on a missing or corrupt file (they return `null`,
  `[]`, or `{}`); `assertGraphFormat` is the deliberate exception.
- Singletons: each store is one module-level object literal with no
  mutable state; no caching anywhere, every call re-reads disk.

## Side Effects

- `auth.ts`: `AUTH_FILE` (outside `data/` by default). Atomic write:
  `.auth.json.tmp-<pid>` with mode 0600, `chmodSync`, `renameSync`.
- `chats.ts`: `DATA_ROOT/chats/<id>.json`; `mkdirSync`; plain
  `writeFileSync` (no tmp+rename); `deleteChat` unlinks. `createChat`,
  `renameChat`, `deleteChat` emit `chats-changed` on the core event bus;
  content writers stay silent on purpose.
- `jobs.ts`: `DATA_ROOT/jobs/<id>.json` (built as
  `path.join(PATHS.data, "jobs")`, deliberately not a `PATHS` key);
  plain `writeFileSync`; `createJob` / `updateJob` emit `jobs-changed`
  `{ chatId }`; `deleteJobsForChat` emits only when it removed a file;
  `findJobByToolCallId` scans the whole directory.
- `graph.ts`: appends to `DATA_ROOT/graph/*.jsonl` (no tmp, no fsync);
  `sources.json` plain write; `positions.json` and `rewriteLedgers` use
  `*.tmp-<uuid8>` + `renameSync`. Module-load side effect: deletes legacy
  `data/graph/edges.jsonl` and `events.jsonl` if present.
- `graph-format.ts`: reads/writes `DATA_ROOT/graph/format.json`.
- `render-settings.ts`: `DATA_ROOT/graph/render-settings.json` (inside
  the graph dir, under the format stamp; the file header's
  `data/render-settings.json` is stale), sanitized on read and write.
- `settings.ts`: `DATA_ROOT/settings.json`, sanitized with
  `sanitizeUserSettings`; no newer-version refusal.
- `prompt-overrides.ts`: `DATA_ROOT/prompts/**/*.md` read, write,
  unlink; recursive `readdirSync` walk.
- Only `chats` and `jobs` announce writes on the event bus; graph,
  settings, auth, and prompt-override writes emit nothing.

## Verification

- Run: `npm test`
- Also: `npm run lint` and `npm run typecheck`.
