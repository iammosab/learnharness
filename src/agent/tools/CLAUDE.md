# src/agent/tools

## Overview

The agent tool registries. Most tools are factories that receive their
stores and callbacks from the composition root (`jobTools`, `planTools`,
`probeDoneTool`, `proberGraphTools`, `auditorGraphTools`,
`practiceTools`, `createWebTools`, `createPdfReadTools`). The rest are
module-level singletons: the learner-filesystem tools (`readTool`,
`lsTool`, `findTool`, `grepTool`) and `sendToUserTool`. Almost every
execute goes through `serverExecute` (`src/agent/tool-execute.ts`),
`heal.ts` repairs JSON-encoded arguments before TypeBox validation, and
`mermaid-plan.ts` is a pure parser behind `plan_init`.

## Interface

- `fs-shared.ts`: `MAX_OUTPUT_BYTES` (50 KB), `GREP_MAX_LINE_LENGTH`
  (500), `WALK_TIMEOUT_MS` (10 s), `resolveSourcePath`, `formatSize`,
  `capOutput`, `expandBraces`, `globToRegex`, `matchGlob`, `walkFiles`,
  `isBinaryFile`, `truncateGrepLine`.
- `jobs.ts`: `JobToolContext { chatId, jobStore: JobStore, spawn(job,
  input), searchAvailable? }`, `researchInputSchema`, `demoInputSchema`,
  `visualInputSchema`, `pdfInputSchema`, `jobTools(ctx) -> { research,
  demo, visual, pdf }`; types `ResearchInput`, `DemoInput`,
  `VisualInput`, `PdfInput`.
- `graph.ts`: `GraphToolContext { chatStore, graphStore }`,
  `proberGraphTools(ctx) -> { list_sessions, list_propositions }` (names
  only), `auditorGraphTools(ctx) -> { find, list_sessions,
  list_propositions }` (full statement text).
- `plan.ts`: `PlanToolContext { chatId, chatStore }`,
  `planTools(ctx) -> { plan_init }`.
- `practice.ts`: `PracticeToolContext { chatId, chatStore (getChat only),
  graphNodes?, graph?: GraphToolContext, jobs?: JobToolContext }`,
  `PracticeGate { problemActive }`, `createPracticeGate`,
  `problemInputObject`, `ProblemInput`, `problemTool(gate, graphNodes?)`,
  `concludeInputObject`, `ConcludeInput`, `concludeTool(gate)`,
  `practiceTools(ctx)` -> healed record of `problem`, `conclude`, `read`,
  `ls`, `find`, `grep`, and optionally `research`, `pdf`,
  `list_sessions`, `list_propositions`.
- `probe.ts`: `ProbeDoneContext { chatId, chatStore, deliver(steer) }`,
  `probeDoneTool(ctx) -> { probe_done }`.
- `web.ts`: type `WebSearchResult` (= core `SearchHit`),
  `createWebTools(search: () => SearchProvider | null) -> { web_search,
  web_fetch }`, `webTools = createWebTools(() => null)`.
- `pdf-read.ts`: `PdfFetchSummary`, `createPdfReadTools(dir) ->
  { web_fetch_pdf, pdf_info, pdf_extract, pdf_search }`.
- `heal.ts`: `healEncodedArguments` (re-export of
  `src/core/argument-heal.ts`), `withArgumentHeal(tool)`,
  `healToolRecord(tools)`.
- `send-to-user.ts`: `sendToUserTool` (name `SEND_TO_USER_TOOL`; returns
  the fixed string "Message received for display.").
- `find.ts` / `grep.ts` / `ls.ts` / `read.ts`: `findTool`, `grepTool`,
  `lsTool`, `readTool` (singletons, no dependencies).
- `mermaid-plan.ts`: `ParsedPlan`, `PlanParseResult`,
  `parseMermaidPlan(mermaid)` (pure).

## Invariants

- Import law: no file here imports `src/server` or `src/store`. Server
  functionality arrives only as injected callbacks: `spawn` in `jobs.ts`,
  `deliver` in `probe.ts`, the search-provider getter in `web.ts`.
- No tool writes the knowledge graph. `graph.ts` reads only, through
  `getGraph`, `graphSessionIndex`, `graphSessionPropositions`; it calls
  no write method on `GraphStore`. The extraction merger remains the
  sole graph writer.
- The learner-filesystem tools (`read`, `ls`, `find`, `grep`) are
  read-only by construction (only `readFile`, `readdir`, `stat`,
  open-for-read) but NOT path-sandboxed: `resolveSourcePath` keeps an
  absolute path as given and joins relative/missing paths onto
  `os.homedir()`. There is no allowed-roots list; this is a documented
  user decision ("Unrestricted local reads are the user-decided v0
  scope" in `read.ts`). Limits are on output and walking only: walks
  skip `node_modules`, `.git`, `Library`, `.Trash`, do not follow
  symlinks, and stop after 10 s; grep skips files over 2 MB or with a
  NUL byte; output is capped at 50 KB; read stops at 2000 lines or 50 KB.
- `pdf-read.ts` is sandboxed: `scopedPath(dir, p)` refuses anything not
  under `path.resolve(dir) + sep`, so `pdf_info` / `pdf_extract` /
  `pdf_search` only touch the per-job download directory.
- Store mutations by tools: `plan_init` calls `chatStore.saveTree`;
  `jobTools` calls `jobStore.createJob`, which is idempotent per
  `toolCallId` (`findJobByToolCallId` first; `spawn` only for a new job);
  `probe_done` calls `deliver(buildProbeHandoffSteer(chatId))` and writes
  nothing itself; `problem` / `conclude` flip only the in-memory
  `PracticeGate.problemActive` (created once per turn from
  `activeProblemOf(record.messages)`).
- Argument healing: `withArgumentHeal` runs the tool's own
  `prepareArguments` first, then `healEncodedArguments(args,
  tool.parameters)`, all before TypeBox validation; it is idempotent and
  returns well-formed arguments as the same reference.
- Expected failures are returned, not thrown: `web.ts` and `pdf-read.ts`
  return error strings; `plan_init` and `probe_done` return
  `{ ok: false, error }` so the model can retry. The fs tools throw
  (path not found, not a directory) and `serverExecute` converts that
  into an error result.
- Results stay small: `plan_init` returns only node ids plus a reminder
  and puts the full tree in `details`; `probe_done` returns the fixed
  `PROBE_DONE_ACK_TEXT`.
- Tool names collide on purpose across registries (`auditorGraphTools.find`
  vs `findTool`); those registries must never be merged.

## Side Effects

- `fs-shared.ts`, `read.ts`, `ls.ts`, `find.ts`, `grep.ts`: filesystem
  reads anywhere under the resolved path (home by default); no writes;
  images come back as base64 `ImageFileResult`.
- `web.ts`: network. `web_search` calls the injected `SearchProvider`
  (Tavily/Brave; Google CSE is retired). `web_fetch` does a direct
  `fetch` with a Chrome user agent, 30 s timeout, 5 MB limit, Readability
  + Turndown extraction, Jina Reader (`https://r.jina.ai/<url>`)
  fallback. Only http(s) URLs are accepted; there is no private-IP /
  SSRF filter.
- `pdf-read.ts`: network fetch (60 s timeout, 25 MB cap),
  `fs.writeFile` into `dir`, `fs.rm` if the probe fails, then
  `src/agent/subagents/pdf-ops.ts` reads.
- `jobs.ts`: `jobStore.findJobByToolCallId`, `jobStore.createJob`, then
  `ctx.spawn(job, input)` (starts the background runner).
- `plan.ts`: `chatStore.getChat`, `chatStore.saveTree`.
- `probe.ts`: `chatStore.getChat`, `ctx.deliver(steer)`; a deliver
  failure is logged with `console.error` and swallowed.
- `graph.ts`, `practice.ts`: reads only (plus the effects of the tools
  practice includes).
- `send-to-user.ts`, `heal.ts`, `mermaid-plan.ts`: none.

## Verification

- Run: `npm test`
- Also: `npm run lint` and `npm run typecheck`.
