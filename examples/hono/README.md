# Hono + Better Auth + Paystack

This example wires Better Auth and `@alexasomba/better-auth-paystack` into a Hono Cloudflare Worker.

## Setup

1. Build the library once (repo root):

```txt
npm install
npm run build
```

2. Install example deps:

```txt
cd examples/hono
npm install
```

3. Configure local env:

- Copy `.dev.vars.example` to `.dev.vars`
- Fill in `PAYSTACK_SECRET_KEY` and `PAYSTACK_WEBHOOK_SECRET`

## Run

```txt
npm run dev
```

Better Auth is mounted at `http://localhost:8787/api/auth/*`.

## Notes

- This uses `memoryAdapter`, so data resets on deploy/restart.
- The Paystack SDK in this example is a tiny fetch-based client for Worker compatibility.
