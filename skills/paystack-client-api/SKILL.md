---
name: paystack-client-api
description: >
  Modify or use the @alexasomba/better-auth-paystack browser client API. Use for paystackClient(), authClient.paystack, authClient.transaction, authClient.subscription, initializeTransaction, verifyTransaction, listTransactions, listSubscriptions, listProducts, listPlans, subscription billingPortal/manageLink, cancel/restore aliases, BetterFetch throw option return types, and deprecated disable/enable behavior.
type: core
library: "@alexasomba/better-auth-paystack"
library_version: "2.6.0" # x-release-please-version
license: "MIT"
compatibility: "Node.js >=24.0.0; better-auth ^1.6.9; @alexasomba/paystack-node 1.10.x; @alexasomba/better-auth-paystack >=2.4.2 <3.0.0"
sources:
  - "alexasomba/better-auth-paystack:src/client.ts"
  - "alexasomba/better-auth-paystack:src/routes.ts"
  - "alexasomba/better-auth-paystack:test/typesafety.test.ts"
  - "alexasomba/better-auth-paystack:examples/tanstack/src/lib/paystack-client.ts"
---

## Client Contract

Install the browser plugin from the client entrypoint:

```ts
import { createAuthClient } from "better-auth/client";
import { paystackClient } from "@alexasomba/better-auth-paystack/client";

export const authClient = createAuthClient({
  plugins: [paystackClient({ subscription: true })],
});
```

The plugin exposes three public surfaces:

- `authClient.paystack`: top-level Paystack actions
- `authClient.transaction`: transaction namespace
- `authClient.subscription`: subscription namespace

`authClient.paystack.paystack` points back to the same actions object for compatibility.

## Core Patterns

### Prefer stable names in examples

Use these methods in new examples and application code:

```ts
await authClient.paystack.config();
await authClient.paystack.listProducts();
await authClient.paystack.listPlans();
await authClient.paystack.initializeTransaction({ amount: 500_000 });
await authClient.paystack.verifyTransaction({ reference: "REF" });
await authClient.paystack.listTransactions();

await authClient.transaction.initialize({ amount: 500_000 });
await authClient.transaction.verify({ reference: "REF" });
await authClient.transaction.list();

await authClient.subscription.create({ plan: "starter" });
await authClient.subscription.upgrade({ plan: "team" });
await authClient.subscription.list();
await authClient.subscription.billingPortal({ subscriptionCode: "SUB_code" });
await authClient.subscription.cancel({ subscriptionCode: "SUB_code", atPeriodEnd: true });
await authClient.subscription.restore({ subscriptionCode: "SUB_code" });
```

`subscription.manageLink` is an alias for `subscription.billingPortal`.

### Preserve deprecated aliases

`subscription.disable` maps to `subscription.cancel`.
`subscription.enable` maps to `subscription.restore`.

Keep these aliases in the 2.x line for compatibility, but do not introduce them in new examples.

### Respect BetterFetch return typing

Methods use `FetchResult<T, O>`:

- with `{ throw: true }`, the promise resolves to `T`
- without `{ throw: true }`, the promise resolves to `BetterFetchResponse<T>`

When changing method signatures, update both the interface and implementation, then run type tests.

## Common Mistakes

### Using old `getConfig`

The stable method is `authClient.paystack.config()`. Do not add new examples that call
`authClient.paystack.getConfig()`.

### Passing query data in the body for list endpoints

List endpoints use GET with query data:

```ts
await authClient.subscription.list({ query: { referenceId: "org_123" } });
await authClient.transaction.list({ query: { referenceId: "org_123" } });
```

### Importing the server package in browser code

Browser code should import only `@alexasomba/better-auth-paystack/client`. Server helpers such as
`syncPaystackPlans` and `chargeSubscriptionRenewal` belong in server functions, cron jobs, or trusted
routes.

## Verification

Run these after client API changes:

```bash
vp test test/typesafety.test.ts
vp test test/paystack.test.ts
```

Run TanStack example tests when examples or client usage are changed:

```bash
pnpm --filter ./examples/tanstack test
```
