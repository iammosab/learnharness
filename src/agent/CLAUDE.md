# src/agent

## Overview

The agent layer. It builds the three stateless per-turn pi-agent-core
`Agent`s (prober, teacher, practice) from the persisted transcript,
composes their system prompts from markdown segments plus optional
override files, and assembles their tool registries. `models.ts` turns a
resolved model spec into a pi-ai engine (`model` + `streamFn`). The
ChatGPT and native-subscription bridges obtain credentials through
desktop IPC or a server-injected web runtime and route requests through
an admission/lease cycle that never falls back to an API key.

Storage and server wiring always arrive through factory arguments (tool
context objects, `AgentBuildOptions`, `configureWebSubscriptionRuntime`);
this layer never imports `src/server` or `src/store` (lint-enforced).
Background work lives in `subagents/`, tool registries in `tools/`.

## Interface

- `teacher-agent.ts`: `AgentKind = "prober" | "teacher" | "practice"`,
  `composeInstructions(kind, switches?)`, `AgentBuildOptions { engine?,
  callPurpose?, requestCycle?, messages?, onUsage?, tools?, toolToggles?,
  promptSwitches?, chatId? }`, `createProberAgent(ctx:
  ProberToolContext, opts?)`, `createTeacherAgent(ctx?:
  TeacherToolContext, opts?)`, `createPracticeAgent(ctx:
  PracticeToolContext, opts?)`, `bareQuestionTools()`, types
  `ProberAgent`, `TeacherAgent`, `PracticeAgent`, `TeachingAgent`,
  `StepUsageCollector`.
- `tools.ts`: `askUserQuestionTool`, `probeQuizTool` (name `probe`),
  `probeExplainTool` (name `recall`), `teachExplainToolFor(ctx)`,
  `teachQuizToolFor(ctx)`, `ProberToolContext`, `createProberTools(ctx,
  enabled?)`, `TeacherToolContext`, `quizMechanics(enabled?)`,
  `createTeacherTools(ctx, enabled?)`; re-exports `jobTools`,
  `ProbeDoneContext`.
- `models.ts`: `APP_IDENTITY`, `PiEngine { model, streamFn, level? }`,
  `ThinkingLevel`, `piModels()`, `openRouterApiKey()`,
  `ResolvedModelSpec { provider, id, thinkingLevel? }`,
  `piEngineForSpec(spec, background, lifecycle?)`, `piEngineFor(role)`
  (always throws; the agent layer cannot read settings).
- `tool-execute.ts`: `toolTimeoutMs { current: 30000 }` (test seam),
  `invalidInputResult(toolName, problems)`, `ImageFileResult`,
  `toToolResult(result)`, `ToolExecuteContext`, `serverExecute(toolName,
  schema, run)`, `questionResult()`, `problemResult()`,
  `concludeResult()`.
- `prompt-segments.ts`: `readPromptOverride(segmentPath)`,
  `listSourceSegments(agent)`, `effectivePromptSegments(agent,
  switches)`, `allSegmentPaths()`.
- `provider-events.ts`: `providerEventsCap`, `providerEventsDir`,
  `providerEventsEnabled()`, `providerEventObserver(chatId, context)`,
  `providerEventNote(chatId, context, text)`.
- `subscription-runtime.ts`: `configureWebSubscriptionRuntime(request)`,
  `webSubscriptionsEnabled()`, `onWebSubscriptionPacket`,
  `publishWebSubscriptionPacket`, `webSubscriptionRequest`.
- `subscription-connections.ts`: `isSubscriptionProvider`,
  `subscriptionConnected`, `connectionBackgroundAllowed`,
  `connectionScopeCurrent`, `onSubscriptionChange`.
- `subscription-request-cycle.ts`: `AdmissionScope`, `NoDispatchKind`,
  `markUnadmittedUsage`, `usageWasAdmitted`,
  `SubscriptionDispatchLifecycle`, `class SubscriptionRequestCycle`
  (`prepare`, `hold`, `bindRelease`, `captured`, `beforeDispatch`,
  `noDispatch`, `acceptsUsage`, `abort`, `finishNativeCycle`).
  `chatgpt-request-cycle.ts` is a four-line alias re-exporting it as
  `ChatGPTRequestCycle`.
- `chatgpt-bridge.ts`: `chatGPTRequest`, `chatGPTStatus`,
  `chatGPTConnected`, `chatGPTBackgroundAllowed`, `onChatGPTChange`,
  `chatGPTModels`, `chatGPTModel`, `chatGPTScope`,
  `chatGPTScopeCurrent`, `chatGPTLease`, `chatGPTDenial`,
  `refreshChatGPTModels`, `chatGPTAbortController`.
  `chatgpt-stream.ts`: `chatGPTStreamError`, `chatGPTPayload`,
  `chatGPTHistory`, `chatGPTStream(background, lifecycle?)`.
- `subscription-bridge.ts`: `nativeSubscriptionId`,
  `subscriptionRequest`, `refreshSubscriptionModels`,
  `nativeSubscriptionStatus` / `Connected` / `BackgroundAllowed`,
  `nativeSubscriptionModels`, `nativeSubscriptionModel`,
  `onNativeSubscriptionChange`, `subscriptionScope`,
  `subscriptionScopeCurrent`, `subscriptionAdmissionScope`,
  `nativeAdmissionCurrent`, `subscriptionLease`,
  `subscriptionAbortController`, `subscriptionDenial`.
  `subscription-stream.ts`: `nativeSubscriptionError`,
  `subscriptionHistory`, `nativeSubscriptionStream(provider,
  background, lifecycle?)`.
- `system-prompt.md`: the shared base prompt, loaded as segment
  `system-prompt.md` via `PATHS.teacherPrompt`; prober and teacher use
  it, practice does not.
- Subdirectories:
  - [subagents](./subagents/CLAUDE.md) - job runner, extraction pipeline,
    researcher / demo-builder / visual-maker / pdf-reader, headless
    Chrome and pdfjs layers.
  - [tools](./tools/CLAUDE.md) - tool registries and factories (jobs,
    plan, probe, graph, practice, web, pdf, learner filesystem).
  - `prompts/` - markdown prompt fragments only (`practice/`,
    `prober/`, `shared/`, `teacher/`, `README.md`); no code, no
    contract file.

## Invariants

- Import law (lint-enforced): nothing here imports `src/server` or
  `src/store`. Dependencies are `src/core` (also via the `@/src/core` alias), `config.ts`, `package.json`, pi-ai / pi-agent-core, TypeBox, and tool/runtime libraries (`@mozilla/readability`, `turndown`, `linkedom`, `puppeteer-core`, `pdfjs-dist`). Storage arrives as
  `chatStore` / `jobStore` / `graphStore` / `spawn` on the tool context
  objects; the web subscription transport is injected via
  `configureWebSubscriptionRuntime(request)`; usage accounting flows
  out through `opts.onUsage`.
- Engine resolution is BYOK with no fallback pins: callers inject
  `opts.engine`; otherwise `piEngineFor(kind)` throws. `piEngineForSpec`
  routes provider `chatgpt` to `chatGPTStream`, native-subscription
  providers to `nativeSubscriptionStream`, and everything else to
  `piModels().getModel` + `streamSimple`; an unknown model throws.
  Thinking level: unset takes the first supported
  `DEFAULT_THINKING_ORDER` entry; set levels are clamped; `off` sends
  `reasoning: undefined`.
- Question-stop semantics: question tools return `questionResult()`
  with `terminate: true`; the run ends only if every question-tool
  call resolved without `isError`. Authoring failures are returned
  (`invalidInputResult`, `isError: true`), never thrown, so the model
  can retry in the same turn. Teach `quiz` / `explain` validate
  `nodeId` against the live `chatStore.getChat(chatId).tree`.
- Tool registries: `probe_done` is re-added after `filterEnabledTools` so it can never be toggled off, and the mechanics keys `quiz` / `explain` are stripped from the toggle map by `withoutMechanics`; `read` / `ls` / `find` / `grep` and `ask_user_question` are on by default but sit inside the filter, so an explicit `false` toggle drops them; the prober gets only `research` +
  `pdf` from the job tools plus graph tools when `ctx.graphStore` is
  present; both registries are wrapped in `healToolRecord`; an explicit `opts.tools` registry is never filtered (honored by `createTeacherAgent` and `createPracticeAgent`; `createProberAgent` ignores `opts.tools` and always builds `createProberTools`); `sendToUserTool` is added
  only when no explicit registry was passed and `model.id` contains
  `claude`.
- Prompt composition order: `system-prompt.md`, then the agent's own
  numeric-prefix fragments (sorted), then `shared/` fragments, joined
  with `\n\n---\n\n`. Practice skips the base and takes only
  `PRACTICE_SHARED_FRAGMENTS`. An override applies only when
  `switches[path] === true` and the override file exists; with no
  switches a composition cached at module load is used.
- Background vs foreground: in `prepareRequest`, new automatic-cause
  input sets `callPurpose.background = true`; learner input alone sets
  it false; unknown identity never grants foreground.
- No API-key fallback for subscriptions: ChatGPT dispatches
  `streamSimple` against provider `openai` with the leased access token
  and `maxRetries: 0`; leases starting with `sk-` are rejected;
  `Authorization` header overrides are forbidden; native streams call
  `provider.streamSimple` directly; the fetch wrapper calls
  `lifecycle.beforeDispatch` exactly once and throws on any retry after
  commit.
- Admission scope is compared by JSON equality of `{ accountId |
  connectionId, epoch, authorityRevision, selectedModelId }`; stamps
  must be non-negative safe integers and lower revisions are ignored;
  usage from never-admitted requests is marked in a global `WeakSet`
  and skipped by `onUsage`.
- Bridge and runtime state are `globalThis` singletons behind
  `Symbol.for` keys (`lh.chatgpt.bridge`, `lh.subscriptions.bridge`,
  `lh.webSubscriptionRuntime`, `lh.subscription.unadmittedUsage`) so
  they survive module reloads.
- `serverExecute` wraps every server tool in a 30 s timeout
  (`toolTimeoutMs.current`), forwards the parent abort, and allows a
  250 ms grace before rejecting.

## Side Effects

- `teacher-agent.ts`: synchronous prompt-file reads at module load
  (cached composition for all three kinds; re-read each turn when
  `promptSwitches` are set); constructs a pi `Agent` that streams to
  the LLM via `engine.streamFn`; mutates `opts.callPurpose.background`;
  subscribes to agent events for `onUsage`.
- `models.ts`: lazily creates a process-wide pi-ai `Models` collection
  with all builtin providers; reads `process.env.OPENROUTER_API_KEY`;
  network through pi-ai engines.
- `tool-execute.ts`: `setTimeout` timers and `AbortController`s.
- `prompt-segments.ts`: `fs.readdirSync` / `existsSync` /
  `readFileSync` on `src/agent/prompts`, `PATHS.teacherPrompt`, and
  `PROMPTS_OVERRIDE_DIR` (read-only).
- `provider-events.ts`: when `LH_PROVIDER_EVENTS` is set, appends JSONL
  to `data/debug/provider-events/<chatId>.jsonl` with a byte cap;
  errors swallowed.
- `chatgpt-bridge.ts`, `subscription-bridge.ts`: `process.on("message"
  | "disconnect")` listeners, `process.send` IPC with 45 s timeouts,
  env reads (`LH_DESKTOP_SERVER`, `LH_DESKTOP_API_SECRET`), abort of
  registered controllers on invalidation, global mutable state.
- `chatgpt-stream.ts`: network to `https://api.openai.com/v1` with a
  leased token (payload rewritten: `store: false`, system to developer,
  tools namespaced). `subscription-stream.ts`: network via native
  `provider.streamSimple` with leased auth headers.
- `subscription-request-cycle.ts`: calls injected `commitStaged` /
  `restoreAutomatic` (mutate the caller's store); mutates
  `options.purpose.background`; buffers and releases `AgentEvent`s.
- `tools.ts`: reads the injected `chatStore`; job tools call the
  injected `jobStore` and `spawn`.

## Verification

- Run: `npm test`
- Also: `npm run lint` (import law) and `npm run typecheck`.
