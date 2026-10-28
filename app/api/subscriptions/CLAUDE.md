# app/api/subscriptions

## Overview
Subscription-connection controls (provider subscriptions used in place of API keys). The handler is re-exported wholesale from the server barrel.

## Interface
- `export const GET = subscriptionControlsResponse` and `export const POST = subscriptionControlsResponse` (`@/src/server`). `runtime = "nodejs"`, `dynamic = "force-dynamic"`.
- Subdirectories: [browser](./browser/CLAUDE.md) — browser-side connection flow (`GET`/`POST`).

## Invariants
- No request handling in the route; semantics live in `subscriptionControlsResponse`.
- Node runtime is required (not Edge).

## Side Effects
- Whatever the server seam performs on subscription-connection state; none added here.

## Verification
- Run: `npm test`
