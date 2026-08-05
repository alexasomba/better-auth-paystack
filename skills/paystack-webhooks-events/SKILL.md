---
name: paystack-webhooks-events
description: >
  Implement, debug, or test better-auth-paystack webhook handling. Use for Paystack webhook signatures, secretKey verification, trusted IP checks, charge.success, reconcilePaystackTransaction, subscription.create, subscription.disable, subscription.enable, product quantity updates, subscription status changes, metadata parsing, and event hooks.
type: core
library: "better-auth-paystack"
library_version: "3.2.1" # x-release-please-version
license: "MIT"
compatibility: "Node.js >=22.0.0; better-auth ^1.6.9; @alexasomba/paystack-node 1.10.x; better-auth-paystack >=3.0.0 <4.0.0"
sources:
  - "alexasomba/better-auth-paystack:src/routes.ts"
  - "alexasomba/better-auth-paystack:src/types.ts"
  - "alexasomba/better-auth-paystack:src/utils.ts"
  - "alexasomba/better-auth-paystack:test/paystack.test.ts"
  - "alexasomba/better-auth-paystack:test/seat_billing.test.ts"
---

## Webhook Contract

The Better Auth endpoint is registered as `auth.api.paystackWebhook` and mounted under
`/api/auth/paystack/webhook` by the plugin. Always send the raw JSON body that Paystack signed.

Signature verification uses HMAC SHA-512 over the raw request body with `secretKey`.

Paystack does not issue a separate webhook signing secret. Never introduce
`PAYSTACK_WEBHOOK_SECRET`. Deprecated `webhook.secret` and `paystackWebhookSecret` fields are
ignored.

## Core Patterns

### Verify before processing

Webhook code must reject invalid signatures before parsing business effects:

```ts
const signature = createHmac("sha512", webhookSecret).update(payload).digest("hex");
```

If `webhook.verifyIP` is true, the request must come from `webhook.trustedIPs` or the built-in
Paystack IP allowlist. Preserve support for common forwarded IP headers when changing this path.

### Treat `charge.success` as reconciliation

`charge.success` can update multiple local records:

- mark a pending transaction as `success`
- finalize local subscription checkout when metadata identifies a plan
- apply checkout-based proration metadata with `type: "proration"`
- capture `authorization.authorization_code` for local renewals
- decrement one-time product quantity when product metadata is present

Do not grant paid access from a redirect alone. The callback should verify the transaction and
webhooks should reconcile persisted state.

For trusted server paths that need to re-verify and apply the plugin's local side effects outside a browser session, call `reconcilePaystackTransaction`:

```ts
import { reconcilePaystackTransaction } from "better-auth-paystack";

await reconcilePaystackTransaction(ctx, paystackOptions, {
  reference,
  source: "webhook",
  referenceId,
});
```

The helper is suitable for webhook handlers, queue retries, cron jobs, and admin repair actions.

### Handle subscription events idempotently

Paystack subscription events should update matching subscriptions without assuming one delivery:

- `subscription.create`: activate or update the subscription and call creation hooks
- `subscription.disable`: mark cancellation/non-renewal and call cancel hooks
- `subscription.enable`: restore active state when Paystack re-enables a subscription

Match by known Paystack identifiers first, then metadata such as `referenceId` and plan when needed.
Avoid creating duplicate subscriptions on repeated webhook delivery.

## Common Mistakes

### Parsing body before signature verification

Do not route Paystack webhooks through a generic JSON handler that loses the exact signed payload.
The signature must be checked against the same raw string Paystack sent.

### Assuming all metadata is an object

Paystack metadata may arrive as an object or a JSON string. Existing route code handles both forms.
Keep that tolerance when changing metadata handling.

### Forgetting product side effects

Webhook work is not subscription-only. Successful product purchases must update transaction state and
respect product quantity/unlimited settings.

## Verification

Run focused tests after webhook changes:

```bash
vp test test/paystack.test.ts
vp test test/seat_billing.test.ts
```

Also run `vp check` before landing broad route or type changes.
