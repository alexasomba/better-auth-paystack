---
name: paystack-local-subscriptions
description: >
  Implement, debug, or test local-managed subscription behavior in @alexasomba/better-auth-paystack. Use for local plans without planCode, saved authorization renewal, chargeSubscriptionRenewal, seat billing, prorateAndCharge, pendingPlan, LOC_ subscription codes, trial transitions, schedule-at-period-end upgrades, and Paystack-managed vs local-managed behavior.
type: core
library: "@alexasomba/better-auth-paystack"
library_version: "3.1.1" # x-release-please-version
license: "MIT"
compatibility: "Node.js >=22.0.0; better-auth ^1.6.9; @alexasomba/paystack-node 1.10.x; @alexasomba/better-auth-paystack >=3.0.0 <4.0.0"
sources:
  - "alexasomba/better-auth-paystack:src/subscription-lifecycle.ts"
  - "alexasomba/better-auth-paystack:src/operations.ts"
  - "alexasomba/better-auth-paystack:src/routes.ts"
  - "alexasomba/better-auth-paystack:src/utils.ts"
  - "alexasomba/better-auth-paystack:test/local_subscription.test.ts"
  - "alexasomba/better-auth-paystack:test/seat_billing.test.ts"
---

## Local Subscription Model

A plan without `planCode` is locally managed. The plugin stores subscription state in the Better Auth
database and charges future renewals with a saved Paystack authorization code.

Local-managed subscriptions are required for:

- seat-based local billing
- prorated mid-cycle seat or plan upgrades
- trusted backend renewal jobs through `chargeSubscriptionRenewal`
- local trial and pending plan transitions

Use Paystack-native `planCode` plans for simple fixed recurring billing.

## Core Patterns

### Capture reusable authorization during verification

Local subscriptions become renewable after transaction verification or webhook reconciliation stores
`authorization.authorization_code` on the subscription. If the authorization is absent, renewal must
fail with a clear error instead of inventing a charge path.

### Use server-only renewal helpers

`chargeSubscriptionRenewal(ctx, options, { subscriptionId })` is for cron jobs, admin server
functions, or trusted server routes. Never expose it directly as a browser action.

Before charging, verify the caller can manage the subscription reference. For organization billing,
only owners/admins should trigger renewals.

### Prorate only local active subscriptions

`prorateAndCharge` is handled by `handleProratedUpgrade`.

The existing active subscription must have:

- status `active`
- a Paystack or local subscription code
- `periodStart` and `periodEnd`
- local-management compatibility for plan or seat changes

If a saved authorization exists, the prorated amount is charged immediately. If not, the code creates
a checkout transaction and applies the upgrade after the reference is verified.

Paystack minimum charge behavior matters. If the prorated amount is below the supported minimum,
surface a BAD_REQUEST and advise scheduling the change for period end.

### Preserve pending plan semantics

Scheduled changes should use `pendingPlan` rather than silently changing the active plan. Immediate
local changes should update `plan`, `seats`, and transaction reference consistently.

## Common Mistakes

### Adding `planCode` to a local billing plan

Do not add `planCode` to a plan that needs local seat billing, prorated upgrades, or local renewals.
That turns the plan into a Paystack-managed subscription path.

### Updating seats for Paystack-managed subscriptions

Seat and proration helpers intentionally reject Paystack-managed subscriptions. Use local-managed
plans for seat-aware billing.

### Charging renewals from client components

The client may trigger checkout. Renewal jobs require trusted server code and a validated session or
job context.

## Verification

Run focused tests after lifecycle changes:

```bash
vp test test/local_subscription.test.ts
vp test test/seat_billing.test.ts
```

Run `vp test test/paystack.test.ts` when route behavior, trials, or organization billing are touched.
