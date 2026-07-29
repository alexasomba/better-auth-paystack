---
name: better-auth-paystack-setup
description: >
  Configure @alexasomba/better-auth-paystack with Better Auth. Use when adding the paystack() server plugin, paystackClient() client plugin, schema overrides, products/plans, webhook verification, or canonical authClient.paystack/subscription/transaction actions.
type: core
library: "@alexasomba/better-auth-paystack"
library_version: "3.0.1" # x-release-please-version
license: "MIT"
compatibility: "Node.js >=22.0.0; better-auth ^1.6.9; @alexasomba/paystack-node 1.10.x; @alexasomba/better-auth-paystack >=3.0.0 <4.0.0"
sources:
  - "alexasomba/better-auth-paystack:README.md"
  - "alexasomba/better-auth-paystack:src/index.ts"
  - "alexasomba/better-auth-paystack:src/client.ts"
  - "alexasomba/better-auth-paystack:src/schema.ts"
---

## Setup

Install the package alongside Better Auth and a Paystack client:

```ts
import { betterAuth } from "better-auth";
import { createPaystack } from "@alexasomba/paystack-node";
import { paystack } from "@alexasomba/better-auth-paystack";

const paystackSdk = createPaystack({
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
});

export const auth = betterAuth({
  database: {
    provider: "sqlite",
    url: process.env.DATABASE_URL!,
  },
  plugins: [
    paystack({
      paystackClient: paystackSdk,
      secretKey: process.env.PAYSTACK_SECRET_KEY!,
      subscription: {
        enabled: true,
        plans: [
          {
            name: "pro",
            amount: 500_000,
            currency: "NGN",
            interval: "monthly",
            planCode: "PLN_pro_monthly",
            paystackId: "123456",
          },
        ],
      },
    }),
  ],
});
```

Add the client plugin in browser-safe code:

```ts
import { createAuthClient } from "better-auth/client";
import { paystackClient } from "@alexasomba/better-auth-paystack/client";

export const authClient = createAuthClient({
  plugins: [paystackClient()],
});
```

## Core Patterns

### Use canonical client namespaces

The client plugin exposes these namespaces:

```ts
await authClient.paystack.config();
await authClient.transaction.initialize({
  amount: 500_000,
  email: "user@example.com",
});
await authClient.transaction.verify({ reference: "trx_ref" });
await authClient.transaction.list();
await authClient.subscription.create({ plan: "pro" });
await authClient.subscription.upgrade({ plan: "team" });
await authClient.subscription.cancel({ subscriptionId: "sub_id" });
await authClient.subscription.restore({ subscriptionId: "sub_id" });
await authClient.subscription.list();
await authClient.subscription.billingPortal();
```

`subscription.disable` and `subscription.enable` are legacy compatibility aliases. Prefer `cancel` and `restore` in new code.

### Keep schema behavior stable

The plugin always contributes Paystack product and plan tables:

- `paystackProduct`
- `paystackPlan`

Subscription tables are included when `subscription.enabled` is true. User and transaction tables are always included. Organization fields are included when `organization.enabled` is true.

Use Better Auth-style schema overrides only to rename models or fields. Do not remove the Paystack product/plan tables unless you are making a breaking major release.

### Use public Better Auth imports in package code

Runtime code should import from public Better Auth entrypoints:

```ts
import { betterAuth } from "better-auth";
import { createAuthClient } from "better-auth/client";
import type { BetterAuthPluginDBSchema } from "better-auth/db";
```

Do not add runtime imports from `@better-auth/core/*` in this package. Tests can use internals only if no public API covers the case.

## Common Mistakes

### Calling server-only helpers from the browser

Wrong:

```ts
import { syncPaystackPlans } from "@alexasomba/better-auth-paystack";

await syncPaystackPlans(auth.$context, options);
```

Correct: call admin helpers from server jobs, cron handlers, CLI scripts, or trusted server routes only.

### Inventing a separate webhook secret

Paystack signs `x-paystack-signature` with the same secret key used for API authentication:

```ts
paystack({
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
});
```

Do not introduce `PAYSTACK_WEBHOOK_SECRET`, `webhook.secret`, or `paystackWebhookSecret`. The two
options remain deprecated source-compatibility fields and are ignored.

### Treating plans as just display data

Plans are used to validate billing operations and map Paystack plan codes. Include stable `name`, `amount`, `currency`, `interval`, `planCode`, and `paystackId` values when subscriptions are enabled.
