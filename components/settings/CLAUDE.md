# components/settings

## Overview
The settings dialog and its sections: Agent (the three model slots —
strong/cheap/vision — tool toggles, search engine, prompt-override
switches), Keys (BYOK provider table), Appearance + Graph (runtime CSS
variables applied on `<html>`), Keyboard (rebind over the core registry),
Updates (Electron auto-update), and the subscription connections (ChatGPT
and native pi providers) that work through either the web HTTP bridge or
the Electron `window.lh` bridge. Also the shared dropdown machine
(`model-menu.tsx`) that the chat model picker and the slot rows reuse, and
the thin control kit (`controls.tsx`) every section is built from.

## Interface
- `settings-dialog.tsx` — `SettingsDialogProvider`, `useSettingsDialog()`, `SettingsDialogBody`
- `controls.tsx` — `SettingsSection`, `SettingsGroup`, `SettingsRow`, `Toggle`, `ThinSelect`, `CommitInput`
- `agent-section.tsx` — `AgentSection`, `TOGGLE_TOOLS`, `PROMPT_IN_USE_HINT`, `PromptSection`, pure composers `composeTool`, `composeQuizMechanics`, `composeGraphTools`, `composeSlotModel`, `composeSearchEngine`, `composePromptSwitch`, `sectionedSegments`
- `keys-section.tsx` — `KeysSection`, `ProviderKeyInfo`, `classifyKeys(...)`, `keyStatusLine(status)`
- `appearance.tsx` — `AppearanceProvider`, `useAppearance()`, `resolveAppearance(delta)`, `derivedPalette(background)`, `appearanceVars(a)`, `staleVarNames(...)`
- `appearance-section.tsx` — `AppearanceSection`, `GraphSection`, `composeFontFamily(...)`, `DEFAULT_READING_FONT`, `CURATED_FALLBACK_FONTS`
- `keyboard-section.tsx` — `KeyboardSection`, `nextOverrides(...)`
- `model-menu.tsx` — `ModelMenuList`, `ThinkingMenuList`, `ProviderMenuList`, `FontMenuList`, `fontMenuResults(query, families)`, `customFamilyFor(query, families)`
- `update-settings.tsx` — `UpdateSettings`, `useUpdateState()`, `updateStatusText(state)`, `UpdateState`, `APP_VERSION`, `MANUAL_UPDATE_HINT`, `AUTO_UPDATE_HINT`
- `chatgpt-connection.tsx` — `ChatGPTUIProvider`, `ChatGPTConnection`, `ChatGPTBackgroundAccess`, `chatGPTNotice(web?)`, `CHATGPT_NOTICE`, `CHATGPT_BACKGROUND_HINT`, `CHATGPT_DISCONNECT_COPY`
- `subscription-connections.tsx` — `NativeSubscriptionUIProvider`, `NativeSubscriptionConnection`, `SubscriptionConnections`, `NativeSubscriptionBackgroundAccess`, `subscriptionNotice`, `subscriptionDisconnectCopy`, `emptySubscriptionStatus`, `COPILOT_POLICY_NOTICE`, `SUBSCRIPTION_BACKGROUND_HINT`
- `subscription-client.ts` — `createWebChatGPTBridge(hub)`, `createWebNativeBridge(hub)`, `useChatGPTBridge()`, `useNativeSubscriptionBridge()`
- `connection-controls.tsx` — `ConnectionRow`, `ConnectionFooter`, `ConnectionDialog`

## Invariants
- Import law: from `src/` only `@/src/core` (settings/agent/appearance contract types, keyboard registry, model-catalog shapes).
- The `compose*` helpers are pure: they return a new `AgentSettings`/font string and never mutate the input (render/unit tests pin them).
- Appearance: a write PUTs the whole `appearance` section and the returned delta is applied IMMEDIATELY as CSS variables (`setProperty` on `<html>`) — nothing re-renders; `staleVarNames` clears variables no longer in the resolved set. Mode is dark-only this wave (the control renders disabled with a note).
- Keyboard overrides are overrides-only, merged over `DEFAULT_BINDINGS` from the core registry; `displayOnly` actions are listed but never rebindable; no conflict detection by design.
- Keys: env-owned rows (a real environment variable owns the name) render read-only; the Add-provider control is the table's last row and uses the shared `ProviderMenuList`.
- Model slots: the catalog (`/api/models`) serves only keyed providers; the slot rows and the chat picker use the one `ModelMenuList` machine (fuzzy search, arrow-walk, Enter pick).
- Subscription bridges: the Electron bridge (`window.lh.chatgpt` / `window.lh.subscriptions`) is used when present, otherwise the web bridge talks to `/api/subscriptions` with the `x-learnharness-subscriptions: 1` header and refreshes on notify-hub events. Dependency graying follows the render-panel convention (whole row dims, control locks).
- Every section SSRs clean (render tests pin the markup).

## Side Effects
- HTTP: `GET/PUT /api/settings`, `/api/settings/:section`, `/api/settings/prompts`, `/api/settings/prompts/:path`; `GET /api/keys`, `PUT/DELETE /api/keys/:id`; `GET /api/models`; `GET /api/search` (search-engine row); `/api/subscriptions` (web bridge). (`PUT /api/settings/models` is issued by `../model-picker.tsx` and `../setup-dialog.tsx`, not from this directory.)
- Browser storage: keyboard overrides persist in `localStorage` (`lh:keymap`, written through the core keyboard registry's save helper; read post-mount so SSR stays clean). The dialog shell itself keeps no storage of its own.
- DOM: runtime CSS variables on `document.documentElement` (`AppearanceProvider`).
- Window events: `notifySettingsSaved(section)` dispatches `lh:settings-saved` (`../settings-signal.ts`) so other surfaces refetch.
- Electron IPC via `window.lh` (update check/install, subscription sign-in, `openSubscriptionBrowser`, the `subscriptionTransport` probe, `onOpenSettings` shell-to-dialog hook); `window.open` for browser sign-in in the web build.

## Verification
- Run: `npm test`
