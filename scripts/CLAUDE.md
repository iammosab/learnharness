# scripts

## Overview

Build/packaging guards, dev helpers, and one-shot data scripts. Like
`electron/`, this directory is deliberately outside the ESLint import law
(`globalIgnores` in `eslint.config.*`), so scripts may import directly from
`src/` and wire their own composition roots. Three groups:

1. Packaging and release gates run by `npm run desktop:dist` and the release
   workflow: `smoke-provider-runtime.mjs`, `build-server.mjs`,
   `smoke-server.mjs`, `smoke-demo-runtime.mjs`, `after-pack.cjs`,
   `verify-release.ts`.
2. Asset and dev tooling: `make-icons.mjs`, `dev-fresh.sh`,
   `smoke-web-subscriptions.mjs` (offline Next runtime gate).
3. One-shot data scripts that are extra composition roots and, by design,
   extra graph writers: `backfill-graph.ts`, `import-notes.ts`,
   `replay-layout.ts`.

## Interface

- `after-pack.cjs` — `module.exports = async function afterPack(context)`; electron-builder
  `afterPack` hook (`electron-builder.yml`). On darwin only, copies
  `build/icon.icns` over `<app>.app/Contents/Resources/icon.icns`
  (replaces actool's 256 px fallback).
- `backfill-graph.ts` — `npx tsx --env-file=.env.local
  scripts/backfill-graph.ts [chatId]`. Builds
  `createExtractionPipeline({ chatStore, graphStore, getChunkTokens })`
  and runs `pipeline.runExtraction(chat.id)` for every chat (or the one
  given), then logs `getGraph(graphStore)` totals. No npm script.
- `build-server.mjs` — step 3 of `desktop:dist`. Requires
  `.next/standalone/server.js` and `.next/static`; copies `.next/static`
  and `public/` into `.next/standalone`; deletes `standalone/dist` and
  `standalone/node_modules/electron`; exits 1 if the payload contains
  `data/`, `auth.json`, `(chatgpt|github-copilot|xai)-credentials.json*`,
  `.env` or `.env.local`; asserts `src/agent/system-prompt.md` and
  `src/agent/prompts/teacher/20-teaching.md` are in the trace.
- `dev-fresh.sh` — `npm run dev:fresh` or `bash scripts/dev-fresh.sh
  [--port N] [--keep] [-h]`. Default port 3005; exports
  `LH_DATA_DIR=<root>/.fresh-data`, `LH_AUTH_FILE=<root>/.fresh-data/auth.json`,
  `LH_IGNORE_ENV_KEYS=1`, `PORT`, then `exec npm run dev`.
- `import-notes.ts` — `npx tsx --env-file=.env.local
  scripts/import-notes.ts <dir> [concurrency]` (defaults
  `real-data-extraction/learn-sessions`, 4). Sends every
  `*.md`/`*.markdown`/`*.txt` through `pipeline.importNotes({ filePath,
  text })` using the stores from `src/server/stores.ts`. No npm script.
- `make-icons.mjs` — `node scripts/make-icons.mjs`; renders
  `build/icon-flat.svg` with `@resvg/resvg-js` into `build/icon.ico`
  (16-256 px entries) and `build/icon.png` (512 px). Outputs are committed.
- `replay-layout.ts` — `npx tsx scripts/replay-layout.ts
  [--depth=vertical|radial]`. Replays the graph through
  `incrementalLayout` one source batch at a time (in
  `graphStore.readSources()` `importedAt` order) and
  `graphStore.writePositions(...)`. No LLM calls.
- `smoke-demo-runtime.mjs` — library and CLI: `node
  scripts/smoke-demo-runtime.mjs --standalone <dir> --runtime <binary>
  [--browser]`. Exports `probeEnv(env, home)`, `formatProbeError(error,
  depth)`, `verifyDemoRuntime(standalone, runtime, browser)`,
  `stopBrowserService(helper)`. Re-spawns itself with `--probe`; with
  `--browser` spawns the app binary with `--browser-service`. Run by
  `.github/workflows/release.yml` against packaged mac/win/linux payloads.
- `smoke-provider-runtime.mjs` — step 2 of `desktop:dist`; also called by `smoke-server` and run directly by `.github/workflows/release.yml` against packaged payloads. `node scripts/smoke-provider-runtime.mjs [--standalone
  <dir>] [--runtime <node|electron>]`. Exports
  `verifyProviderRuntime(standalone, runtime)`. Spawns a `--probe` child
  (`ELECTRON_RUN_AS_NODE=1`, 30 s timeout, temp home) that calls
  `closeNetwork()` (fetch/WebSocket/http/https/net/tls/dgram/dns throw and
  are counted) and drives the `google`, `opencode`, `opencode-go` providers
  from the payload's `@earendil-works/pi-ai` with a dummy key until the
  `LH_OFFLINE_ON_PAYLOAD_<uuid>` sentinel; parent requires the stdout
  marker `native Pi Google initialization passed`.
- `smoke-server.mjs` — step 4 of `desktop:dist` (flag `--electron` to use
  `require("electron")` as runtime). Runs `verifyDemoRuntime` and
  `verifyProviderRuntime`, spawns `.next/standalone/server.js` on
  `127.0.0.1` at a free port with a temp `LH_DATA_DIR` and empty
  `LH_AUTH_FILE`, polls `GET /` until 200 (500 ms, 30 s), then GETs
  `/api/graph`, `/api/models`, `/api/settings`.
- `smoke-web-subscriptions.mjs` — offline Next runtime gate; no npm script
  or workflow reference. Imports `SCOPES` from `../electron/chatgpt.cjs`
  and pi-ai providers; writes a temp profile (`auth.json`, fetch-override
  preload, synthetic `chatgpt-`/`github-copilot-`/`xai-credentials.json`)
  and spawns `node_modules/next/dist/bin/next <mode> -p <port>` with a minimal env (`PATH`, `HOME`, `TMPDIR`, `LH_AUTH_FILE`, `LH_DATA_DIR`, XDG and agent config-dir overrides, `NEXT_TELEMETRY_DISABLED=1`, and `NODE_OPTIONS=--import=<fetch-override preload>`).
- `verify-release.ts` — final release gate. `npx tsx
  scripts/verify-release.ts select <releases.json> --tag <tag>` and
  `... verify <releases.json> <metadata-dir> --tag <tag>` (release
  workflow). Exports `checkVersion`, `expectedAssets`,
  `normalizeReleasePages`, `parseReleases`, `selectDraft`,
  `verifyConfigAssumptions`, `verifyAssets`, `feedExpectations`,
  `isPlainAssetName`, `verifyMetadataFiles`; `main(argv)` runs only when
  invoked as CLI.
- No subdirectories.

## Invariants

- `desktop:dist` order is fixed: `rm -rf dist .next/standalone` ->
  `next build` -> `smoke-provider-runtime.mjs` -> `build-server.mjs` ->
  `smoke-server.mjs` -> `electron-builder --mac --arm64`
  (`DEVELOPER_DIR` defaulting to Xcode, `APPLE_KEYCHAIN_PROFILE=LH_NOTARY`, `APPLE_TEAM_ID=JS6XN22HY6`). Any
  failing gate stops packaging.
- Next must be built with `output: "standalone"` before `build-server`,
  `smoke-server`, or the `smoke-*-runtime` scripts run.
- The standalone payload must never contain `data/`, `auth.json`,
  `*-credentials.json`, `.env`, or `.env.local` (`build-server` enforces;
  `outputFileTracingExcludes` in `next.config.ts` backs it).
- Smoke probes require every `file:` module to resolve inside the standalone
  payload (`registerHooks` + realpath containment; fails on "dependency
  escaped standalone payload"); only `node:` builtins may resolve outside.
- Smoke scripts need no network, no real keys, and no real data: the
  provider gate hard-denies all network APIs and asserts zero attempts;
  probes use `probeEnv` (drops `KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL`
  vars, cloud-provider prefixes, `NODE_OPTIONS`, `NODE_PATH`, `LH_DEV_URL`,
  `ELECTRON_RUN_AS_NODE`), `LH_IGNORE_ENV_KEYS=1`, and a temp
  `HOME`/`LH_DATA_DIR`/`LH_AUTH_FILE`. `smoke-server` sends only
  side-effect-free GETs and always kills its child (a leaked server holds
  the port).
- `verify-release` only reads; the workflow never publishes from it. It
  pins exact asset names for app-builder-lib 26.15.3 (mac
  `-arm64.dmg`/`-arm64-mac.zip` + `.blockmap` + `latest-mac.yml`; windows
  `-x64-setup.exe` + `.blockmap` + `latest.yml`; linux `-x86_64.AppImage` (no blockmap) + `-amd64.deb` + `latest-linux.yml`) and checks electron-builder config and
  `package.json` match.
- `dev-fresh.sh` refuses ports 3000-3004 (standing assignments) and treats
  `.fresh-data/` as disposable.
- Data scripts (`backfill-graph`, `import-notes`) run from the owning tree
  only ("data never crosses trees") and need `--env-file=.env.local` for
  provider keys. They are intentional second graph writers; keep them in
  sync with `src/server/stores.ts` and the extraction pipeline contract.
- `make-icons` outputs are committed; rerun only when the design changes.

## Side Effects

- Real data-dir mutation: `backfill-graph.ts` and `import-notes.ts` write
  graph nodes/chains via the extraction pipeline and make LLM/provider
  network calls; `replay-layout.ts` overwrites the graph positions ledger
  (`graphStore.writePositions`) only.
- `build-server.mjs` copies into and `rmSync -rf`s inside
  `.next/standalone`. `make-icons.mjs` overwrites `build/icon.ico` and
  `build/icon.png`. `after-pack.cjs` overwrites `icon.icns` inside the
  packaged `.app`.
- `dev-fresh.sh` runs `rm -rf <root>/.fresh-data` unless `--keep`, exports
  env, and execs `npm run dev`.
- Smoke scripts create temp dirs under `os.tmpdir()` (`lh-demo-runtime-*`,
  `lh-provider-runtime-*`, `lh-smoke-*`), write a temp `auth.json` (`0600` in the runtime gates; `smoke-server` writes `{}` with the default mode), spawn
  child processes (self with `--probe`, the server, the Electron binary with
  `--browser-service`), make localhost HTTP GETs, and remove the temp dir in
  `finally`. `smoke-web-subscriptions` writes a temp profile, spawns the
  `next` CLI, and temporarily touches a source file's mtime to trigger a
  dev reload (restored afterwards).
- `verify-release.ts` reads JSON and repo config, sets `process.exitCode`;
  writes no files and makes no network calls.

## Verification

- Run: `npm test`
- Packaging gates: `npm run desktop:dist` (runs the smoke scripts in
  order). Release gate: `npx tsx scripts/verify-release.ts ...` in
  `.github/workflows/release.yml`.
