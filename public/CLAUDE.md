# public

## Overview

Static assets served verbatim by Next.js at the site root and copied into the
standalone server bundle that the Electron launcher runs. Nothing here passes
through the TypeScript/ESLint import law or the bundler. The only code child is
`worklets/`; `fonts/` and `siwc/` hold non-code assets (font files and
"Sign in with ChatGPT" static resources) and carry no contract.

## Subdirectories & Boundaries

- worklets: [./worklets/CLAUDE.md](./worklets/CLAUDE.md) - `pcm-capture.js`
  AudioWorklet that converts mic audio to linear16 PCM and streams level and
  audio frames to `components/dictation.tsx`.
- fonts: static font files (no code; no contract).
- siwc: static assets for the Sign-in-with-ChatGPT flow (no code; no
  contract).
