---
name: paystack-billing-flows
description: >
  Build Paystack transaction and subscription flows with @alexasomba/better-auth-paystack. Use for initialize/verify transaction, create/upgrade/cancel/restore/list subscriptions, products/plans, billing portal links, webhooks, reconcilePaystackTransaction, chargeSubscriptionRenewal, syncPaystackProducts, and syncPaystackPlans.
type: core
library: "@alexasomba/better-auth-paystack"
library_version: "3.0.1" # x-release-please-version
license: "MIT"
compatibility: "Node.js >=22.0.0; better-auth ^1.6.9; @alexasomba/paystack-node 1.10.x; @alexasomba/better-auth-paystack >=3.0.0 <4.0.0"
sources:
  - "alexasomba/better-auth-paystack:README.md"
  - "alexasomba/better-auth-paystack:src/routes.ts"
  - "alexasomba/better-auth-paystack:src/operations.ts"
  - "alexasomba/better-auth-paystack:src/client.ts"
---

## Setup

Enable subscriptions with concrete Paystack plan metadata:

```ts
import { paystack } from "@alexasomba/better-auth-paystack";

paystack({
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
  subscription: {
    enabled: true,
    plans: [
      {
        name: "starter",
        amount: 250_000,
        currency: "NGN",
        interval: "monthly",
        planCode: "PLN_starter",
        paystackId: "1001",
      },
      {
        name: "team",
        amount: 1_000_000,
        currency: "NGN",
        interval: "monthly",
        planCode: "PLN_team",
        paystackId: "1002",
        limits: {
          seats: 10,
          teams: 3,
        },
      },
    ],
  },
});
```

## Core Patterns

### Initialize and verify a transaction

Use the client plugin for browser-triggered checkout:

```ts
const initialized = await authClient.transaction.initialize({
  amount: 250_000,
  email: "customer@example.com",
  currency: "NGN",
  metadata: {
    product: "starter-pack",
  },
});

const verified = await authClient.transaction.verify({
  reference: initialized.data.reference,
});
```

Do not trust a redirect callback alone. Always verify the Paystack reference before granting access or updating billing state.

### Manage subscription lifecycle

Use canonical methods in new code:

```ts
await authClient.subscription.create({
  plan: "starter",
});

await authClient.subscription.upgrade({
  plan: "team",
});

await authClient.subscription.cancel({
  subscriptionId: "subscription_id",
});

await authClient.subscription.restore({
  subscriptionId: "subscription_id",
});

const subscriptions = await authClient.subscription.list();
```

Legacy aliases:

- `subscription.disable` maps to `subscription.cancel`
- `subscription.enable` maps to `subscription.restore`

Keep aliases only for compatibility tests or migration examples.

### Keep renewal and catalog sync server-side

These helpers are exported by the server package and are intentionally not client actions:

```ts
import {
  chargeSubscriptionRenewal,
  reconcilePaystackTransaction,
  syncPaystackPlans,
  syncPaystackProducts,
} from "@alexasomba/better-auth-paystack";

export async function runBillingJob(ctx: unknown, options: unknown) {
  await reconcilePaystackTransaction(ctx, options, {
    reference: "paystack_reference",
    source: "queue",
    referenceId: "user_or_org_id",
  });
  await syncPaystackProducts(ctx, options);
  await syncPaystackPlans(ctx, options);
  await chargeSubscriptionRenewal(ctx, options, {
    subscriptionId: "subscription_id",
  });
}
```

Use cron, background jobs, or trusted server functions. Do not call these from a browser component.

`reconcilePaystackTransaction` verifies the Paystack reference and applies the same local transaction, customer, product, subscription, trial, and proration side effects used by the browser verify endpoint. Use it for webhook handlers, queue retries, cron jobs, and admin repair actions.

## Common Mistakes

### Mutating Paystack-managed subscriptions like local subscriptions

Seat-based or prorated subscription changes require locally managed subscription state. Paystack-managed subscriptions do not support every local mutation path.

Before implementing seat changes, check whether the target plan is local/seat-aware and whether the operation is supported by the helper being used.

### Skipping webhook verification

Configure `secretKey` and let the plugin verify incoming webhook payloads with that same Paystack
API key. Do not invent a separate webhook secret or process Paystack webhook bodies through an
unrelated JSON route that bypasses the plugin endpoint.

### Mixing plan name and Paystack plan code

Use `plan.name` for app-facing plan selection and `plan.planCode`/`paystackId` for Paystack identity. Do not send a Paystack plan code where the plugin expects the configured plan name.
