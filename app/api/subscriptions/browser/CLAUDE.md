# app/api/subscriptions/browser

## Overview
Browser-driven subscription-connection endpoint. The handler is re-exported wholesale from the server barrel.

## Interface
- `export const GET = subscriptionBrowserResponse` and `export const POST = subscriptionBrowserResponse` (`@/src/server`). `runtime = "nodejs"`, `dynamic = "force-dynamic"`.

## Invariants
- No request handling in the route; method semantics are defined entirely by `subscriptionBrowserResponse`.
- Node runtime is required (not Edge).

## Side Effects
- Whatever the server seam performs (subscription-connection state and browser flow); none added here.

## Verification
- Run: `npm test`
