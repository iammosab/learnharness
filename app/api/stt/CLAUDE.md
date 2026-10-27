# app/api/stt

## Overview
Speech-to-text route group. No direct handler; dictation starts by minting a token in the child.

## Subdirectories & Boundaries
- token: [./token/CLAUDE.md](./token/CLAUDE.md) - `GET` short-lived Deepgram access token (503 no key, 502 grant failure).
