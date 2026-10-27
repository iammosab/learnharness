# components/artifacts

## Overview
The tool-part renderer registry and the artifact cards it points at. `chat.tsx`
renders every `tool-*` part it does not specially handle (the question tools —
quiz / probe / ask_user_question / explain / recall — go to the question dock
and `AnsweredCard`) by looking the tool name up in `artifactRenderers`. Cards
follow the ack-and-steer protocol (`src/core/contracts/jobs.ts`): for
background sub-agents (research, pdf, demo, visual) the tool part's output is
only the dispatch ACK, live status comes from the chat's jobs feed
(`JobsContext`), and the real result arrives later as a user-role steer
message rendered by `SubagentSteerCard`. Synchronous learner-filesystem and
graph tools (`read`/`ls`/`find`/`grep`/`list_sessions`/`list_propositions`)
render as quiet collapsed `ToolCallCard`s.

## Interface
- `index.ts` — `artifactRenderers: Record<string, ComponentType<ArtifactPartProps>>` — THE extension point (`research`, `pdf`, `demo`, `visual`, `probe_done`, `read`, `ls`, `find`, `grep`, `problem`, `conclude`, `list_sessions`, `list_propositions`). `problem`/`conclude` map to `ProblemCard`/`ConcludeCard` from `../practice-cards.tsx`.
- `dispatch-card.tsx` — `DispatchCard({ toolCallId, kind })` (dispatched → running → done/error from `JobsContext`)
- `job-card.tsx` — `JobCard`, `PdfJobCard`, `ResearchBriefCard({ output })`, `PdfBriefCard({ output })`
- `steer-card.tsx` — `SubagentSteerCard({ message })` (renders `data-subagent-artifact` steer parts; never a learner bubble)
- `demo-card.tsx` — `DemoCard`, `DemoOutputCard`, `DemoErrorChip`, `buildDemoSrcDoc(html)`, `DEMO_BRIDGE_SCRIPT`, `DemoBridgeState`, `INITIAL_DEMO_BRIDGE_STATE`, `reduceDemoBridgeState(state, data)` (pure)
- `visual-card.tsx` — `VisualCard`, `VisualOutputCard`, `svgNaturalWidth(svg)`
- `svg-image.tsx` — `SvgImage`, `svgImageSource(svg)` (display-only repairs: missing `xmlns`, `&nbsp;`)
- `probe-done-card.tsx` — `ProbeDoneCard({ part })`
- `tool-call-card.tsx` — `ToolCallCard({ part })`
- `live-tool-card.tsx` — `LiveToolCard({ part })` (the `input-streaming` working state; used directly by `chat.tsx`, not via the registry)
- `download.ts` — `slugFilename(title)` (pure, test-pinned; falls back to `"demo"`, capped at 64 chars), `downloadFile(name, text, mime)`
- `invert-disc.tsx` — `InvertDiscIcon`

## Invariants
- Import law: from `src/` only `@/src/core` (`ArtifactPartProps`, `JobKind`, `LhViewMessage`, steer/job contract types). Cross-file deps use `@/components/...` paths.
- Add a renderer HERE (`index.ts`), never a new `case` in `chat.tsx`. Unregistered tools render nothing. `plan_*` parts intentionally have no renderer (the phase seam is drawn by `PhaseDivider`).
- Background-job cards never render the result from the tool part — the part output is the ACK string; the artifact rides the steer message. A dispatch card must not duplicate the artifact that follows it.
- Demos run in an iframe with `sandbox="allow-scripts"` and NO `allow-same-origin`. The resize/error bridge is injected by `buildDemoSrcDoc`, never authored by the model; bridge messages fold through the pure `reduceDemoBridgeState`.
- Generated SVG is displayed as an image document (`SvgImage`) so its markup and styles never join the app DOM; `svgImageSource` is a display boundary, not a sanitizer, and downloads keep the original SVG verbatim.
- `ProbeDoneCard` renders the input only while pending or after validation (`output-available`); an `output-error` part's input was rejected and is never rendered.
- `ToolCallCard` is collapsed by default (tool name + headline argument), shows the headline argument as given, and `outputText` renders strings verbatim.
- `LiveToolCard` owns only the `input-streaming` state; once a call settles the registry card replaces it.

## Side Effects
- `downloadFile` creates a blob URL, clicks a synthetic anchor, and revokes the URL (click-time only).
- `DemoCard`/`VisualCard` call `/api/chats/:id/artifact-ui` (artifact UI preferences) and `DemoCard` listens to `window` `message` events from the sandboxed iframe; "Send to teacher" feeds an error back through `ChatActionsContext` (a turn).
- `DispatchCard` reads `JobsContext` (populated by one central `GET /api/jobs?chatId=…` in `chat.tsx`); it performs no fetch of its own.

## Verification
- Run: `npm test`
