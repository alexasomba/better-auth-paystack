---
name: paystack-testing-fixtures
description: >
  Test better-auth-paystack changes. Use for choosing focused vp test commands, Better Auth test clients, in-memory adapters, mocked Paystack SDK responses, webhook signatures, TanStack example tests, integration tests, type-safety tests, and verification before landing changes.
type: core
library: "better-auth-paystack"
library_version: "3.2.0" # x-release-please-version
license: "MIT"
compatibility: "Node.js >=22.0.0; better-auth ^1.6.9; @alexasomba/paystack-node 1.10.x; better-auth-paystack >=3.0.0 <4.0.0"
sources:
  - "alexasomba/better-auth-paystack:test/paystack.test.ts"
  - "alexasomba/better-auth-paystack:test/local_subscription.test.ts"
  - "alexasomba/better-auth-paystack:test/seat_billing.test.ts"
  - "alexasomba/better-auth-paystack:test/typesafety.test.ts"
  - "alexasomba/better-auth-paystack:examples/tanstack/src/__tests__"
---

## Test Selection

Use `vp test` instead of invoking Vitest directly.

Focused suites:

- core plugin routes, schema, webhooks, products, org billing: `vp test test/paystack.test.ts`
- local-managed subscriptions and authorization capture: `vp test test/local_subscription.test.ts`
- seat billing, proration, local renewal UI paths: `vp test test/seat_billing.test.ts`
- planCode and organization integration regressions: `vp test test/plancode-and-org.integration.test.ts`
- package type contracts: `vp test test/typesafety.test.ts`
- TanStack example components/routes: `pnpm --filter ./examples/tanstack test`

Broad gates before landing:

```bash
vp check
vp test
```

Run integration tests only when needed and credentials/environment are available:

```bash
RUN_INTEGRATION_TESTS=1 vp test
```

## Fixture Patterns

### Mock Paystack SDK at the adapter boundary

Mocks should resemble `@alexasomba/paystack-node` grouped operations:

```ts
const paystackClient = {
  transaction: {
    initialize: vi.fn().mockResolvedValue({
      data: { reference: "REF", authorization_url: "..." },
    }),
    verify: vi.fn().mockResolvedValue({ data: { status: "success", reference: "REF" } }),
    chargeAuthorization: vi.fn(),
  },
  subscription: {
    create: vi.fn(),
    fetch: vi.fn(),
    disable: vi.fn(),
    enable: vi.fn(),
    manageLink: vi.fn(),
  },
};
```

The package supports SDK `PaystackResponse` objects and legacy/custom nested `{ data }` test shapes.
Do not overfit tests to only one response wrapper unless the change is specifically about
`unwrapSdkResult`.

### Sign webhooks like Paystack

Webhook tests should create the exact JSON payload string, sign it with HMAC SHA-512, and send the
signature in `x-paystack-signature`.

### Use Better Auth client behavior realistically

For browser-style flows, sign up/sign in and pass cookies into the auth client. Use `{ throw: true }`
when the test should fail immediately on Better Auth errors.

## Common Mistakes

### Only testing the root package after example changes

The TanStack example has its own component and route tests. Run its test/build command when touching
`examples/tanstack`.

### Skipping type tests for client API changes

Any change to `src/client.ts`, route return shapes, or public exports should run
`test/typesafety.test.ts`.

### Assuming live Paystack is available

Most tests should use mocked SDK operations. Keep live/integration tests opt-in.
