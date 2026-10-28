# components/ui

## Overview
The base control kit for the browser shell: shadcn/Radix-style primitives
(`Button`, `ButtonGroup`, `Collapsible`, `Input`, `Textarea`, `Separator`,
`Tooltip`) styled with `cva` variants, plus two app-specific primitives —
`Hint` (a tooltip that appends the control's LIVE keyboard binding, e.g.
"Dictate (⌘D)") and `GlyphMark` (LaTeX-pifont-faithful ✓/✗ marks baked in as
static SVG geometry). Every other `components/**` surface composes these;
nothing here knows about sessions, graphs, or the server.

## Interface
- `button.tsx` — `Button`, `buttonVariants`
- `button-group.tsx` — `ButtonGroup`, `ButtonGroupSeparator`, `ButtonGroupText`, `buttonGroupVariants`
- `collapsible.tsx` — `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`
- `input.tsx` — `Input` · `textarea.tsx` — `Textarea` · `separator.tsx` — `Separator`
- `tooltip.tsx` — `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`, `TOOLTIP_DELAY_MS`
- `hint.tsx` — `Hint({ label, action?, binding?, side?, children })`, `hintText(label, action?, binding?)` (pure composition, pinned by `tests/tooltip-mechanism.test.tsx`)
- `glyph-mark.tsx` — `GlyphMark({ kind, className? })`, `MarkKind = "check" | "x"`

## Invariants
- Import law (`eslint.config.mjs`): from `src/` only `@/src/core` may be imported (`Hint` reads `KeyAction` and the binding helpers from the core keyboard registry).
- Pure presentation: no fetch, no storage, no domain logic. Everything renders cleanly under `renderToStaticMarkup` (the render tests have no DOM library).
- `Hint`'s `children` must be a single ref-able element — `TooltipTrigger asChild` merges onto it, no wrapper DOM. Pass `action` for registry shortcuts (override-aware: a rebind in Settings → Keyboard changes the suffix live) or `binding` for surface-owned keys ("escape", "enter") the registry deliberately does not dispatch.
- `GlyphMark` embeds glyph outlines as SVG paths (the KaTeX pattern) — never rendered as font text; each mark's viewBox is its own ink box.
- Variants are declared once via `cva`; callers select by prop, never by re-styling the primitive.

## Side Effects
- None beyond React rendering. Tooltips mount Radix portals in the document.

## Verification
- Run: `npm test`
