# components

## Overview
The Stage — the presentation shell of the learning harness (see
`docs/architecture.md` §2, §4). Everything here renders domain data and
owns nothing server-side: the session view (transcript, composer, question
dock, plan blocks, practice dock), the home knowledge-graph canvas and
chains table, the sidebar/app shell with the background-activity section,
the keyboard machine, voice dictation, and the push-notification client.
The directory reaches the server only through `/api/*` HTTP (plus one
`EventSource`), and reaches domain logic only through the pure core barrel
`@/src/core` — grading, view projection, plan statuses, layout, prices, and
keyboard bindings are all computed by core functions the UI merely calls.

## Interface
Grouped by role (interactive files are `"use client"`; pure helpers and small presentational files carry no directive; exported pure helpers are test pins).

**Session model and transport**
- `session-core.ts` (pure, no React) — `SessionModel` (`send(input)`, `steer(text)`, `dismissQuestion(...)`, `getState()`, `setReattachSettled`, `readyRef`), `SessionState`, `SessionStatus = "ready" | "submitted" | "streaming" | "error"`, `SteerQueueItem`, `visibleQueuedSteers`, `absorbed`, `pendingCallTool`, `SessionModelOptions`, `SessionModelDeps`, `TURN_POLL_MS`, `TURN_WAIT_MAX_MS`
- `session.ts` — `useChatSession({ chatId, initialMessages, initialError?, initiallyInFlight? })` (the React adapter over `SessionModel`)
- `chat.tsx` — `Chat`, `ChatActionsContext`, `parseModelsRefusal`, `parseProviderKeyRefusal`, `escAbortTarget`/`EscAbortTarget`, `initialPromptOwed`, `revealArrival`, `probeArrivalExpanded`, `shouldStampGeometryMute`
- `jobs-context.ts` — `JobsContext` (one central `GET /api/jobs?chatId=…` in `Chat`; cards are pure readers)
- `server-events.tsx` — `ServerEventsProvider`, `openEventsChannel`, `createNotifyHub`, `wireSource`, `useNotifyHub`, `useServerEvent`, `useServerResync`, `NotifySource`
- `settings-signal.ts` — `SETTINGS_SAVED_EVENT`, `SettingsSection`, `notifySettingsSaved`, `onSettingsSaved`, `useSettingsSaved`

**Questions and practice**
- `question-dock.tsx` — `QuestionDock`, `QuestionDockBar`, `QuestionDockProps` (`toolName: "quiz" | "probe" | "ask_user_question" | "explain" | "recall"`)
- `answered-card.tsx` — `AnsweredCard({ answer, input })` · `confidence-rail.tsx` — `ConfidenceRail`, `confidenceRailStyle`, `CONFIDENCE_COLORS` · `reading-thinking.tsx` — `ReadingThinkingField`
- `practice-dock.tsx` — `PracticeDock`, `PracticeDockProps` · `practice-cards.tsx` — `ProblemCard`, `ConcludeCard`, `ThinkingCard`, `PracticeThinkingData`
- `abort-turn-dialog.tsx` — `AbortTurnDialog`, `AbortTurnBody`, `AbortMode` · `queued-steers.tsx` — `QueuedSteersBody`, `QueuedSteerLine`

**Plan tree and phases**
- `plan-block.tsx` — `PlanBlock`, `PlanDiagram`, `PlanPopup`, `latestTree`, `blockLayout`, `topoFor`, `wrapTitle`, `nodeWidth`, `edgePathD`, `estimateLineWidth`, `LayoutNode`, `PopupMessage`, layout constants (`PAD_X`, `NODE_W_MIN`, `NODE_H`, `LINE_H`, `GAP_X`, `GAP_Y`, `GRAPH_PAD`, `GLOW_*`, `TEXT_CAP_SCALE`, `ARROW_HEAD`, `STROKE_W`)
- `plan-window.tsx` — `planExists`, `PlanMarginalia` · `phase-divider.tsx` — `PhaseChip`, `PhaseDivider`, `planNodeCount` · `compaction-divider.tsx` — `CompactionMomentDivider`, `CompactionCutDivider`, `CompactionDividerData`

**Knowledge graph (home)**
- `graph-canvas.ts` — `GraphCanvasRenderer` (single Canvas 2D, one rAF loop), `CanvasData`/`CanvasNode`/`CanvasEdge`/`CanvasCluster`/`CanvasColors`, `RendererCallbacks`, `GraphRenderSettings`, `fitTransform`, `zoomRatioOf`, `labelAlpha`, `arrowGeometry`/`ArrowGeom`, `pickNearest`, `wrapRegionLabel`, `applyClusterLabels`, `boxBlurRound`, `isImpNodeId`, `LABELS_FADE_RATIO`
- `graph-view.tsx` — `GraphView`, `GraphChromeRow`, `GraphCostControl`, `isNodeVisible`, `renameSessionsPatch`, `seedMissingNodePositions`, `displayCostTotals`
- `pan-zoom.ts` — `Viewport`, `fitZoomFor`, `fitGraphView`, `zoomedGraphView`, `ZOOM_MAX`, `FIT_PAD`, `FIT_ZOOM_MAX` · `cluster-geometry.ts` — `Pt`, `clusterHue`
- `chain-table.tsx` — `ChainTableBody`, `ChainTableOverlay`, `ChainSort`, `ChainSortCol` · `graph-context-card.tsx` — `GraphContextCard`, `GraphContextData`
- `delete-node-dialog.tsx` — `DeleteNodeDialog`, `DeleteNodeBody`, `EXTRACTION_RETRY_LINE` · `extraction-coverage.tsx` — `CoverageRing`, `CoverageRingGlyph`, `CoverageRingDetail`, `CoverageMenuBlock`, `CoverageMenuBody`, `fetchGraphRead`, `ringFill`, `SessionCoverage`, `GraphRead`
- `notes-import.tsx` — `useNotesImport`, `postNotesImport`, `parseNotesImportResults`, `NotesImportErrors`, `NotesImportResult`

**App shell, home, and chrome**
- `sidebar.tsx` — `AppShell`, `SidebarProvider`, `useSidebar`, `SidebarToggle`, `SessionRow`, `RenameRow`, `timeAgo`, `SessionKindFilter` · `top-bar.tsx` — `TopBar`
- `activity-dock.tsx` — `ActivityProvider`, `useActivity`, `ActivitySection`, `toBlobs`, `formatElapsed`, `ActivityFeed`, `FeedJob`, `FeedExtraction`, `ActivityBlob`
- `home.tsx` — `Home` · `minimal-home.tsx` — `MinimalHome`, `KnowledgeSummary` · `new-session.tsx` — `NewSession`, `DraftShell`, `startDraftSession`, `DraftPick`
- `setup-dialog.tsx` — `SetupDialog`, `SetupKeysBody`, `setupStage`, `prefillFromSlots`, `prefillLevelFromPin` · `setup-cta.tsx` — `ZeroKeysPill`, `useZeroKeys`, `useStrongKeyless`, `hasProviderKey`, `strongKeyless`
- `model-picker.tsx` — `ModelControl`, `useModelCatalog`, `catalogLimits` · `thinking-default.ts` — `THINKING_LABEL`, `defaultOrderLevel`, `populateLevel`
- `stats-bar.tsx` — `StatsBar`, `formatContextMeasurement` · `usage-format.ts` — `formatUsd`, `planCostLabel`, `formatTokens`, `splitQualified`, `prettyModel`
- `delete-session-dialog.tsx` — `DeleteSessionDialog`, `DeleteSessionBody`, `TRACES_COPY` · `update-banner.tsx` — default `UpdateBanner` · `dock-state-key.ts` — `dockStateKey`

**Composer, keyboard, dictation, menus**
- `composer.tsx` — `Composer`, `enterAction` · `composer-actions.tsx` — `ComposerActions`, `NodePickerControl`
- `keyboard-shortcuts.tsx` — `KeyboardShortcuts` (the global shortcut keydown listener), re-exports `kbdEventForAction`
- `dictation.tsx` — `useDictation`, `DictationBar`, `useDictationTarget`, `createWarmMinter`/`WarmMinter`, `rmsToMeter`, `joinDictation`, `isDictationActive`, `finishDictation`, `Dictation`, `DictationPhase`, `DEEPGRAM_KEY_ID`, `DICTATION_KEYLESS`, `WARM_TOKEN_TTL_MS`, `METER_TICK_MS`, `METER_CELLS`
- `enter-submits.ts` — `useEnterSubmits`, `buttonKeepsNativeEnter` · `field-cycle.ts` — `useFieldCycle` · `focus-hygiene.ts` — `blurAfterPointerClick` · `backdrop-dismiss.ts` — `useBackdropDismiss` · `popover-dismiss.ts` — `usePopoverDismiss`
- `menu-shell.tsx` — `MenuShell`, `computeMenuPlacement`, `MenuPlacement`, `MenuSide`, `MenuAlign`, `MENU_OPEN_EVENT`, `MENU_CLOSE_EVENT`

**Transcript rendering**
- `md-blocks.tsx` — `mdComponents`, `MarkdownCode`, `MarkdownBlockquote`, `MarkdownTable`, `MathDisplay`, `MarkdownStrong`, `CopyCorner`, `codeSource`, `parseAlertMarker`, `ParsedAlert`
- `thinking-block.tsx` — `ThinkingBlock`, `currentUserThinkingOpen`, `setAllUserThinkingOpen` · `braille-spinner.tsx` — `BrailleSpinner`, `SPINNER_FRAME_MS`, `SPINNER_FRAMES`
- `mermaid-render.ts` — `renderMermaid`, `mermaidTheme`, `MERMAID_FONT_SIZE` · `mermaid-error.tsx` — `MermaidError` · `session-overlay.tsx` — `MermaidOverlay`, `SessionMermaidContext`, `useSessionMermaid`, `chartSize`
- `session-find.tsx` — `SessionFind`, `injectFindStyles`, `clearSessionFindHighlights`, `sessionFindHasForegroundLayer`, `SESSION_FIND_HIGHLIGHT`, `SESSION_FIND_ACTIVE_HIGHLIGHT` · `session-find-dom.ts` — `sessionFindRanges`, `sessionRangeIdentity`, `sameSessionRange`, `SessionRangeIdentity` · `session-navigation.tsx` — `SessionMessageNavigation`, `scrollSessionTarget`, `SessionScrollContext`
- `latex-glyph.tsx` — `LatexGlyph`, `latexGlyphHtml` · `lh-mark.tsx` — `LhMark`

**Subdirectories**
- [ai-elements](./ai-elements/CLAUDE.md) — transcript primitives (Conversation, Message, Reasoning, Shimmer)
- [artifacts](./artifacts/CLAUDE.md) — `artifactRenderers` registry and the tool-part/artifact cards
- [settings](./settings/CLAUDE.md) — settings dialog sections, appearance variables, subscription bridges
- [ui](./ui/CLAUDE.md) — base controls (Button, Tooltip, Hint, GlyphMark, …)

## Invariants
- **Import law** (`eslint.config.mjs`, `lint` gates every change): `components/**` imports from `src/` ONLY `@/src/core` — never `@/src/server`, `src/agent`, or `src/store`. No domain logic lives here; grading, view projection (`projectView`), plan statuses, layout, prices and keyboard bindings come from core. IO is `/api/*` HTTP, one `EventSource`, and browser APIs — never `fs`, never `data/`.
- **One view protocol** (`session-core.ts`): every turn is a server-side process; the client is a view. `send` POSTs ONE explicit input event `{chatId, input}` to `/api/chat`; the response stream and the reattach stream (`GET /api/chats/:id/stream`) are the SAME verbatim AgentEvent SSE applied by the same function. Status vocabulary is exactly `ready | submitted | streaming | error`. One live consume at a time (a newer consume aborts the older). A 409 means a turn is racing: poll `/api/jobs?chatId` `turnInFlight` every `TURN_POLL_MS` up to `TURN_WAIT_MAX_MS`, then surface it.
- **Optimistic tail**: locally minted entries carry `c_`-prefixed ids; the server write-ahead absorbs them by CONTENT match (`absorbed`), never by id; the tail dies on every full sync. `fetch` is stored through a receiver-preserving wrapper (unbound `window.fetch` throws in browsers).
- **Question tools are client-graded**: `quiz` / `probe` / `ask_user_question` / `explain` / `recall` tool parts never render in the transcript while pending — the pending call lives in `QuestionDock` (which replaces the composer); `output-available` parts render as `AnsweredCard`. The dock parses and grades with question-core from `@/src/core` (`parseQuizInput`/`parseAskInput`/`parseExplainInput`, `resolveCorrect`, `buildAnswer`), and quiz options are shuffled with `shuffleOptions(options, seededRandom(toolCallId))` so the order is reproducible from the call id on both sides. The verdict goes back as an `answer` `ChatInput` through `SessionModel.send`, which appends an optimistic `newAnswerResult` tool result and POSTs it; silent dismissals go through `dismissQuestion` → `/api/chats/:id/dismiss` and never count as learner answers. During error recovery an answer is never re-POSTed once the record shows the call resolved.
- **Artifact extension point**: `chat.tsx` renders unhandled `tool-*` parts via `artifacts/index.ts` (`input-streaming` → `LiveToolCard`; settled → the registry card). Add renderers in `components/artifacts/`, not in `chat.tsx`. `plan_*` parts render nothing inline; the phase seam is `PhaseDivider`.
- **Jobs feed**: `JobsContext` is filled by ONE fetch in `Chat` (mount, `jobs-changed` event, resync); dispatch cards and the activity section are pure renderers of it. Absent data renders "—", never zero.
- **Graph canvas** (`graph-canvas.ts`): a dumb draw function over plain data — it never computes a position (layout runs in `graph-view.tsx` via core `layout`); one canvas, one `requestAnimationFrame` loop with a dirty flag, at most one draw per frame and no frame while idle; the camera lives in the renderer so refetches and settings changes never move it; node labels fade out and cluster labels fade in over the same zoom span (`LABELS_FADE_RATIO`).
- **Plan blocks** are frozen snapshots rendered exactly as carried; only `PlanPopup` is live (latest tree, statuses via core `derivePlanStatuses`). Placement is dagre (deterministic, synchronous, DOM-free) so SSR and render tests are exact.
- **Keyboard**: one global shortcut listener (`KeyboardShortcuts`); `useEnterSubmits` and the Settings → Keyboard rebind capture add their own scoped keydown listeners; Tab is suppressed everywhere; Esc is a layered dismiss (popover → dictation cancel → turn abort); global actions dispatch `lh:kbd-<action>` window events composed ONLY by `kbdEventForAction`; the action registry and persisted overrides live in `src/core/keyboard.ts`.
- **Push channel**: `server-events.tsx` is the ONLY file that knows `EventSource` exists — one `EventSource("/api/events")` per window; every (re)open fires resync callbacks; consumers respond by fetching truth (notify → fetch), never by trusting the frame payload.
- **Dictation**: audio never passes through the app server — the AudioWorklet streams PCM straight to the Deepgram WebSocket using a short-lived token from `/api/stt/token`; a generation counter makes stale async handlers no-ops; the transcript is deferred and flushed once at stop.
- **Sidebar**: `rendered = pref && !narrow`; auto-close below the width threshold never touches the persisted preference.
- **SSR-clean**: render tests use React `renderToStaticMarkup` (no DOM library) — every component must render without `window`/`document` at module load; browser access happens inside effects/handlers only.

## Side Effects
- **HTTP** (`fetch`, relative `/api/*`): `/api/chat` (POST turn input), `/api/chats`, `/api/chats/:id` (+`?mode=`), `/api/chats/:id/stream` (reattach SSE), `/api/chats/:id/steer`, `/api/chats/:id/dismiss`, `/api/chats/:id/settings`, `/api/chats/:id/artifact-ui`, `/api/chats/:id/markdown` (export download anchor in `sidebar.tsx`), `/api/jobs?chatId=`, `/api/activity`, `/api/activity/abort`, `/api/graph`, `/api/graph/status`, `/api/graph/positions`, `/api/graph/nodes/:id`, `/api/graph/import`, `/api/graph/costs`, `/api/graph/render-settings`, `/api/graph/coverage/extract`, `/api/search`, `/api/models`, `/api/keys`, `/api/keys/:id`, `/api/settings` (+ sections), `/api/stt/token`, `/api/subscriptions` (web bridge in `settings/subscription-client.ts`), `/api/events` (`EventSource`).
- **External network**: Deepgram streaming `WebSocket` opened directly from the browser (`dictation.tsx`), with `getUserMedia` + `AudioContext`/AudioWorklet capture.
- **Browser storage**: `localStorage` — `lh:sidebar-open` and `lh:session-kind-filter` (`sidebar.tsx`), `lh.graph.camera.v1` (the persisted graph camera, `graph-view.tsx`), plus the keyboard overrides documented in `./settings/CLAUDE.md`.
- **Window events**: dispatches/listens `lh:kbd-<action>`, `lh:settings-saved`, `lh:menu-open` / `lh:menu-close`, `lh:chat-renamed`, `lh:turn-state`, `lh:graph-revision`, `lh:toggle-sidebar`, `lh:update-status`, `lh:zoom`; `DemoCard` listens to iframe `message` events.
- **Electron bridge** `window.lh` (when present): `platform` (sets the `lh-electron` class and `data-lh-platform` on `<html>`), `onZoom`/`getZoom` (drives the `--lh-zoom` CSS variable), `chatgpt`, `onOpenSettings`, `expandWindow`, update status/install, subscription sign-in.
- **DOM**: `session-find` injects a highlight `<style>` and uses the CSS Custom Highlight API; `md-blocks` writes to `navigator.clipboard`; `session-navigation` reads/writes `window.location.hash`; mermaid renders asynchronously into the document; downloads create transient anchors (`artifacts/download.ts`, `ai-elements/conversation.tsx`, `sidebar.tsx` markdown export).

## Verification
- Run: `npm test`
