# components/ai-elements

## Overview
Vendored "AI Elements" transcript primitives, adapted to this app: the
scroll-pinned `Conversation` (built on `use-stick-to-bottom`), the `Message`
family (bubble, content, actions, branch selector, Streamdown-rendered
`MessageResponse`), the collapsible `Reasoning` block, and the `Shimmer`
text animation that is the app's one "working" grammar (paired with the
Braille spinner). `chat.tsx` composes these; they carry no session knowledge.

## Interface
- `conversation.tsx` — `Conversation`, `ConversationContent`, `ConversationEmptyState`, `ConversationScrollButton`, `ConversationDownload`, `messagesToMarkdown(...)`, and their `*Props` types
- `message.tsx` — `Message({ from })`, `MessageContent`, `MessageActions`, `MessageAction`, `MessageBranch`/`MessageBranchContent`/`MessageBranchSelector`/`MessageBranchPrevious`/`MessageBranchNext`/`MessageBranchPage`, `MessageResponse` (memoized Streamdown), `ToolContentResponse`, `MessageToolbar`, `streamdownPlugins`, and `*Props` types
- `reasoning.tsx` — `Reasoning`, `ReasoningTrigger`, `ReasoningContent`, `useReasoning()`, `ReasoningProps`/`ReasoningTriggerProps`/`ReasoningContentProps`
- `shimmer.tsx` — `Shimmer`, `TextShimmerProps`

## Invariants
- Import law: from `src/` only `@/src/core`. Internal deps are `../ui/*` (Button, ButtonGroup, Collapsible, Tooltip), sibling modules `md-blocks`, `braille-spinner`, `focus-hygiene`, `@/lib/utils`, and third-party render libs (Streamdown, motion, use-stick-to-bottom).
- `streamdownPlugins` is the single markdown/math plugin configuration for assistant text; `MessageResponse` is memoized so streaming re-renders stay cheap.
- `Conversation` renders `role="log"` and owns scroll pinning; callers never manage the scroll position themselves (`ConversationScrollButton` uses the context).
- `Reasoning` state (`isStreaming`, `isOpen`, `setIsOpen`; no duration) is context-scoped per block via `useReasoning()`; the trigger and content must be descendants of `Reasoning`.
- `Shimmer` caches `motion.create(element)` components at module level — never create motion components during render.
- All components SSR cleanly (render tests use `renderToStaticMarkup`).

## Side Effects
- `ConversationDownload` creates an anchor element in the document to save the transcript as Markdown; otherwise DOM rendering only. No network, no storage.

## Verification
- Run: `npm test`
