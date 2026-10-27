# lib

## Overview

Tiny shared-utility package for the Next.js UI. It currently holds a
single helper, `cn`, that merges Tailwind class lists. It is imported through
the `@/lib/utils` path alias by roughly 27 component and app files, so changes
here ripple through the whole UI layer. No domain logic belongs here; this is
a presentation-layer helper only.

## Interface

- `utils.ts`
  - `cn(...inputs: ClassValue[]): string` — wraps `clsx` then `twMerge`.
    Accepts strings, arrays, objects, and falsy values; returns a single
    de-duplicated Tailwind class string with later conflicting utilities
    winning.
- No subdirectories.

## Invariants

- Pure and synchronous: `cn` has no state and must stay free of side effects
  so it can be called in render paths and server components alike.
- Keep this package dependency-light (`clsx`, `tailwind-merge` only). Do not
  add data access, Node-only APIs, or framework imports; the file is bundled
  into client components.
- Any new helper added here must be safe for both server and client bundles.

## Side Effects

- None. No I/O, no network, no global mutation.

## Verification

- Run: `npm test`
