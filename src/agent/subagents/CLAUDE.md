# src/agent/subagents

## Overview

The background agent layer. `createJobRunner` runs the four job kinds
(research, demo, visual, pdf) against an injected `JobStore` and
`ChatStore` and hands finished results to an injected `deliver(steer)`.
`createExtractionPipeline` is the extract, audit, and merge pipeline that
builds the knowledge graph from chats (`runExtraction`) and notes files
(`importNotes`). The other files are the pieces those two use: a shared
pi `Agent` wrapper (`pi-run.ts`), a single-submit-tool wrapper
(`submit-agent.ts`), an abort registry, a process-wide background LLM
semaphore, the individual agents (researcher, demo-builder,
visual-maker, pdf-reader), and the headless-Chrome and pdfjs layers.

Stores arrive only as port types from `src/core/ports.ts`; the
provider-key check and the search provider are injected callbacks, so
this layer never reads the key store. Node ids, chain ids, provenance,
and merge decisions live in `src/core/graph.ts` (`mergeFindings`), which
this pipeline calls.

## Interface

- `runner.ts`: `createJobRunner(deps: JobRunnerDeps { chatStore,
  jobStore, deliver(steer): Promise<void>, engineFor?, searchProvider?,
  providerKeyMissing? }) -> JobRunner { runJob(jobId, input?) }`; test
  seams `researchModelOverride`, `demoModelOverride`,
  `visualModelOverride`, `pdfModelOverride` (`{ current?: PiEngine }`).
- `extraction.ts`: `createExtractionPipeline(deps: ExtractionPipelineDeps
  = GraphDeps { chatStore, graphStore } & ExtractionModels { extractor?,
  auditor?, engineFor?, providerKeyMissing? } & { getChunkTokens? })
  -> ExtractionPipeline { runExtraction(chatId), importNotes({ filePath,
  text }) }`; `extractionStatuses()`, `abortExtraction(chatId)`,
  `class NotesImportError` (outcome `failed | partial | aborted | busy`),
  `transcriptView`, `sourceDigest`, `callUsage`; prompt constants
  `EXTRACTOR_INSTRUCTIONS`, `NOTES_EXTRACTOR_INSTRUCTIONS`,
  `EXTRACTION_CORE`, `SESSION_PREAMBLE`, `NOTES_PREAMBLE`,
  `SESSION_MESSAGE_ID_RULE`; types `ExtractionPhase`,
  `RunningExtraction`.
- `pi-run.ts`: `runSubagent(tools: AgentTool[], opts: SubagentRunOptions
  { role, engine?, systemPrompt, prompt | messages, maxTurns,
  shouldStop?, abortSignal?, onUsage?, onAssistantMessage?,
  onToolStart?, chatId? }) -> SubagentRunResult`;
  `subagentEngine(role, override?)`.
- `aborts.ts`: `registerJobAbort(jobId, controller)`,
  `unregisterJobAbort(jobId)`, `isJobLive(jobId)`,
  `fireJobAbort(jobId): boolean`.
- `bg-llm-semaphore.ts`: `withBgLlmSlot<T>(signal, critical)`,
  `bgLlmSlots()`, type `LlmSlots`.
- `submit-agent.ts`: `runSubmitAgent<T>(opts)` (maxTurns default 4),
  `healStringifiedArrays(raw)`.
- `researcher.ts`: `runResearcherAgent(prompt, opts: ResearcherRunOptions):
  Promise<string>` (maxTurns 12; tools from `createWebTools` +
  `createPdfReadTools`).
- `demo-builder.ts`: `runDemoBuilder(input, opts): Promise<DemoResult>`
  (maxTurns `opts.maxSteps ?? 24`), `createDemoBuilderTools(state,
  headless, onActivity)`.
- `visual-maker.ts`: `runVisualMaker(input, opts): Promise<VisualResult>`,
  `createVisualTools()`.
- `pdf-reader.ts`: `runPdfReaderAgent(input: PdfReaderInput, opts)`,
  `createPdfTools(_pdfPath)` (the path argument is unused).
- `headless.ts`: `HeadlessApi`, `realHeadless`, `getHeadless()`,
  `headlessOverride { current? }`, `resolveChromeExecutablePath()`,
  `browserServiceBinary()`, `browserServiceSpawnEnv()`,
  `parseBrowserServiceLine()`, `providerSafePng(png)`; types
  `DemoRunResult`, `RunDemoOptions`, `RenderSvgOptions`,
  `RenderPdfOptions`, `RenderedPdfPage`.
- `pdf-ops.ts`: `pdfProbe`, `pdfInfo`, `pdfExtract(filePath, pageSpec)`,
  `pdfSearch`, `parsePageSpec(spec, total)`, `renderDir(filePath)`,
  `standardFontsDir()`; types `PdfInfo`, `PdfPageInfo`, `PdfSearchHit`.

## Invariants

- Import law: no file here imports `src/server` or `src/store`
  (lint-enforced). Dependencies are `src/core` ports, sibling agent modules (`../models.ts`, `../provider-events.ts`, `../tool-execute.ts`, `../subscription-request-cycle.ts`), `../tools/*`, `config.ts`, and third-party packages.
- Sole graph writer: the pipeline's direct `GraphStore` calls are
  `readCoverage`, `appendSourceUsage` (notes runs), and `upsertSource`
  (`importNotes`). Node and chain writes go only through
  `mergeFindings(chatId, findings, auditResult, { chatStore, graphStore })`
  in `src/core/graph.ts`, and position writes only through
  `settleGraphLayout(graphStore)` (`src/core/layout-settle.ts`); both run
  after each merged batch.
- Extraction is single-flight per source (`inFlight` set on
  `globalThis.__lhExtractionRuns`): a second `runExtraction` for the same
  chat is a no-op returning `{ nodes: 0, chains: 0 }`; `importNotes`
  throws `NotesImportError("busy")` instead.
- Background LLM concurrency cap: `withBgLlmSlot` holds
  `PERMIT_COUNT = 3` permits, FIFO, stored process-wide on
  `globalThis.__lhLlmSlots`; a queued caller whose signal aborts rejects
  with an `AbortError`; released permits pass directly to the next live
  ticket. Only extraction chunks use it today; runner jobs are not
  capped by it.
- Audits are serialized by one process-wide FIFO promise-chain mutex
  (`globalThis.__lhAuditLock`); waiting on it is abortable.
- `abortExtraction(chatId)` aborts every chunk job of a source (registry
  keys `chatId` or `chatId#i`); each `RunningExtraction` owns an
  `AbortController` whose signal reaches every model call.
- Job abort is a real kill: `makeLoopContext` registers an
  `AbortController` via `registerJobAbort` and passes its signal into
  every model call; `fireJobAbort` removes the controller before aborting
  so a second call returns `false`; `runJob` always calls
  `unregisterJobAbort` in `finally`. The registry lives on
  `globalThis.__lhJobAborts`. Abort bookkeeping for the job record lives
  in `src/server/jobs.ts` (`abortJob`); this layer only unwinds.
- Job record ownership: the runner writes terminal state only while
  `job.status === "running"`; once the abort route flips the status the
  runner unwinds silently and the route owns the record and the abort
  steer. The usage write in `finally` is a merge patch that never
  resurrects an aborted job.
- `finishJob` writes result, status `done | error`, and
  `delivery { kind: "result", status: "pending" }` in one `updateJob`,
  then calls `void deliver(buildSubagentSteer(job, result))`. Delivery
  is never awaited; the pending obligation is persisted on the record.
- Refusals: if no engine is configured for the role (BYOK) or the
  provider key is missing, the runner records an error and steers a
  kind-shaped failure result through `finishJob` rather than hanging.
- `NotesImportError` documents that earlier graph writes are kept on
  failed, partial, or aborted notes runs.

## Side Effects

- `runner.ts`: `jobStore.getJob/updateJob` (usage, activity, error,
  result, status, delivery), `chatStore.getChat`, calls `deliver()`,
  `node:fs/promises` / `os` / `path` for temp files, spawns LLM
  sub-agents through the per-kind runners.
- `extraction.ts`: LLM calls (extractor via `runSubmitAgent`, auditor
  via `runSubagent` with `auditorGraphTools`), `node:crypto` for the
  `src_` source id hash, graph writes as listed above,
  `chatStore.getChat` and `chatStore.appendExtractionUsage`,
  `emit("activity-changed")` on the core event bus.
- `pi-run.ts`: one pi `Agent` per call with a `randomUUID` session id;
  network streaming through `engine.streamFn`; optional provider-event
  recorder.
- `researcher.ts`: LLM plus network through the web tools and PDF read
  tools. `demo-builder.ts`: LLM plus headless Chrome via `getHeadless()`.
  `visual-maker.ts` / `pdf-reader.ts`: raw `streamFn` loops (not
  `runSubagent`), headless SVG/PDF rendering to PNG; pdf-reader reads
  files via `resolveSourcePath` and `pdf-ops`.
- `headless.ts`: `node:fs`, `os`, `path`; dynamically imported
  `node:child_process` spawns the Electron binary with
  `--browser-service`, fetches `http://127.0.0.1:<port>/json/version`,
  connects with `puppeteer-core`, falls back to `puppeteer.launch` with
  system Chrome.
- `pdf-ops.ts`: `node:fs/promises` reads and a dynamic import of
  `pdfjs-dist/legacy`; read-only.
- `aborts.ts`, `bg-llm-semaphore.ts`: in-memory `globalThis` state only.

## Verification

- Run: `npm test`
- Also: `npm run lint` and `npm run typecheck`.
