# Hono + Better Auth + Paystack

This example wires Better Auth and `better-auth-paystack` into a Hono Cloudflare Worker.

## Setup

1. Install dependencies and build the library from the repository root:

```txt
vp install
vp pack
```

2. Install example deps:

```txt
vp -C examples/hono install
```

3. Configure local env:

- Copy `.dev.vars.example` to `.dev.vars`
- Fill in `BETTER_AUTH_SECRET` and `PAYSTACK_SECRET_KEY`

Note: Paystack webhook verification uses the same Paystack secret key for the `x-paystack-signature` HMAC. `PAYSTACK_WEBHOOK_SECRET` is optional and can be set to the same value as `PAYSTACK_SECRET_KEY`.

## Run

```txt
vp -C examples/hono dev
```

Better Auth is mounted at `http://localhost:8787/api/auth/*`. The example also exposes:

- `/api/billing` for callback verification, catalog sync, and trusted renewal operations
- `/api/health` and `/openapi.json` for service checks and API discovery
- `/.well-known/api-catalog` and `/mcp` for agent-facing discovery

Run the example checks with:

```txt
vp -C examples/hono typecheck
vp -C examples/hono test
vp -C examples/hono build
```

## Notes

- This uses `memoryAdapter`, so data resets on deploy/restart. Use D1/KV-backed storage for production.
- The Paystack client uses the typed `@alexasomba/paystack-node` grouped client surface expected by the plugin.
- Organization billing, five subscription plans, trials, products, transactions, and cancellation/restore/portal actions are exposed through the Better Auth client API.
- Paystack routes require `PAYSTACK_SECRET_KEY`; Better Auth routes still work with only `BETTER_AUTH_SECRET`.
