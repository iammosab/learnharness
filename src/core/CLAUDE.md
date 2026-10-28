# src/core

## Overview

The pure domain layer. It holds the record and message model
(`native-messages.ts`, `view.ts`), the question/quiz engine, plan-tree
and phase logic, compaction math, the settings shape and its resolution,
cost/pricing, graph layout, the notify-only event bus, and the hexagonal
storage-port interfaces (`ports.ts`). The graph merger and derivation
(`graph.ts`), deletion (`graph-deletion.ts`), birth-session clustering,
and layout settle run against ports that a server caller passes in.
`index.ts` is the browser-safe barrel and the only core module the shell
(`components/`, `app/`) may import; `docs/architecture.md` section 2
is the canonical description.

Dependency arrows point inward: adapters (`src/store`) implement the
ports here, `src/agent` and `src/server` call the functions here, and
nothing here imports any of them.

## Interface

- Barrel `index.ts` re-exports: `contracts.ts`, `ports.ts`, `chains.ts`,
  `render-settings.ts`, `question-core.ts`, `events.ts`, `layout.ts`,
  `plan-tree.ts`, `phases.ts`, `pending.ts`, `prompt-segments.ts`,
  `math-delims.ts`, `native-messages.ts`, `compaction.ts`,
  `input-events.ts`, `view.ts`, `tool-parts.ts`,
  `answer-presentation.ts`, `prices.ts`, `context-usage.ts`,
  `cost-summary.ts`, `fuzzy.ts`, `settings.ts`,
  `settings-resolution.ts`, `search.ts`, `session-find.ts`,
  `session-navigation.ts`, `auth-keys.ts`, `keyboard.ts`, `coverage.ts`,
  `session-markdown.ts`; type-only `ChatGPTStatus`,
  `ChatGPTControlBridge`, `ChatDeleteMode`, `ChatDeletionStats`; and
  `NATIVE_SUBSCRIPTIONS` plus the `NativeSubscription*` types.
- Deliberately NOT in the barrel (server imports them directly):
  `graph.ts` (needs ports and `node:crypto`), `clusters.ts`
  (`MIN_CLUSTER_SIZE` only), `session-clusters.ts`, `layout-settle.ts`,
  the runtime of `graph-deletion.ts`; also unexported without a stated
  reason: `argument-heal.ts`, `content-reader.ts`, `plan-blocks.ts`,
  `value-debris.ts`.
- `ports.ts`: `ChatStore`, `GraphStore` (append*/read* ledgers,
  `upsertSource`, `appendSourceUsage`, `readPositions` /
  `writePositions`, `rewriteLedgers`), `CreateJobInit`, `JobPatch`,
  `JobStore`, `SettingsStore`, `PromptOverrideStore`, `AuthStore`
  (types only).
- `contracts.ts`: barrel over `contracts/{plan,graph,chat,jobs,probe,
  models}.ts`. Subdirectory: [contracts](./contracts/CLAUDE.md) - one
  file per domain (plan, graph, chat, jobs, probe, models, chatgpt,
  subscriptions).
- `graph.ts`: `GraphDeps`, `MergeSource`, `mergeFindings`,
  `simplifyChains`, `DerivedGraph`, `getGraph`, `deriveView`,
  `graphSnapshot`, `graphSessionIndex`, `graphSessionPropositions`.
- `graph-deletion.ts`: `ChatDeleteMode` (`preserve-graph |
  delete-nodes`), `ChatDeletionStats`, `deleteChatTraces`,
  `NodeDeletionStats`, `deleteNodeTraces`.
- `coverage.ts`: `messageViewLines`, `teacherProseBlocks`, `viewTokens`,
  `messageFingerprint`, `coverageSlots`, `coveredSet`, `coverageOf`,
  `batchRuns`, `batchTag`.
- `session-clusters.ts`: `BirthSessionCluster`, `birthSessionOf`,
  `birthSessionPartition`, `impClusterKey`, `attachImpToCommunities`.
  `layout-settle.ts`: `settleGraphLayout(graphStore)`. `layout.ts`:
  `createGraphSimulation`, `incrementalLayout`, `inferenceDepths`,
  layout constants (d3-force).
- `events.ts`: `ServerEvents`, `SERVER_EVENT_TYPES`, `ServerEvent`,
  `subscribe`, `emit`.
- `question-core.ts`: TypeBox schemas (`quizInputSchema`,
  `probeQuizInputSchema`, `explainInput*`, `askInputSchema`),
  `QUIZ_QUESTION_TYPES`, `normalizeQuizType`, `QuestionData`,
  `ClientQuestion`, `AnswerRequest`, `seededRandom`, `shuffleOptions`,
  `resolveCorrect`, `isCorrect`, `toClientQuestion`, `buildAnswer`,
  `dismissedAnswer`, `compactAnswerForModel`. `tool-parts.ts`:
  `parseQuizInput`, `parseAskInput`, `parseExplainInput`,
  `parseProbeDoneInput`.
- `plan-tree.ts`: `PlanTreeError`, `emptyTree`, `createTree`.
  `phases.ts`: `Phase3` (`probe | plan | teach`), `phaseAt3`,
  `teachStepIndex`, `phaseTimeline`, `phaseAt3Lh`. `pending.ts`:
  `QUESTION_TOOLS`, `JOB_TOOLS`, `TOGGLEABLE_TOOLS`, `EnabledTools`,
  `filterEnabledTools`, `findPendingToolCall`, `toolActivityLabel`.
- `settings.ts`: `CURRENT_SETTINGS_VERSION`, `MODEL_SLOTS`, `ROLE_SLOT`,
  `ModelsNotConfiguredError` / `modelsNotConfigured` /
  `isModelsRefusal`, `ProviderKeyMissingError` / `providerKeyMissing` /
  `isProviderKeyRefusal`, `UserSettings`, `FACTORY_SETTINGS`,
  `sanitizeUserSettings`. `settings-resolution.ts`:
  `EffectiveSettings`, `resolveSettings`, `resolveSlot`,
  `resolveModelSpec`, `extractionEnabled`, `renderingEnabled`,
  `graphToolsEnabled`.
- `compaction.ts`: token estimators, `compactionCutIndex`,
  `newCompactionMarker`, `activeCompactionOf`, `buildCompactionPrompt`.
  `prices.ts`: `turnCost`, `sessionCost`, `jobCost`, `isChatGPTPlan`.
  `cost-summary.ts`: `graphCostSummary`.
- `native-messages.ts`: `LhMessage`, `LhMarkerMessage`,
  `asAgentMessages`, `toLlmMessages`, `newMessageId`, `newUserMessage`,
  `newUserSteer`, `newAnswerResult`, `newHandoffMessage`,
  `newPlanBlockMessage`, `activeProblemOf`, `danglingQuestionOf`,
  `hasProbeDone`, `reconstructRequestCause`, `needsContinuation`.
  `view.ts`: `projectView`, `LhViewMessage`, `LiveTurnState`.
  `input-events.ts`: `parseChatInput`, `parseUserSteerInput`,
  `parseDismissInput`, `inputAppends`, `dismissAppends`.
- Smaller pure modules: `chains.ts`, `render-settings.ts`,
  `auth-keys.ts`, `keyboard.ts`, `session-markdown.ts`,
  `session-navigation.ts`, `session-find.ts`, `search.ts` (port types),
  `prompt-segments.ts`, `math-delims.ts`, `content-reader.ts`,
  `plan-blocks.ts`, `context-usage.ts`, `answer-presentation.ts`,
  `argument-heal.ts`, `fuzzy.ts`, `value-debris.ts`.

## Invariants

- Import law (lint-enforced, `eslint.config.mjs`): no file here imports
  `src/agent`, `src/server`, or `src/store`. `ports.ts` states the rule:
  adapters may import core; core never imports an adapter; wiring
  happens once in `src/server/stores.ts`. The only reach outside `src/`
  is a type-only import of `ModelRole` from `config.ts`.
- `mergeFindings` (`graph.ts`) is the deterministic merger and the only
  stage that appends to the node/chain ledgers; the extraction pipeline
  (`src/agent/subagents/extraction.ts`) is its sole caller. The LLM
  supplies judgment; timestamps and provenance are rebuilt
  deterministically. It is incremental and idempotent: coverage entries
  ensure no message is extracted twice.
- Chains-primary: `GraphStore` stores nodes and chain assertions only;
  edges are a derived view (`getGraph` / `deriveView`); assertions with
  the same (sorted premises, conclusion) merge by `chainKey` on read.
- `graph-deletion.ts` is the second and only other ledger writer,
  deterministic and idempotent over `GraphStore.rewriteLedgers`, run as
  one synchronous block so no extraction append can interleave.
  `preserve-graph` removes only coverage and checkpoint rows;
  `delete-nodes` strips provenance and orphans.
- `writePositions` is called by `settleGraphLayout` (`layout-settle.ts`) after each merge, by `graph-deletion.ts` when pruning orphans, and by `src/server/commit-positions.ts` on drag commit; layout seeds derive from node ids, so layout is deterministic.
- Coverage is computed at read time by diffing message fingerprints
  (sha256 of view lines) against the append-only coverage ledger; only
  teacher prose counts.
- A node's cluster is its birth session (`provenance[0].chatId`),
  recomputed on every read with no stored partition.
- `events.ts` is a notify-only bus: payloads carry the fact, never the
  data; the listener `Set` lives on `globalThis.__lhEventBus` so every
  Next module instance shares it; each listener call is isolated with
  try/catch.
- `ChatStore.appendTurnUsage` is idempotent per turn id;
  `appendExtractionUsage` / `appendSourceUsage` per `startedAt`;
  `renameChat` does not change `updatedAt`.
- `seededRandom` makes option shuffles identical on server and client;
  `shuffleOptions` falls back to `Math.random` only when no `rand` is
  passed.
- Browser-safety of the barrel is a doc-comment convention, not lint.
  Known exceptions a maintainer must not widen: `coverage.ts` is in the
  barrel yet imports `createHash` from `node:crypto`; `keyboard.ts`
  touches `window.localStorage` and `navigator`.

## Side Effects

- `graph.ts`: `node:crypto` `randomBytes` for node ids (`n_` + 12 hex)
  and chain ids (`arg_` + 12 hex); `new Date().toISOString()` in
  `mergeFindings`; IO only through the passed-in ports.
- `coverage.ts`: `node:crypto` `createHash("sha256")` (deterministic).
- `native-messages.ts`, `compaction.ts`, `plan-blocks.ts`,
  `question-core.ts`: `Date.now()` / `new Date()` timestamps and Web
  Crypto `crypto.randomUUID()` for new message ids.
- `keyboard.ts`: browser `localStorage` key `lh:keymap`,
  `navigator.platform` / `userAgent`.
- `events.ts`: mutable process-global listener set; `console.error` when
  a listener throws.
- `layout-settle.ts` and `graph-deletion.ts`: writes only through the
  `GraphStore` port (`writePositions`, `rewriteLedgers`).
- `content-reader.ts` pulls in katex and mdast/micromark; `layout.ts`
  pulls in d3-force; `question-core.ts` / `tool-parts.ts` use TypeBox.
- Everything else is pure (no fs, network, env, clock, or randomness), except the steer builders in `contracts/jobs.ts`, which stamp `Date.now()`.

## Verification

- Run: `npm test`
- Also: `npm run lint` (import law) and `npm run typecheck`.
