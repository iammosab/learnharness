# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

LearnHarness: a standalone learning app (Next.js 16 web app + Electron desktop shell). A **teacher agent** runs probe→teach lessons with graded questions, authors a formal **plan tree** once per session, and sessions accumulate into a persistent cross-session **knowledge graph** (propositions + reasoning chains). LLM engine is pi-ai (`@earendil-works/pi-ai`); the client protocol is the Vercel AI SDK `UIMessage` shape. BYOK: there are no default models; every role resolves from the user's model slots in `settings.json`.

Read these before non-trivial work, in order:
- `docs/architecture.md` — the canonical spec (layers, import law, six systems, invariants, seam directory, superseded decisions — do not re-litigate §13 without new evidence).
- `docs/development.md` — commands, env, layout, key mechanisms, testing strata.
- `docs/vision.md` — the living design doc with every decision.
- `AGENTS.md` — **No guessing**: design authority belongs to the human. Investigate, ask specific design questions one at a time, get the plan approved, then implement mechanically. Also: this Next.js version differs from training data — read `node_modules/next/dist/docs/` before writing Next code.

## Commands

```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # production build (standalone output)
npm test               # full suite: NODE_ENV=test tsx --test tests/*.test.ts tests/*.test.tsx (deterministic, no LLM, no network)
npm run lint           # eslint — its ONLY job is enforcing the import law
npm run typecheck      # tsc --noEmit (strict, noUncheckedIndexedAccess, verbatimModuleSyntax)

# single test file
NODE_ENV=test npx tsx --test tests/chat-flow.test.ts
# single test by name
NODE_ENV=test npx tsx --test --test-name-pattern="wake" tests/jobs.test.ts

npm run desktop:dev    # next dev + Electron shell pointed at it
npm run dev:fresh      # zero-keys, zero-data new-user simulator on :3005 (scripts/dev-fresh.sh)
npm run desktop:dist   # local signed/notarized macOS arm64 build

# native renderer tests (run under Electron's node, as CI does)
ELECTRON_RUN_AS_NODE=1 NODE_ENV=test npx electron --import tsx --test tests/pdf-native-render.test.ts tests/svg-native-render.test.ts

# one-shot data scripts (operate on the real data dir — never run against a tree you don't own)
npx tsx --env-file=.env.local scripts/import-notes.ts <dir>
npx tsx --env-file=.env.local scripts/backfill-graph.ts
```

Gates on every change (CI runs all of them): `typecheck`, `test`, `lint`, then `build` + `scripts/smoke-provider-runtime.mjs` + `scripts/build-server.mjs` + `scripts/smoke-server.mjs`.

Env (`.env.local`, secrets only): `OPENROUTER_API_KEY`; optional `GOOGLE_SEARCH_API_KEY`+`GOOGLE_CSE_ID`, `DEEPGRAM_API_KEY`, `CHROME_PATH`. Model choice is never an env var. `LH_DATA_DIR` relocates all mutable data (defaults to `./data`, git-ignored); `LH_AUTH_FILE` locates the BYOK key file.

## Architecture: the parts you must hold in your head

**Five layers, imports point inward only, machine-enforced by `eslint.config.mjs`** (four `import/no-restricted-paths` zones, all errors):

| Zone | May import |
|---|---|
| `components/**` | `@/src/core` barrel only |
| `app/**` | `@/src/core` + `@/src/server` barrels only |
| `src/core/**` | never `src/agent`, `src/server`, `src/store` |
| `src/agent/**` | never `src/server`, `src/store` (deps arrive via factory args) |

`tests/`, `scripts/`, `electron/` are outside the law. The core barrel `src/core/index.ts` must stay browser-safe; node-bound modules (`graph.ts`, `coverage.ts`, `clusters.ts`, `session-clusters.ts`, `layout-settle.ts`) are deliberately not exported from it and are imported directly by server code.

**Layers:** `app/` (route handlers = transport) and `components/` (render only) → `src/server` (composition roots + seams + the pi bridge, zero business logic) → `src/agent` (prober/teacher loops, tools, prompt fragments, sub-agents, extraction pipeline) → `src/core` (pure domain: contracts, ports, merger/derivation, coverage, question-core, plan-tree, phases, layout) → `src/store` (fs adapters implementing `core/ports.ts`, the ONLY code touching `data/`). `config.ts` holds leaf facts (paths, ledger files, thinking-level scale).

**Two composition roots.** `src/server/stores.ts` instantiates adapters and hands port objects to everything. `src/server/chat-handler.ts` wires stores, job runner, extraction pipeline, and the pi engine into one turn's stream response. Everything else is a named seam called from these.

**Six runtime systems, one writer per store:**
- Classroom (turn pipeline) → `data/chats/*.json`
- Workbench (job runner, researcher/demo-builder/visual-maker, wake pipeline) → `data/jobs/*.json`
- Library (extraction pipeline extractor→auditor→merger; the merger is the SOLE graph writer) → `data/graph/*.jsonl` append-only ledgers
- Practice (partitioner→generator→grader) → `data/practice/*.json`; writes nothing back to the graph
- Stage (`components/`) → nothing server-side
- Machine room (Electron main, standalone server, `config.ts`)

**Invariants that shape every change** (full list: architecture §9):
- Everything below the ledgers is derived at read time: graph snapshot, plan statuses (`current`/`visited` come from tagged quiz calls in the transcript, never mutated), phases, costs, coverage. Never dual-track state.
- `chains.jsonl` is the stored truth; edges are a derived view.
- Idempotency via deterministic keys (steer ids, coverage fingerprints, source hashes); re-running anything converges.
- LLMs judge, code mechanizes: grading, merging, fingerprints, layout are deterministic; a failed LLM stage checkpoints nothing.
- The persisted record is the only source of truth; agents are stateless per-turn rebuilds.
- Side channels (extraction, usage, naming) are fire-and-forget behind try/catch; they never touch the response or the persist.
- Absence is not zero: unreported tokens/prices/levels render as absent.
- Schema stamps: chat records carry `version`; graph family shares `graph/format.json`. A record newer than the build is refused on read.

**Key mechanisms worth knowing before touching them:**
- `quiz` / `ask_user_question` are client tools with no server `execute`: the call streams to the browser, the client grades via `question-core`, and returns the verdict with `addToolOutput`. Option shuffle is seeded by toolCallId so server and client agree.
- `research` / `demo` / `visual` are ack-and-steer: the tool returns immediately, a background job runs, and `src/server/jobs.ts` delivers the result as a user-role steer message via a per-chat serialized wake turn (exactly-once).
- Extraction triggers on uncovered tokens (`coverage.jsonl`) crossing `graph.extractionChunkTokens`, not on quiz counts. The same pipeline serves notes import (`POST /api/graph/import`).
- Schema changes in a `src/core/contracts/*` domain file are owned by that domain; see `docs/vision.md` before changing shapes.

## Testing conventions

- `node:test` via `tsx`; assertions with `node:assert/strict`. No LLM, no network: engines are injected using pi-ai's faux provider (`createFauxCore`, `fauxToolCall`, etc.), `globalThis.fetch` is stubbed where transport matters, and `handleChatRequest` is driven directly with plain `Request`/`Response`.
- Tests that touch storage set `process.env.LH_DATA_DIR` to a temp dir before importing stores, or backup-and-restore the real ledgers. Render tests use `renderToStaticMarkup`, no DOM library.
- **Fixture law:** `tests/fixtures/golden-data/` is a real data dir produced by the app, never hand-edited. Any intentional on-disk format change updates these fixtures in the same commit (`tests/golden-fixtures.test.ts` fails otherwise). Regenerate by running the app and copying records in verbatim.

## Repo conventions

- Tabs for indentation; `verbatimModuleSyntax` means `import type` for types; `.ts` extensions in relative imports are allowed and used.
- `data/`, `auth.json`, `*-credentials.json*`, `.fresh-data/` are never committed.
- `skills/learnharness/` is a shipped read-only skill (Python, stdlib) for reading a user's learning data; it must never write to the data folder.
- Desktop release flow (three-OS CI, signing, notarization): `docs/desktop-release.md`.

## EGM (Elephant-Goldfish Model) plugin

EGM artifact directory: .dev/egm
Approved designs go to `docs/designs/`. Never run EGM in uninterrupted mode here; the AGENTS.md no-guessing rule requires human checkpoints.

## Directory contracts (EGM Blueprint)

Every code directory carries an EGM contract named `CLAUDE.md` (Interface · Invariants · Side Effects · Verification). The root is the Blueprint; this section rolls up the subtree boundaries. Regenerate with `/egm:egm_bootstrap . target_filename=CLAUDE.md`.

### Local Interface & Invariants (root files)
- `config.ts`: leaf facts only. `PATHS` (root, data, chats, graph, debug, teacherPrompt), `LEDGER_FILES` (nodes/chains/sessions/coverage JSONL), `SOURCES_FILE`, `POSITIONS_FILE`, `RENDER_SETTINGS_FILE`, `GRAPH_FORMAT_FILE`, `SETTINGS_FILE`, `PROMPTS_OVERRIDE_DIR`, `AUTH_FILE`; types `ThinkingLevel`, `ModelRole`. `LH_DATA_DIR` relocates every mutable path; `LH_AUTH_FILE` relocates the key store; prompt assets stay `ROOT`-anchored. No model names live here (BYOK slots own them).
- `proxy.ts`: Next middleware over `/api/:path*`. Returns 403 unless `desktopAPIAuthorized(headers)` passes; no bypass for callbacks or workers.
- `next.config.ts`: `output: "standalone"`; `outputFileTracingExcludes` keep `data/`, `auth.json`, `*-credentials.json*`, `.env*` out of the bundle (`scripts/build-server.mjs` re-checks); explicit `outputFileTracingIncludes` for runtime-loaded engine/pdf/native assets; `serverExternalPackages` for pi-ai, pi-agent-core, pdfjs-dist, @napi-rs/canvas, @resvg/resvg-js. Exclude patterns are load-bearing; read the file's comments before touching them.
- `eslint.config.mjs`: the import law only (four zones). `tsconfig.json`: strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `@/*` alias. `components.json`: shadcn new-york config. `postcss.config.mjs`: Tailwind v4.

### Subdirectories & System Boundaries
- app: [./app/CLAUDE.md](./app/CLAUDE.md) — Next App Router: layout/pages + 32 transport-only route handlers under `app/api` (each leaf a single `route.ts` delegating to `@/src/server`).
- components: [./components/CLAUDE.md](./components/CLAUDE.md) — the Stage: session UI, question dock, plan blocks, graph canvas, sidebar, keyboard machine, dictation; imports only `@/src/core`; IO via `/api/*` and one EventSource. Children: `ai-elements`, `artifacts` (tool-renderer registry), `settings`, `ui`.
- src: [./src/CLAUDE.md](./src/CLAUDE.md) — the four server-side layers: `core` (pure domain + `contracts/`), `agent` (prober/teacher/practice agents, `tools/`, `subagents/` incl. the extraction pipeline), `server` (composition roots, seams, `pi/` wire bridge), `store` (fs adapters, sole `data/` writers).
- electron: [./electron/CLAUDE.md](./electron/CLAUDE.md) — desktop shell: spawns the standalone server on 127.0.0.1, owns subscription/ChatGPT credential stores, IPC leases, updater, hidden CDP helper. Lint-exempt.
- scripts: [./scripts/CLAUDE.md](./scripts/CLAUDE.md) — packaging gates (smoke-provider-runtime → build-server → smoke-server), icon/release tooling, and one-shot data scripts that are deliberate extra graph writers. Lint-exempt.
- lib: [./lib/CLAUDE.md](./lib/CLAUDE.md) — `cn()` only.
- public: [./public/CLAUDE.md](./public/CLAUDE.md) — static assets; `worklets/` holds the dictation PCM AudioWorklet.
- skills: [./skills/CLAUDE.md](./skills/CLAUDE.md) — shipped read-only Python skill for reading a user's learning data (`skills/learnharness`).
- Not contracted (no code): `docs/`, `build/`, `tests/` (test-only; see Testing conventions above), `src/agent/prompts/` (markdown prompt fragments), `public/fonts`, `public/siwc`.

### Global Invariants
- Imports point inward (lint-enforced zones above); the two barrels `src/core/index.ts` and `src/server/index.ts` are the entire public API of `src/`.
- One writer per store: turn pipeline → chats; job runner → jobs; `mergeFindings` (via the extraction pipeline) → graph nodes/chains, with `graph-deletion.ts` the only other ledger rewriter; positions via `settleGraphLayout`, deletion orphan pruning, and the positions PUT.
- Everything below the ledgers is derived at read time; idempotency via deterministic ids (steer ids, coverage fingerprints, source hashes).
- Secrets live only in `auth.json`/`.env.local` (and Electron userData credential files), never in `settings.json`, the standalone bundle, or the renderer.
- Cross-route runtime registries (turn liveness, wake pipeline, aborts, semaphores) live on `globalThis` under `__lh*` keys or `Symbol.for("lh.*")`; one server process per data directory.

### Global Side Effects
- Disk: everything under `LH_DATA_DIR` (default `./data`): `chats/`, `jobs/`, `graph/` ledgers + `format.json`, `positions.json`, `render-settings.json`, `settings.json`, `prompts/`, `debug/`; plus `AUTH_FILE` and `*-credentials.json` beside it.
- Network: LLM providers via pi-ai (OpenRouter and BYOK providers), ChatGPT/Copilot/xAI subscription endpoints, Deepgram (token minting server-side; audio browser→Deepgram), Tavily/Brave/Google CSE search, generic `web_fetch`, electron-updater feed.
- Processes: Electron spawns the standalone Next server; demo verification and SVG rendering spawn the app's own Chromium browser-service (system Chrome fallback).

### System Verification
- Run: `npm run typecheck && npm test && npm run lint` (CI order), then `npm run build && node scripts/smoke-provider-runtime.mjs && node scripts/build-server.mjs && node scripts/smoke-server.mjs` for the packaging gate.
