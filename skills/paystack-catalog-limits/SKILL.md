---
name: paystack-catalog-limits
description: >
  Configure products, Paystack-native plans, local-managed plans, free trials, seat billing, resource limits, and catalog sync in better-auth-paystack. Use when tasks mention planCode, freeTrial, trial eligibility, seatAmount, seatPlanCode, limits, products, syncPaystackProducts, or syncPaystackPlans.
type: core
library: "better-auth-paystack"
library_version: "3.2.1" # x-release-please-version
license: "MIT"
compatibility: "Node.js >=22.0.0; better-auth ^1.6.9; @alexasomba/paystack-node 1.10.x; better-auth-paystack >=3.0.0 <4.0.0"
sources:
  - "alexasomba/better-auth-paystack:README.md"
  - "alexasomba/better-auth-paystack:src/types.ts"
  - "alexasomba/better-auth-paystack:src/routes.ts"
  - "alexasomba/better-auth-paystack:src/operations.ts"
  - "alexasomba/better-auth-paystack:src/utils.ts"
---

## Setup

Configure catalog data on the server plugin. Products are one-time purchasable catalog items. Plans are subscription catalog items.

```ts
import { paystack } from "better-auth-paystack";

export const paystackPlugin = paystack({
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
  products: {
    products: [
      {
        name: "credits_50",
        amount: 200_000,
        currency: "NGN",
      },
    ],
  },
  subscription: {
    enabled: true,
    plans: [
      {
        name: "pro",
        amount: 500_000,
        currency: "NGN",
        interval: "monthly",
        planCode: "PLN_pro_monthly",
        paystackId: "1001",
        freeTrial: {
          days: 14,
        },
        limits: {
          seats: 10,
          teams: 5,
        },
      },
    ],
  },
});
```

## Core Patterns

### Choose Paystack-native plans for simple recurring billing

Use `planCode` from the Paystack Dashboard when Paystack should manage the recurring subscription.

```ts
{
  name: "pro",
  amount: 500_000,
  currency: "NGN",
  interval: "monthly",
  planCode: "PLN_pro_monthly",
  paystackId: "1001",
}
```

Paystack-native plans are the right default for fixed-price recurring billing. Do not use native plans for flows that require local seat proration or locally managed renewals.

### Omit planCode for local-managed subscriptions

Local-managed plans are tracked in your database and renewed from stored Paystack authorizations by trusted backend code.

```ts
{
  name: "local-team",
  amount: 1_000_000,
  currency: "NGN",
  interval: "monthly",
  seatAmount: 100_000,
  limits: {
    seats: 10,
    teams: 3,
  },
}
```

For local-managed subscriptions, no `planCode` means the plugin captures and stores the authorization code after transaction verification. Trigger renewals from server code with `chargeSubscriptionRenewal`.

### Configure trials on plans

Trials are declared per plan:

```ts
{
  name: "starter",
  amount: 250_000,
  currency: "NGN",
  interval: "monthly",
  planCode: "PLN_starter",
  paystackId: "1002",
  freeTrial: {
    days: 7,
    onTrialStart: async (subscription) => {
      await notifyTrialStarted(subscription.referenceId);
    },
  },
}
```

The plugin checks previous subscription history for the `referenceId`. If a trial was ever used, expired, or marked `trialing`, another trial is denied for that reference. Do not build UI that promises repeat trials for the same user or organization.

### Configure seats and resource limits

Use `limits` for app resource enforcement and `seatAmount` for local seat billing amounts:

```ts
{
  name: "team",
  amount: 1_000_000,
  currency: "NGN",
  interval: "monthly",
  seatAmount: 100_000,
  seatPlanCode: "PLN_extra_seat",
  limits: {
    seats: 10,
    teams: 3,
  },
}
```

`seatPriceId` is a deprecated alias. Use `seatAmount` in new code. `seatPlanCode` is only useful when a Paystack plan code exists for extra seats.

### Sync products and plans from trusted server jobs

Use server-only helpers to mirror Paystack catalog data into local tables:

```ts
import { syncPaystackPlans, syncPaystackProducts } from "better-auth-paystack";

export async function syncCatalog(ctx: unknown, options: unknown) {
  await syncPaystackProducts(ctx, options);
  await syncPaystackPlans(ctx, options);
}
```

These operations are not browser client actions. Run them from cron, admin-only server functions, CI jobs, or deployment tasks.

## Common Mistakes

### Using native planCode for local seat/proration behavior

Wrong:

```ts
{
  name: "team",
  planCode: "PLN_team",
  seatAmount: 100_000,
}
```

Correct: omit `planCode` when the plan needs local seat billing, local renewals, or prorated seat changes.

### Treating products like subscription plans

Products are one-time purchases. Plans are subscriptions. Use transaction initialization for product purchases and subscription actions for plans.

### Expecting product and plan tables to be optional

`paystackProduct` and `paystackPlan` schema tables are always included by the plugin. Do not remove them in compatibility-preserving releases.

### Trusting trial state without verification

Trial metadata is created during subscription checkout and finalized through transaction/webhook handling. Always verify the Paystack reference and rely on persisted subscription state before granting paid access.
