# electron

## Overview

The desktop shell for LearnHarness: plain Node CommonJS (`.cjs`), no
framework, deliberately outside the project's ESLint import law (see
`eslint.config.*` `globalIgnores`). `main.cjs` is the launcher and security
guard. In packaged mode it spawns the Next standalone server
(`<resources>/server/standalone/server.js`) as a Node-mode child
(`process.execPath` with `ELECTRON_RUN_AS_NODE=1`) bound to `127.0.0.1` on a
free port, polls until it answers HTTP, then loads a sandboxed
`BrowserWindow`. With `LH_DEV_URL` set it spawns nothing and points the window
at `next dev`.

Main also owns the ChatGPT OAuth connection and the subscription-connection
credential stores (GitHub Copilot, xAI), hands credential leases to the server
child over inherited Node IPC, runs `electron-updater`, and has a
`--browser-service` mode that turns the same binary into a hidden Chromium
CDP helper. `preload.cjs` is the only bridge into the renderer and exposes a
minimal, explicit `window.lh` surface.

## Interface

- `main.cjs` (entry point, no exports)
  - Constants: `PRODUCT_NAME = "LearnHarness"`, `SIDEBAR_AUTOCLOSE = 928`;
    paths `AUTH_FILE()` = `userData/auth.json`, `DATA_DIR()` =
    `userData/data`, `serverEntry()` =
    `process.resourcesPath/server/standalone/server.js`.
  - Internal functions: `freePort`, `log`, `startServer(port)`, `waitUntilUp(url, tries = 150)`, `killServer`, `createWindow(url)`, `setupAutoUpdater`, `reportUpdateStatus`, `automaticUpdatesEnabled`, `checkForUpdates({ manual })`, `checkForUpdatesFromMenu`, `installUpdateNow`, `installMenu`, `zoomStep`, `applyZoom` (clamped to [0.75, 2]), `main`. Constants `ZOOM_LADDER`, `UPDATE_CHECK_INTERVAL_MS`. The `updateState` snapshot `{ status, version, revision }` is what `lh:update-status` pushes.
  - Renderer IPC (`ipcMain.handle`): `lh:chatgpt:control`,
    `lh:subscriptions:control`, `lh:subscriptions:web-browser` (dev only),
    `lh:update:get`, `lh:update:check`, `lh:zoom:get`. (`ipcMain.on`):
    `lh:update-install`, `lh:expand-window`. Pushed to renderers:
    `lh:chatgpt:changed`, `lh:subscriptions:changed`, `lh:zoom`,
    `lh:update-status`, `lh:open-settings`.
  - Env read: `LH_DEV_URL` (dev mode; userData gets a `-dev` suffix and the
    renderer gets `--lh-web-subscriptions`), `LH_UPDATE_FEED` (update feed
    override). Env set on the child only: `ELECTRON_RUN_AS_NODE=1`,
    `NODE_ENV=production`, `PORT`, `HOSTNAME=127.0.0.1`, `LH_DATA_DIR`,
    `LH_AUTH_FILE`, `LH_DESKTOP_SERVER=1`, `LH_DESKTOP_API_SECRET` (32 random
    bytes hex, per launch).
  - Argv: `--browser-service` (helper mode; prints
    `BROWSER_SERVICE_CDP <port>` to stdout when ready).
- `preload.cjs` — `contextBridge.exposeInMainWorld("lh", {...})`:
  `platform`; `chatgpt.{status, login(id), cancel, select(id),
  disconnect(id), logout(id), consent(enabled), onChange(cb)}`;
  `subscriptions.{status, login(providerId, enabled), cancel,
  respond(providerId, attemptId, promptId, value), open(providerId,
  attemptId, actionId), retry, disconnect, consent, onChange}`;
  `expandWindow`, `onZoom`/`getZoom`, `onUpdateStatus`, `installUpdate`,
  `getUpdateState`, `checkForUpdates`, `onOpenSettings(cb)` (buffered until
  subscribed). Only with `--lh-web-subscriptions`: `subscriptionTransport =
  "web"` and `openSubscriptionBrowser(action)`.
- `chatgpt.cjs` — `createChatGPT({ store, openExternal, fetch, onChange = () => {}, timeoutMs = 180000 })`, `fileStore(file)`, `publicError`,
  `allowedAuthEndpoint`, `SCOPES`, `validateState`. Issuer
  `https://auth.openai.com`, resource `https://api.openai.com/v1`; verifies
  JWTs with a dynamically imported `jose`.
- `chatgpt-ipc.cjs` — `attachChatGPTChild(child, connection)` (child IPC
  channel `lh:chatgpt`, ops `status`/`models`/`lease`; returns `{ send,
  dispose }`), `trustedSender(event, origin, BrowserWindow)`,
  `chatGPTControl(command, connection)`.
- `subscriptions.cjs` — `createSubscriptions({ directory, loadSDK,
  openExternal, onChange, stores? })`, `loadSubscriptionSDK(baseDirectory)`
  (dynamic import from the standalone server dir), `publicError`,
  `validEndpoint` (xAI must be `https://api.x.ai/v1`; Copilot defaults to
  `https://api.individual.githubcopilot.com`), `LABELS`.
- `subscription-ipc.cjs` — `attachSubscriptionChild(child, controller)`
  (child IPC channel `lh:subscriptions`, ops `snapshot`/`lease`, pushes
  `changed`), `subscriptionControl(command, controller)`, `validScope(scope)`
  (requires `providerId`, `connectionId`, `selectedModelId`, `epoch`,
  `authorityRevision`).
- `subscription-store.cjs` — `PROVIDERS = ["github-copilot", "xai"]`,
  `failure`, `validateCredential`, `validateState`, `safeDomain`,
  `safeHttps`, `fileStore(file, providerId, io)`.
- `web-subscription-browser.cjs` — `openWebSubscriptionBrowser(action,
  origin, { fetch, openExternal })`; `action` must match
  `^/api/subscriptions/browser?id=<36-char uuid>$`.
- `browser-service-readiness.cjs` — `waitForBrowserService(port, { signal,
  timeoutMs = 5000, requestTimeoutMs = 500, retryMs = 50 })`; polls
  `http://127.0.0.1:<port>/json/version` and resolves the validated
  `ws://127.0.0.1:<port>/devtools/browser/<id>` URL.
- `desktop-api.cjs` — `desktopAPIHeaders(details, origin, secret, windows)`,
  `HEADER = "x-learnharness-desktop"`.
- `server-title-guard.cjs` — no exports; `--require` preload for the darwin
  server child that replaces `process.title` with a JS-only getter/setter
  when `ELECTRON_RUN_AS_NODE=1` and `LH_DESKTOP_SERVER=1`.
- No subdirectories.

## Invariants

- Single-instance lock (`app.requestSingleInstanceLock()`): a second launch
  quits itself and the first window is restored/focused; two instances would
  fight over the data dir. In dev, `userData` becomes `<userData>-dev`
  before the lock check so the dev shell never touches real app data.
  `app.setName("LearnHarness")` must run before the `-dev` suffix.
- The `--browser-service` branch runs before the lock and before the dev
  userData redirect; the helper is a second instance of the same binary that
  owns no user data, refuses to start without a parent IPC
  (`process.channel`), and quits when that IPC disconnects.
- All mutable state lives under `userData` (`auth.json`, `data/`, `logs/`,
  `*-credentials.json`), never inside the app bundle. The Next child owns `LH_DATA_DIR` and reads/writes `auth.json` itself; main only `existsSync`-checks them, except that `automaticUpdatesEnabled` reads `data/settings.json` before each automatic update check. Main must NOT inject
  BYOK keys into the child env (a spawn-time copy would shadow
  settings-page edits); it passes `LH_AUTH_FILE` only. Keys ride env or
  files, never argv. The child binds `HOSTNAME=127.0.0.1`, never `0.0.0.0`.
- Packaged startup order in `main()`: `freePort`, generate `desktopAPISecret`, install `onBeforeSendHeaders`, create chatgpt, create subscriptions, await `subscriptions.ready`, `startServer`, `waitUntilUp(url)`, register the chatgpt/subscriptions IPC handles, `installMenu`, `setupAutoUpdater`, register the update/zoom/expand IPC handles, `createWindow`, then the first update check and the 24 h interval. The window loads only after the server answers HTTP.
- The child never outlives the shell: `killServer` is wired to
  `before-quit`, process `exit` and `SIGHUP` (SIGTERM, then SIGKILL after
  3 s). When the child exits, both IPC attachments are disposed and
  chatgpt/subscriptions are closed.
- Every renderer-facing `handle` except `lh:zoom:get` (and the `on`
  channels) checks that the sender's window is in `trustedAppWindows` and
  `trustedSender()` confirms the main frame at the exact app origin.
- Tokens, OAuth URLs and codes never reach the renderer. Credential leases
  go only to the server child over Node IPC (`lh:chatgpt`,
  `lh:subscriptions`); errors cross via `publicError()`. `preload.cjs` must
  stay a minimal explicit surface: no raw `ipcRenderer`, no
  `desktopAPIHeaders`, no secret.
- ChatGPT and subscription controls require `serverProcess.connected`;
  otherwise status returns `unavailable`/`[]` and mutations error.
- `x-learnharness-desktop` is stripped from every outgoing request and
  re-added only for same-origin `/api` or `/api/*` requests without userinfo
  from a trusted window's main frame whose `initiatorOrigin` is absent or
  equal to the app origin. Any check failure leaves the header off.
- `BrowserWindow` runs with `contextIsolation: true`, `sandbox: true`, and
  `preload.cjs`. Permission handlers allow only the app origin plus an
  allow-list. Cross-origin `will-navigate` is blocked and routed to
  `shell.openExternal`; `window.open` always goes to `openExternal`.
- `lh:subscriptions:web-browser` works only with `LH_DEV_URL` set and a
  trusted sender; it accepts only the opaque
  `/api/subscriptions/browser?id=<uuid>` action and the redirect must be a
  303 to an `https` URL without userinfo.
- Credential files are mode `0600` in a `0700` directory. On read, the subscription store (`subscription-store.cjs`) rejects a file that is a symlink, has group/other bits, or is owned by another uid (check skipped on win32); the ChatGPT store does a plain read plus `validateState`. Writes are atomic (temp opened `wx`, fsync, rename, dir fsync).
  Corrupt files are never auto-repaired; they surface as a `storage`
  failure. No keychain/`safeStorage` is used.
- On `window-all-closed`, chatgpt and subscriptions are paused and the app
  quits except on darwin; `reopenWindow` resumes them before creating a new
  window. A main-process `uncaughtException` is logged, not fatal.

## Side Effects

- Spawns `process.execPath` with `[--require server-title-guard.cjs
  (darwin), serverEntry()]`, `cwd` = standalone dir, `stdio
  ["ignore", "pipe", "pipe", "ipc"]`; child stdout/stderr forwarded to
  `log()`. The CDP helper is spawned by the Next server, not by main.
- Filesystem writes under `userData`: `logs/main.log` (append),
  `chatgpt-credentials.json`, `<providerId>-credentials.json` for
  `github-copilot` and `xai`. `auth.json` and `data/` are written only by the child; main `existsSync`-checks them and reads `data/settings.json` for the auto-update gate.
- Network: `waitUntilUp` polls `http://127.0.0.1:<port>` every 200 ms (up
  to 150 tries); `freePort` binds a temporary listener on `127.0.0.1:0`;
  ChatGPT OAuth opens a loopback callback server at
  `http://127.0.0.1:<random>/auth/callback` and fetches
  `auth.openai.com`/`api.openai.com`; subscriptions fetch `api.x.ai` and
  Copilot endpoints; `openWebSubscriptionBrowser` POSTs to the app origin
  with `x-learnharness-subscriptions: 1` (15 s timeout); `electron-updater` checks a GitHub feed (or `LH_UPDATE_FEED`) at startup and every 24 h with `autoDownload` and `autoInstallOnAppQuit` (packaged builds only); automatic checks are skipped when `settings.general.autoUpdate === false` in `data/settings.json`, manual checks bypass the gate.
- `session.defaultSession`: `webRequest.onBeforeSendHeaders` on
  `<all_urls>` (packaged), `setPermissionRequestHandler`,
  `setPermissionCheckHandler`.
- Window/app mutation: 1440x900 `BrowserWindow` (min 640x600) with hidden title bar and a custom `Menu`; a `before-input-event` handler intercepts Cmd/Ctrl `=`/`+`/`-`/`0` for zoom (`zoomStep`/`applyZoom`); helper mode creates a hidden `about:blank` window, appends
  `remote-debugging-port`, hides the dock icon. `app.setName`,
  `app.setPath("userData", ...-dev)` in dev, `process.title` override in
  the darwin child. Main's own `process.env` is not mutated.
- `shell.openExternal` for OAuth pages, provider pages, blocked navigations
  and `window.open`. Dynamic `import("jose")`; `loadSubscriptionSDK` uses
  `module.registerHooks`/`createRequire` to import from the standalone dir.

## Verification

- Run: `npm test`
- Packaging gate (exercises the shell end to end): `npm run desktop:dist`
  (see `../scripts/CLAUDE.md`).
