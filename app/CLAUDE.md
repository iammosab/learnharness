# app

## Overview
The Next.js App Router tree: the root layout and home page, the chat and settings pages, and the REST API under `api/`. Pages are server components that read through the `@/src/server` barrel and hand props to client components in `components/`; API routes are transport-only wrappers over server entry points. This directory is the only place framework routing lives.

## Interface
- `layout.tsx` — `default RootLayout({ children })` and `metadata` (`title: "Learning Harness"`). Loads JetBrains Mono (`--font-jetbrains`) and Source Sans 3 (`--font-sans3`) via `next/font/google`, imports `katex` CSS and `./globals.css`, and nests `ServerEventsProvider > AppearanceProvider > SidebarProvider > ActivityProvider > AppShell`, plus `UpdateBanner`.
- `page.tsx` — `default HomePage()`; `force-dynamic`. Reads `readSettingsRecord()`, resolves `resolveSettings(record).graph.rendering`, renders `<Home initialConfigured={slotsConfigured(record?.models)} rendering />`.
- `globals.css` — the design-token skin: Tailwind v4 import, `dark` custom variant, palette/radius/type-scale tokens, and the global focus-outline reset.
- Subdirectories:
  - [api](./api/CLAUDE.md) — REST route handlers (transport only).
  - [chat](./chat/CLAUDE.md) — session page ([chat/[id]](./chat/%5Bid%5D/CLAUDE.md)) and draft view ([chat/new](./chat/new/CLAUDE.md)).
  - [settings](./settings/CLAUDE.md) — redirect to `/chat/new`.

## Invariants
- Import law (`eslint.config.mjs`, `docs/architecture.md`): `app/**` imports from `src/` only through the barrels `@/src/core` and `@/src/server`; UI comes from `@/components/*`.
- Route handlers contain no domain logic; they parse, delegate, and map outcomes to status codes.
- Pages that read state are `force-dynamic` so every navigation re-reads the record (the first-run model-slot gate must be true on the first frame).
- `ServerEventsProvider` sits outside every other provider so the SSE channel is shared by sidebar, dock, and pages.
- All spacing, type, radii, and colors come from the tokens in `globals.css`; components never invent pixel values.

## Side Effects
- Pages read the chat store and settings record per request. API children write the chat/settings/graph stores, start background turns and extraction runs, hold SSE connections, and (stt/token) call Deepgram.

## Verification
- Run: `npm test`
