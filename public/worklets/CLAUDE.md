# public/worklets

## Overview

AudioWorklet processors served as static files. The single worklet,
`pcm-capture.js`, is the dictation (speech-to-text) audio path: it runs off the
main thread, converts microphone `Float32` samples to 16-bit little-endian PCM
(linear16), and posts level and audio frames back to the page. It is loaded by
`components/dictation.tsx` via `audioContext.audioWorklet.addModule(...)`.

It is plain JavaScript on purpose: worklets execute outside the module graph
and cannot import from `src/` or be bundled by Next. Living under `public/`
also guarantees it ships inside the standalone server bundle used by the
Electron launcher.

## Interface

- `pcm-capture.js`
  - `class PcmCaptureProcessor extends AudioWorkletProcessor`
    - `process(inputs)` — reads channel 0 of input 0; returns `true` always
      (keeps the node alive even with no input).
  - `registerProcessor("pcm-capture", PcmCaptureProcessor)` — the node name
    the page must use in `new AudioWorkletNode(ctx, "pcm-capture")`.
  - Messages posted on `port`:
    - `{ type: "level", rms: number }` — one per render quantum (128 samples,
      about 8 ms at 16 kHz); `rms` is in the float domain, 0..1.
    - `{ type: "audio", buffer: Int16Array }` — one per 2048 samples
      (128 ms at 16 kHz); the underlying `ArrayBuffer` is transferred
      (zero-copy), so the worklet allocates a fresh frame after each post.
- No subdirectories.

## Invariants

- Frame size is fixed at 2048 Int16 samples; consumers (the Deepgram socket
  writer) rely on ~100-200 ms chunks.
- Silence is streamed too: frames are emitted at a steady cadence regardless
  of signal, so the upstream socket never idles.
- Samples are clamped to [-1, 1] before conversion; negative values scale by
  `0x8000`, positive by `0x7fff`.
- Must remain dependency-free, non-module JS (no `import`/`export`, no
  TypeScript) and must not reference DOM or Node APIs.
- The registered name `"pcm-capture"` and the message shapes are the contract
  with `components/dictation.tsx`; change both together.

## Side Effects

- `port.postMessage` to the main thread (level messages every quantum, audio
  frames every 2048 samples) with `ArrayBuffer` transfer.
- No network, storage, or DOM access.

## Verification

- Run: `npm test`
