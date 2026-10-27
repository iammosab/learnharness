# src

## Overview

The four layers of the learnharness server-side architecture, each a
directory with its own contract. `src` itself holds no source files. The
import law (`eslint.config.mjs`, machine-enforced; canonical description
in `docs/architecture.md`): dependency arrows point inward only.
`core` imports nothing below itself; `agent` never imports `server` or
`store` (dependencies arrive via factory arguments); `server` is the
only layer that wires `store` adapters to `core` ports and `agent`
factories; `app/` sees only the two barrels `src/core/index.ts`
(browser-safe) and `src/server/index.ts`; `components/` sees only the
core barrel.

Runtime ownership: `src/store/*` are the only modules that write records in the data directory (known exceptions: `src/server/graph.ts` stats ledger mtimes for `graphRevision`; `src/agent/provider-events.ts` appends debug JSONL under `data/debug/` when `LH_PROVIDER_EVENTS` is set); the extraction merger (`src/core/graph.ts`
`mergeFindings`, called from `src/agent/subagents/extraction.ts`) is the sole appender of graph nodes and chains (`src/core/graph-deletion.ts` is the one other ledger writer, via `rewriteLedgers`); the job runner owns job records
through the injected `JobStore`; the turn pipeline owns chat records
through the injected `ChatStore`.

## Subdirectories & Boundaries

- core: [./core/CLAUDE.md](./core/CLAUDE.md) - pure domain: contracts,
  storage port types, graph merger and derivation, coverage, question
  engine, plan tree, phases, settings resolution, layout, pricing, the
  notify-only event bus. Browser-safe barrel `index.ts`; node-bound modules (`graph.ts`, `coverage.ts`, `session-clusters.ts`, `layout-settle.ts`) are imported directly by the server; `clusters.ts` is used only by `graph.ts`. Child: [./core/contracts/CLAUDE.md](./core/contracts/CLAUDE.md)
  - one domain-contract file per domain.
- agent: [./agent/CLAUDE.md](./agent/CLAUDE.md) - prober / teacher /
  practice agent factories, engine resolution (`piEngineForSpec`),
  prompt-segment composition, ChatGPT and native-subscription bridges.
  Children: [./agent/subagents/CLAUDE.md](./agent/subagents/CLAUDE.md)
  (job runner, extraction pipeline, background agents, headless
  Chrome, pdfjs) and [./agent/tools/CLAUDE.md](./agent/tools/CLAUDE.md)
  (tool registries and factories). `agent/prompts/` is markdown only.
- server: [./server/CLAUDE.md](./server/CLAUDE.md) - the server barrel,
  the storage composition root (`stores.ts`), the turn composition root
  (`chat-handler.ts`), and named seams (liveness, wake pipeline,
  compaction, keys, model catalog, search, SSE events). Child:
  [./server/pi/CLAUDE.md](./server/pi/CLAUDE.md) - pi-agent-core to
  SSE wire bridge and tool-call id uniquifier.
- store: [./store/CLAUDE.md](./store/CLAUDE.md) - synchronous `node:fs`
  adapters implementing the core ports (`chatStore`, `graphStore`,
  `jobStore`, `settingsStore`, `promptOverrides`, `authStore`) plus the
  portless `render-settings.ts`; append-only JSONL graph ledgers with
  corrupt-line-tolerant reads; whole-file JSON for everything else.

## Verification

- Run: `npm test`
- Also: `npm run lint` (import law) and `npm run typecheck`.
