# src/core/contracts

## Overview

The shared domain contracts of learnharness, one file per domain. Almost
everything here is TypeScript interfaces, type aliases, and string
constants; the few runtime helpers are pure derivations (plan statuses,
usage accumulation, steer-message builders, title truncation). The one
runtime schema is a TypeBox schema in `probe.ts`. `src/core/contracts.ts`
is the barrel over these files, and the browser-safe core barrel
(`src/core/index.ts`) re-exports them to the shell.

Each domain file is owned outright by the stream that owns the domain;
schema changes in a domain you do not own go through the owner. See
`docs/architecture.md` section 2.2.

## Interface

- `chat.ts`: types `ChatKind`, `ChatRecord`, `ChatSettings`,
  `ExtractionStageUsage`, `ExtractionRunUsage`, `CallUsage`, `TurnUsage`,
  `PlanBlockData`, `ChatSummary`, `ChatListItem`, `ArtifactPartProps`;
  constants `CURRENT_CHAT_VERSION`, `HANDOFF_TEXT`, `THINKING_LABEL`,
  `CONCLUDE_ACK_TEXT`, `NEXT_PROBLEM_TEXT`, `COMPACTED_HISTORY_HEADER`.
- `chatgpt.ts`: interfaces `ChatGPTStatus` (client-safe, no credentials)
  and `ChatGPTControlBridge` (async status/login/cancel/select/disconnect/
  logout/consent/onChange).
- `graph.ts`: types `GraphEdge`, `GraphChain`, `EmissionStats`,
  `ProvenancePoint`, `NotesSource`, `NamingRunStats`, `GraphNode`,
  `SessionCheckpoint`, `CoverageEntry`, `ExtractedProposition`,
  `ExtractedChain`, `SessionFindings`, `IdentityLink`, `AuditVerdicts`,
  `Cluster`, `GraphSnapshot`, `Position`; constants
  `CURRENT_GRAPH_FORMAT_VERSION`, `TITLE_MAX_CHARS`; pure
  `titleFromPrompt(prompt)`.
- `jobs.ts`: the ack-and-steer protocol. Types `JobKind`
  (`research | demo | visual | pdf`), `JobStatus`, `JobRecord`, `JobUsage`,
  `UsageStepLike`, `*ToolInput` / `*Result` per kind, `SubagentResultMeta`,
  `SubagentArtifactData`, `SteerDetails`, `SteerMessage`; functions
  `piUsageToStep`, `accumulateJobUsage`, `setSteerUiInverted`,
  `isSubagentFailure`, `buildSubagentSteer`, `buildAbortSteer`,
  `buildProbeHandoffSteer`, `steerDelivered`.
- `models.ts`: types only: `ModelCatalogEntry`, `CatalogDefaults`,
  `RolePins`, `SlotPins`, `ModelCatalogResponse`, `CatalogProvider`.
- `plan.ts`: types `PlanNode`, `PlanEdge`, `PlanTree`, `PlanNodeStatus`
  (`current | visited | upcoming`), `DerivedPlanStatuses`,
  `PlanToolResult`; pure `derivedNodeStatus`, `derivePlanStatuses`
  (UI-style parts), `derivePlanStatusesLh` (native `LhMessage[]`).
- `probe.ts`: types `ProbeStrand`, `ProbeAssessment`, `ProbeDoneInput`,
  `ProbeDoneResult`; runtime TypeBox schema `probeDoneInputSchema`;
  compile-time `probeDoneSchemaLock`; constant `PROBE_DONE_ACK_TEXT`.
- `subscriptions.ts`: types `NativeSubscriptionProviderId`
  (`github-copilot | xai`), `NativeSubscriptionLogicalId`,
  `SubscriptionPrompt`, `SubscriptionInteraction`,
  `NativeSubscriptionStatus`, `NativeSubscriptionSnapshot`,
  `NativeSubscriptionScope`, `NativeSubscriptionControlBridge`; const
  tuple `NATIVE_SUBSCRIPTIONS`.

## Invariants

- No file here imports `src/agent`, `src/server`, or `src/store`
  (lint-enforced for all of `src/core`). Imports stay inside core or are
  type-only imports of `@earendil-works/pi-agent-core` /
  `@earendil-works/pi-ai`; the only runtime third-party import is
  `typebox` in `probe.ts`.
- Steer ids are deterministic: `buildSubagentSteer` and `buildAbortSteer`
  both use `steer_${job.id}`, so at most one of them delivers per job;
  the probe handoff uses `steer_probe_${chatId}`. `steerDelivered` checks
  for the id, which makes re-delivery idempotent.
- Plan position derives only from `quiz` / `explain` tool calls that carry
  a `nodeId`; tool results are never read. `current` is the most recent
  tagged node, `visited` the earlier stays with consecutive duplicates
  collapsed; before any tagged call `current` is null. Node ids not in the
  current tree are ignored. The plan tree stores structure only, never
  progress. `derivePlanStatuses` and `derivePlanStatusesLh` are two views
  of the same rule and must agree.
- `accumulateJobUsage` never mutates its input; `steps` grows by one per
  model call whether or not usage was reported; a token field stays
  `undefined` until some call reports it; `calls` only ever appends.
- `setSteerUiInverted` returns a new array and changes only demo/visual
  steers whose id matches.
- Chains are the stored truth for the graph; `GraphEdge` is a derived
  view rebuilt after every change and never stored.
- `probeDoneInputSchema` is the single source of truth for the
  `probe_done` tool input; `src/agent/tools/probe.ts` and
  `src/core/tool-parts.ts` both consume it, and `probeDoneSchemaLock`
  fails the build if schema and `ProbeDoneInput` drift.
- `ChatGPTStatus` and `SubscriptionInteraction` carry no credentials,
  tokens, or device codes.

## Side Effects

- No fs, network, process, crypto, or random access in any file.
- Clock read: `buildSubagentSteer`, `buildAbortSteer`, and
  `buildProbeHandoffSteer` (via `newHandoffMessage` in
  `../native-messages.ts`) stamp `timestamp: Date.now()`; id and content
  are deterministic, the timestamp is not.
- `probeDoneInputSchema` runs TypeBox builders at module load.
- Every helper returns fresh objects; no module-level mutable state.

## Verification

- Run: `npm test`
- Also: `npm run lint` (import law) and `npm run typecheck`.
