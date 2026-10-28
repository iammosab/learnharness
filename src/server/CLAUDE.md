# src/server

## Overview

The server-side surface that `app/` route handlers import through the
`index.ts` barrel (the import law lets `app/**` import only
`@/src/core` and `@/src/server`). It sits on top of the agent and core
layers and carries no business logic of its own. `stores.ts` is THE
storage composition root (wires the fs adapters from `src/store` and
exposes `effectiveSettings()`); `chat-handler.ts` is THE turn
composition root (builds the single job runner and extraction pipeline,
registers the `jobs.ts` seams at module init, and runs every turn
through `beginTurn -> run -> persistTurn -> applyParkedDismissal ->
endTurn`). The other files are thin named seams: turn liveness and run
registries, wake/steer delivery, compaction, keys/env, model catalog,
search ports, settings-body parsing, the SSE event stream, pricing, and
web-subscription HTTP controls. `pi/` bridges pi-agent-core to the wire.

## Interface

- Barrel `index.ts` re-exports: `chat-handler.ts`, `events-stream.ts`,
  `chats.ts`, `graph.ts`, `commit-positions.ts`, `jobs.ts`, `stores.ts`,
  `keys.ts`, `search.ts`, `settings-body.ts`, `turn-liveness.ts`,
  `turn-runs.ts`, `dismissal-park.ts`, `compaction.ts`,
  `observability.ts`, `model-catalog.ts`; plus `NotesImportError`
  (`src/agent/subagents/extraction.ts`), `readRenderSettings` /
  `writeRenderSettings`, `readSettingsRecord` / `writeSettingsRecord` /
  `settingsStore`, `promptOverrides`, `authStore` (from `src/store`),
  `isValidSegmentPath` (core), `effectivePromptSegments` /
  `allSegmentPaths` / `readPromptOverride` (`src/agent/prompt-segments.ts`),
  `runPiTurn` / `piTurnResponse` / `PiTurnHandle` / `PiTurnSpec`
  (`./pi/ui-stream.ts`), `subscriptionControlsResponse` /
  `subscriptionBrowserResponse`, `sessionCost`. Not exported:
  `turn-service.ts`, `web-subscriptions.ts`, `desktop-access.ts`.
- `stores.ts`: `stores { chatStore, graphStore, jobStore,
  settingsStore }`, type `Stores`, `effectiveSettings()` (no cache;
  `resolveSettings(settingsStore.readSettings())`).
- `chat-handler.ts`: `extraction` (the single
  `createExtractionPipeline` instance), `handleChatRequest(request)`,
  `handleChatInput(chatId, input)`.
- `turn-service.ts`: `TurnPersistenceError`, `persistTurn(chatStore,
  chatId, baseCount, msgs, aborted)`, `triggerExtraction(deps,
  extraction, chatId, chunkTokens)`.
- `turn-runs.ts`: `rememberTurnFailure`, `turnFailure`,
  `clearTurnFailure`, `registerTurn`, `unregisterTurn`, `runningTurn`,
  `abortTurn`, `settledTurnResponse`.
- `turn-liveness.ts`: `beginTurn`, `endTurn`, `isTurnRunning`.
- `jobs.ts`: `TurnRunner`, `JobRespawn`, `setTurnRunner`,
  `setJobRespawn`, `noteSteersDurable`, `discardChatDeliveries`,
  `deliverJobResult`, `automaticFollowUpAllowed`, `registerLiveAgent`,
  `UserSteerEntry`, `steerLiveChat`, `reconcileUserSteers`,
  `unregisterLiveAgent`, `restoreUncommittedAutomatic`, `settleSteers`,
  `AbortOutcome`, `abortJob`, `recoverStaleJobs`, `listJobs`.
- `graph.ts`: `graphView`, `graphCosts`, `graphRevision`,
  `NodeDeleteOutcome`, `deleteGraphNode`.
- `chats.ts`: `createChat` / `getChat` / `listChats` (from
  `stores.chatStore`), `titleFromPrompt`, `ChatDeleteMode`,
  `ChatDeletionStats`, `ChatDeleteOutcome`, `deleteChatSession`,
  `SessionCoverage`, `sessionCoverage`.
- `commit-positions.ts`: `commitPositions(input)`.
- `compaction.ts`: `Summarizer`, `CompactionDeps`, `compactionInFlight`,
  `awaitCompaction`, `effectiveThresholdTokens`,
  `projectedContextTokens`, `ensureCompacted`, `kickCompaction`.
- `dismissal-park.ts`: `ParkedDismissal`, `parkDismissal`,
  `takeParkedDismissal`, `applyParkedDismissal`.
- `events-stream.ts`: `eventsResponse()`.
- `keys.ts`: `isWritableAuthKey`, `providerKeyList`, `envKeysIgnored`,
  `initAuthEnv`, `resolveKeyStatuses`, `keyStatuses`, `keyValue`,
  `providerKeyPresent`, `saveKey`, `deleteKey`.
- `model-catalog.ts`: `refreshConnectionCatalog`, `ModelDto`,
  `catalogDefaultsFor`, `catalogDefaults`, `rolePinsFor`,
  `catalogRolePins`, `catalogSlots`, `catalogProviders`, `toModelDto`,
  `catalogContextLimits`, `modelCatalog`, `SettingsValidation`,
  `validateChatSettings`, `validateModelsSettings`,
  `clampModelsLevels`, `clampChatLevel`.
- `settings-body.ts`: `parse{General,Agent,Appearance,Graph,Models,Compaction}SettingsBody`, `parseSettingsBody` (per-chat `ChatSettings`), `SettingsBodyResult<T>`, `SETTINGS_SECTIONS`, `SettingsSectionName`.
- `search.ts`: `tavilyProvider`, `braveProvider`,
  `resolveSearchEngineFor`, `searchStatus`, `searchAvailable`,
  `searchProvider`.
- `observability.ts`: `ActivityJob`, `ActivityExtraction`,
  `activityFeed()`; re-exports `abortExtraction`, `extractionStatuses`,
  `ExtractionPhase`, `RunningExtraction`, `chatStore`.
- `pricing.ts`: `callCost`, `turnCost`, `sessionCost`, `jobCost`.
- `web-subscriptions.ts`: `webSubscriptionsEnabled`,
  `createWebSubscriptionOwner`, `webSubscriptionOwner`,
  `webSubscriptionRequest`, `webSubscriptionStatus`.
- `web-subscription-http.ts`: `subscriptionRequestOrigin`,
  `subscriptionControlsResponse`, `subscriptionBrowserResponse`.
- `desktop-access.ts`: `desktopAPIAuthorized(headers, env)`.
- Subdirectory: [pi](./pi/CLAUDE.md) - pi-agent-core to SSE wire bridge
  (`runPiTurn`, `piTurnResponse`, `ToolCallIdUniquifier`).

## Invariants

- One storage composition root: `stores.ts` is the intended single
  place the chat, graph, job, and settings adapters are wired; business
  modules reach storage through `stores`, and `turn-service`,
  `compaction`, `dismissal-park` take port types as parameters. This
  rule is documentation-only (not lint-expressible). Known direct
  `../store` imports besides `stores.ts`: the barrel's re-exports of the
  settings/render/prompt/auth adapters, `observability.ts` (`chatStore`,
  also re-exported), `keys.ts` (`authStore`), and `model-catalog.ts`
  (`settingsStore`). The last two are not listed in
  `docs/architecture.md`.
- One turn composition root: client requests and wake-pipeline steers
  both go through `handleChatInput`. `chat-handler.ts` calls
  `setTurnRunner(...)` and `setJobRespawn(...)` at module top level;
  `recoverStaleJobs` skips respawn when the seam is unset.
- Exactly one extraction pipeline instance (`extraction`), shared by
  quiz-triggered runs and notes import.
- Only one turn may own a chat: `beginTurn` returns `false` if one is
  running and the handler answers 409. Model, key, and catalog refusal
  gates (503) run before `beginTurn` so they have no liveness effects.
- Settlement order in `onFinish`: `persistTurn -> appendTurnUsage ->
  triggerExtraction -> applyParkedDismissal -> endTurn ->
  unregisterTurn -> unregisterLiveAgent -> settleSteers ->
  kickCompaction`; `turn-settled` therefore guarantees the record is
  durable.
- Liveness: `beginTurn` emits `turn-started` after the registry write;
  `endTurn` emits `turn-settled` only if an entry existed;
  `isTurnRunning` lazily evicts entries older than `MAX_TURN_MS`
  (30 min) without emitting; `beginTurn` clears a retained turn failure.
- SSE: `eventsResponse` subscribes before sending any frame
  (attach-then-replay), heartbeats `: ping` every 25 s, and tears down
  listener and interval on cancel or enqueue failure.
- Every cross-route mutable registry lives on `globalThis`
  (`__lhTurnRegistry`, `__lhTurnRuns`, `__lhTurnFailures`,
  `__lhParkedDismissals`, `__lhWakePipeline`, `__lhCompaction`,
  `Symbol.for("lh.authBoot")`, `Symbol.for("lh.webSubscriptions")`)
  because Next dev compiles routes as separate module instances.
- Stale-job recovery is liveness-gated and throttled
  (`SWEEP_THROTTLE_MS` 30 s), never touches `isJobLive` jobs or chats
  with a running turn, runs only off `listJobs`, and never under
  `NODE_ENV=test`. Wake pump timing: `POLL_MS` 400, `GRACE_MS` 750, 409
  backoff ramp `[500, 1000, 2000, 5000]`.
- `effectiveSettings()` is read fresh on every call; job and extraction
  engines are resolved fresh per job or stage (BYOK: an unset slot
  resolves to a typed refusal, never a fallback pin).
- Chat deletion refuses while work is running, aborts extraction and
  polls for wind-down (10 s timeout, 50 ms poll, then 503), re-checks
  blockers, then purges synchronously with no awaits: ledgers -> jobs
  -> chat record -> `discardChatDeliveries`.
- `triggerExtraction` is unconditionally a no-op under `NODE_ENV=test`; the compaction summarizer is a no-op under test unless `deps.summarize` is injected.

## Side Effects

- Importing the barrel has module-load effects: `keys.ts` runs
  `initAuthEnv()`, which mutates `process.env` (fill-gap from
  `auth.json`; deletes managed vars when `LH_IGNORE_ENV_KEYS=1`);
  `chat-handler.ts` constructs `jobRunner` and `extraction` and
  registers the seams; `jobs.ts` subscribes to `onSubscriptionChange`;
  `web-subscriptions.ts` calls `configureWebSubscriptionRuntime`.
- `chat-handler.ts`: reads `LH_UPDATE_FLUSH_MS`, `NODE_ENV`; network
  indirectly via pi engines and `refreshConnectionCatalog`; emits core
  events.
- `jobs.ts`: `globalThis.__lhWakePipeline` (queues, live agents, user
  steers, pump state); `setTimeout` delay/poll loops.
- `turn-liveness.ts`, `turn-runs.ts`, `dismissal-park.ts`,
  `compaction.ts`: `globalThis` maps; `abortTurn` calls
  `handle.abort()`; `applyParkedDismissal` writes to `chatStore` and
  emits `record-changed`; compaction runs a summarizer subagent
  (network).
- `turn-service.ts`: writes through the injected `ChatStore`; fires
  `extraction.runExtraction` fire-and-forget; console logging.
- `events-stream.ts`: one SSE `ReadableStream` per connection, a bus
  subscription, 25 s `setInterval` heartbeat.
- `keys.ts`: `saveKey` / `deleteKey` write both `process.env` and
  `authStore`.
- `graph.ts`: `fs.statSync` of `LEDGER_FILES` / `POSITIONS_FILE` mtimes
  for `graphRevision` (direct `node:fs`, outside `stores`).
- `chats.ts`: `setTimeout` poll loop during deletion; deletes through
  `stores`.
- `model-catalog.ts`: network refresh via `refreshChatGPTModels` /
  `refreshSubscriptionModels`.
- `search.ts`: network to the Tavily and Brave APIs (`fetchFn`
  injectable); keys via `keyValue` (env or `authStore`).
- `web-subscriptions.ts`: singleton owner on `globalThis` that writes
  `chatgpt-credentials.json` next to `AUTH_FILE`, registers
  `process.once("exit")`, imports `electron/*.cjs`, dynamically imports
  pi-ai provider SDKs, OAuth network, emits `subscriptions-changed`.
- `desktop-access.ts`: reads `LH_DESKTOP_API_SECRET`,
  `LH_DESKTOP_SERVER`; timing-safe compare.
- `observability.ts`, `pricing.ts`, `settings-body.ts`: pure or
  read-only. `commit-positions.ts` writes positions via
  `stores.graphStore`.

## Verification

- Run: `npm test`
- Also: `npm run lint` (import law) and `npm run typecheck`.
