# Better Auth Paystack Plugin

A TypeScript-first plugin that integrates Paystack into [Better Auth](https://www.better-auth.com), providing a production-ready billing system with support for subscriptions (native & local), one-time payments, trials, organization billing, and secure webhooks.

<div align="center">

![npm downloads](https://img.shields.io/npm/dm/better-auth-paystack.svg)
[![GitHub stars](https://img.shields.io/github/stars/alexasomba/better-auth-paystack.svg?style=social&label=Star)](https://github.com/alexasomba/better-auth-paystack/stargazers)
[![GitHub release](https://img.shields.io/github/v/release/alexasomba/better-auth-paystack)](https://github.com/alexasomba/better-auth-paystack/releases)
[![bundlephobia](https://img.shields.io/bundlephobia/minzip/better-auth-paystack)](https://bundlephobia.com/result?p=better-auth-paystack)
[![Follow on Twitter](https://img.shields.io/twitter/follow/alexasomba?style=social)](https://twitter.com/alexasomba)
![GitHub License](https://img.shields.io/github/license/alexasomba/better-auth-paystack)

</div>

[**Live Demo (Tanstack Start)**](https://better-auth-paystack.gittech.workers.dev) | [**Source Code**](https://github.com/alexasomba/better-auth-paystack/tree/main/examples/tanstack)

## AI Agent Skills

This package publishes agent skills so AI coding agents can load package-specific guidance for setup, subscriptions, organization billing, TanStack Start integration, client APIs, webhooks, local subscription lifecycle, schema changes, and testing.

Use [TanStack Intent](https://www.npmjs.com/package/@tanstack/intent) when you want to explicitly list or load individual skills:

```bash
npx @tanstack/intent@latest list
npx @tanstack/intent@latest load better-auth-paystack#better-auth-paystack-setup
npx @tanstack/intent@latest load better-auth-paystack#paystack-testing-fixtures
```

If you use an AI agent, run `npx @tanstack/intent@latest install` in your project so the agent knows how to discover package skills.

This package also ships skills in the npm package under `skills/*/SKILL.md`, so projects can use [skills-npm](https://www.npmjs.com/package/skills-npm) to symlink installed package skills for compatible agents:

```bash
npm install better-auth-paystack
npx skills-npm --yes
```

For this repository, maintainers can run `pnpm run skills:dry-run` to preview discovery through the TanStack example fixture or `pnpm run skills:install` to create local agent skill symlinks from that fixture.

## Features

- [x] **Billing Patterns**: Support for Paystack-native plans, local-managed subscriptions, and one-time payments (products/amounts).
- [x] **Auto Customer Creation**: Optional Paystack customer creation on user sign up or organization creation.
- [x] **Trial Management**: Configurable trial periods with built-in abuse prevention logic.
- [x] **Organization Billing**: Associate subscriptions with organizations and authorize access via roles.
- [x] **Subscription Channel Controls**: Restrict subscription checkout to specific Paystack payment channels such as card-only.
- [x] **Enforced Limits & Seats**: Automatic enforcement of member seat upgrades and resource limits (teams).
- [x] **Scheduled Changes**: Defer subscription updates or cancellations to the end of the billing cycle.
- [x] **Proration**: Immediate mid-cycle prorated upgrades for local plans, using saved-card charges when possible and checkout fallback when interactive payment is required.
- [x] **Popup Modal Flow**: Optional support for Paystack's inline checkout experience via `@alexasomba/paystack-inline`.
- [x] **Webhook Security**: Pre-configured signature verification (HMAC-SHA512) and optional IP whitelisting.
- [x] **Transaction History**: Built-in support for listing and viewing local transaction records.

---

## Quick Start

### Prerequisites

- **Node.js**: `v22.0.0` or higher.
- **Better Auth**: `v1.6.9` or higher.

### 1. Install Plugin & SDKs

```bash
npm install better-auth better-auth-paystack @alexasomba/paystack-node
```

#### Migrating from the scoped package

Replace the scoped dependency with the unscoped package:

```bash
npm uninstall @alexasomba/better-auth-paystack
npm install better-auth-paystack
```

Then update imports from `@alexasomba/better-auth-paystack` to `better-auth-paystack` and from
`@alexasomba/better-auth-paystack/client` to `better-auth-paystack/client`.

This is a package-name migration. The v4 release also moves Paystack billing data into
provider-owned tables. Existing client route names remain compatible, but a database migration
and the trusted migration operation described below are required.

#### Optional: Browser SDK (for Popup Modals)

```bash
npm install @alexasomba/paystack-inline
```

### 2. Configure Environment Variables

```env
PAYSTACK_SECRET_KEY=sk_test_...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:8787
```

### 3. Setup Server Plugin

```ts title="auth.ts"
import { betterAuth } from "better-auth";
import { paystack } from "better-auth-paystack";
import { createPaystack } from "@alexasomba/paystack-node";
import { admin } from "better-auth/plugins";

const paystackClient = createPaystack({
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
});

export const auth = betterAuth({
  plugins: [
    admin(),
    paystack({
      paystackClient,
      secretKey: process.env.PAYSTACK_SECRET_KEY!,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        allowedPaymentChannels: ["card"], // Optional: enforce card-only subscriptions
        plans: [
          {
            name: "pro",
            group: "workspace", // Optional: one active/trialing subscription per group
            planCode: "PLN_pro_123", // Native: Managed by Paystack
            freeTrial: { days: 14 },
            limits: { teams: 5, seats: 10 }, // Custom resource & member limits
          },
          {
            name: "starter",
            amount: 50000, // Local: Managed by your app (500 NGN)
            currency: "NGN",
            interval: "monthly",
          },
        ],
      },
      products: {
        products: [{ name: "credits_50", amount: 200000, currency: "NGN" }],
      },
    }),
  ],
});
```

Paystack signs webhook payloads with the same `PAYSTACK_SECRET_KEY` used for API authentication;
there is no separate webhook secret. Legacy `webhook.secret` and `paystackWebhookSecret` options
are accepted for source compatibility but ignored.

### 4. Configure Client Plugin

```ts title="client.ts"
import { createAuthClient } from "better-auth/client";
import { paystackClient } from "better-auth-paystack/client";
import { adminClient } from "better-auth/client/plugins";

export const client = createAuthClient({
  plugins: [adminClient(), paystackClient({ subscription: true })],
});
```

### 5. Migrate Database Schema

```bash
npx better-auth migrate
```

---

## Migration Guide

Version `2.0.0` contains a security-focused breaking change.

- Removed public/client operator actions:
  - `authClient.paystack.syncProducts()`
  - `authClient.paystack.syncPlans()`
  - `authClient.paystack.chargeRecurringSubscription(...)`
- Removed public Better Auth endpoints for:
  - `/paystack/sync-products`
  - `/paystack/sync-plans`
  - `/paystack/charge-recurring`
- Added trusted server operations:
  - `chargeSubscriptionRenewal`
  - `syncPaystackProducts`
  - `syncPaystackPlans`

### Old

```ts
await authClient.paystack.syncProducts();
await authClient.paystack.syncPlans();
await authClient.paystack.chargeRecurringSubscription({
  subscriptionId: "sub_123",
});
```

### New

```ts
import {
  chargeSubscriptionRenewal,
  syncPaystackPlans,
  syncPaystackProducts,
  type ChargeRecurringSubscriptionResult,
  type PaystackSyncResult,
} from "better-auth-paystack";

const ctx = { context: await auth.$context } as any;
const paystackOptions = {
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
  paystackClient,
};

await syncPaystackProducts(ctx, paystackOptions);
await syncPaystackPlans(ctx, paystackOptions);
await chargeSubscriptionRenewal(ctx, paystackOptions, {
  subscriptionId: "sub_123",
});
```

These operations are intentionally server-only. Do not expose them through browser-triggered auth client calls.

---

## Billing Patterns

### 1. Subscriptions

#### Native (Recommended)

Use `planCode` from your Paystack Dashboard. Paystack handles the recurring logic and emails.

```ts
{ name: "pro", planCode: "PLN_xxx" }
```

#### Local

Use `amount` and `interval`. The plugin stores the status locally, allowing you to manage custom recurring logic or one-off "access periods".

```ts
{ name: "starter", amount: 50000, interval: "monthly" }
```

### 2. One-Time Payments

#### Fixed Products

Define pre-configured products in your server settings and purchase them by name.

```ts
await authClient.paystack.transaction.initialize({
  product: "credits_50",
});
```

#### Ad-hoc Amounts

Charge dynamic amounts for top-ups, tips, or custom invoices.

```ts
await authClient.paystack.transaction.initialize({
  amount: 100000, // 1000 NGN
  currency: "NGN",
  metadata: { type: "donation" },
});
```

---

## Limits & Seat Management

The plugin automatically enforces limits across active and trialing subscriptions. When multiple
subscription groups define the same numeric limit, the highest value wins; plan features are
combined.

### Member Seat Limits

Purchased seats are stored in the `subscription.seats` field. The plugin hooks into `member.create` and `invitation.create` to block additions once the limit is reached.

### Resource Limits (e.g., Teams)

Define limits in your plan config, and they will be checked during resource creation:

```ts
plans: [{ name: "pro", limits: { teams: 5, seats: 10 } }];
```

The plugin natively checks the `teams` limit if using the Better Auth Organization plugin.

### Subscription Groups

Set `group` on related plans when a user or organization may own independent subscriptions:

```ts
plans: [
  { name: "pro", group: "workspace", planCode: "PLN_pro" },
  { name: "priority-support", group: "support", planCode: "PLN_support" },
];
```

Group names are trimmed and lowercased. A reference can have one active or trialing subscription
per group. Plans without `group` remain in the legacy default group, represented by a nullable
`subscription.groupId`, so existing configurations keep their previous single-subscription
behavior.

---

## Currency Support

The plugin supports the following currencies with automatic minimum transaction amount validation:

| Currency | Name                   | Minimum Amount |
| -------- | ---------------------- | -------------- |
| **NGN**  | Nigerian Naira         | ₦50.00         |
| **GHS**  | Ghanaian Cedi          | ₵0.10          |
| **ZAR**  | South African Rand     | R1.00          |
| **KES**  | Kenyan Shilling        | KSh 3.00       |
| **USD**  | United States Dollar   | $2.00          |
| **XOF**  | West African CFA Franc | CFA 100        |

Transactions below these thresholds will be rejected with a `BAD_REQUEST` error.

## Advanced Usage

### Organization Billing

Enable `organization.enabled` to bill organizations instead of users.

- **Auto Customer**: Organizations get their own provider-owned `paystackCustomer` record.
- **Authorization**: Organization owners and admins can manage billing by default. Use `organization.billingRoles` to extend the trusted role list, or `subscription.authorizeReference` when you need fully custom authorization.

```ts
paystack({
  subscription: {
    enabled: true,
    plans: [],
  },
  organization: {
    enabled: true,
    billingRoles: ["owner", "admin", "billing"],
  },
});
```

### Inline Popup Modal

Use `@alexasomba/paystack-inline` for a seamless UI.

```ts
const { data } = await authClient.subscription.upgrade({ plan: "pro" });
if (data?.kind === "checkout") {
  const paystack = createPaystack({ publicKey: "pk_test_..." });
  paystack.checkout({
    accessCode: data.accessCode,
    onSuccess: (res) => authClient.paystack.transaction.verify({ reference: res.reference }),
  });
}
```

### Scheduled Changes & Cancellation

Defer changes to the end of the current billing cycle:

- **Upgrades**: Pass `scheduleAtPeriodEnd: true` in `initializeTransaction()`.
- **Cancellations**: Use `authClient.subscription.cancel({ subscriptionCode, atPeriodEnd: true })` to keep the subscription active until the period ends.

### Mid-Cycle Proration (`prorateAndCharge`)

The plugin can dynamically calculate the cost difference for immediate mid-cycle upgrades (like adding more seats).
For locally managed plans:

- If the subscription already has a reusable Paystack authorization code, the plugin charges the prorated delta off-session, records a local `paystackTransaction`, and immediately updates the subscription.
- If there is no reusable authorization code available (for example, transfer-based payments), the plugin initializes a new checkout for the prorated delta instead of silently upgrading without payment.
- If the prorated amount is below Paystack's minimum charge for the currency, the request is rejected so you can schedule the change for period end instead of undercharging.

```ts
const { data } = await authClient.paystack.transaction.initialize({
  plan: "pro",
  quantity: 5, // Upgrading seats
  prorateAndCharge: true, // Charges saved authorization or returns a checkout redirect for the delta
});

if (data?.kind === "checkout") {
  window.location.href = data.url;
}

if (data?.kind === "prorated") {
  console.log(data.message);
}
```

When the flow falls back to checkout, verify the returned transaction reference after payment. The plugin uses the stored proration metadata to apply the pending plan/seat change only after successful verification.

### Restricting Subscription Payment Channels

Use `subscription.allowedPaymentChannels` to constrain which Paystack checkout channels can be used for subscription flows.
This applies to standard subscription checkout, trial authorization flows, and interactive proration checkout fallbacks.

```ts
paystack({
  subscription: {
    enabled: true,
    allowedPaymentChannels: ["card"],
    plans: [{ name: "starter", amount: 50000, currency: "NGN", interval: "monthly" }],
  },
});
```

If a subscription payment is later verified with a disallowed channel, the plugin rejects activation instead of silently creating the subscription.

### Webhook Security

Webhook deliveries are persisted in the provider-specific `paystackWebhookEvent` table using a
stable hash of the verified raw payload. Duplicate deliveries that were already processed are
acknowledged without running billing side effects again. Failed or interrupted deliveries remain
pending for later reconciliation or replay handling.

The plugin automatically verifies the `x-paystack-signature` header to ensure events are authentic. For an extra layer of security, you can enable **IP Whitelisting** to restrict processing to Paystack's official servers.

```ts
paystack({
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
  webhook: {
    verifyIP: true, // Enable IP whitelisting (defaults to false for flexible proxy support)
    trustedIPs: ["52.31.139.75", "52.49.173.169", "52.214.14.220"], // Optional: override trusted IPs
  },
});
```

Webhook signatures are always verified with `secretKey`, as required by Paystack. Do not create or
configure a separate `PAYSTACK_WEBHOOK_SECRET`.

### Trial Abuse Prevention

The plugin checks the `referenceId` history. If a trial was ever used (active, expired, or trialing), it will not be granted again, preventing resubscribe-abuse.

### Lifecycle Hooks

React to billing events on the server by providing callbacks in your configuration:

#### Subscription Hooks (`subscription.*`)

- `onSubscriptionComplete`: Called after successful transaction verification (Native or Local).
- `onSubscriptionCreated`: Called when a subscription record is first initialized in the DB.
- `onSubscriptionUpdate`: Called after a persisted lifecycle change.
- `onSubscriptionCancel`: Called when a user or organization cancels their subscription.

#### Customer Hooks (`top-level` or `organization.*`)

- `onCustomerCreate`: Called after the plugin successfully creates a Paystack customer.
- `getCustomerCreateParams`: Return a custom object to override/extend the data sent to Paystack during customer creation.

#### Trial Hooks (`subscription.plans[].freeTrial.*`)

- `onTrialStart`: Called when a new trial period begins.
- `onTrialEnd`: Called when a trial converts to an active subscription.
- `onTrialExpired`: Called when a trial ends without conversion.

Application callback failures are logged after billing state is persisted and do not cause an
otherwise valid Paystack webhook to be replayed.

#### Global Hook

- `onEvent`: Receives every webhook event payload sent from Paystack for custom processing.

### Trusted Server Operations

Recurring renewals and Paystack catalog sync are intentionally not exposed through the browser auth client.
Invoke them from trusted backend code only:

```ts
import {
  chargeSubscriptionRenewal,
  reconcilePaystackTransaction,
  syncPaystackPlans,
  syncPaystackProducts,
} from "better-auth-paystack";

const ctx = { context: await auth.$context } as any;

await chargeSubscriptionRenewal(ctx, paystackOptions, {
  subscriptionId: "sub_123",
});

const settlement = await reconcilePaystackTransaction(ctx, paystackOptions, {
  reference: "PAYSTACK_REFERENCE",
  source: "queue",
  referenceId: "user_or_org_id",
});

if (settlement.ok) {
  console.log(settlement.transaction.status, settlement.subscription.updated);
}

await syncPaystackProducts(ctx, paystackOptions);
await syncPaystackPlans(ctx, paystackOptions);
```

Use `reconcilePaystackTransaction` from webhook handlers, queue retries, cron jobs, or admin actions when trusted server code needs the same verification and local transaction/subscription side effects as the browser verify endpoint.

### Authorization & Security

#### `authorizeReference`

Control who can manage billing for specific references (Users or Organizations).

```ts
paystack({
  subscription: {
    authorizeReference: async ({ user, referenceId, action }) => {
      // Example: Only allow Org Admins to initialize transactions
      if (referenceId.startsWith("org_")) {
        const member = await db.findOne({
          model: "member",
          where: [
            { field: "organizationId", value: referenceId },
            { field: "userId", value: user.id },
          ],
        });
        return member?.role === "admin";
      }
      return user.id === referenceId;
    },
  },
});
```

---

## Client SDK Reference

The client plugin exposes fully typed canonical methods under `authClient.paystack`, `authClient.transaction`, and `authClient.subscription`.

- `authClient.transaction.initialize`, `verify`, `list`
- `authClient.subscription.create`, `upgrade`, `cancel`, `restore`, `list`, `billingPortal`
- `authClient.paystack.config`, `listProducts`, `listPlans`, plus the transaction/subscription helpers above

Legacy compatibility aliases remain available for migration, but new code should use the canonical methods:

- `authClient.subscription.disable(...)` -> use `authClient.subscription.cancel(...)`
- `authClient.subscription.enable(...)` -> use `authClient.subscription.restore(...)`

### `authClient.subscription.upgrade` / `create`

Initializes a transaction to create or upgrade a subscription.

```ts
type upgradeSubscription = {
  /**
   * The name of the plan to subscribe to.
   */
  plan: string;
  /**
   * The email of the subscriber. Defaults to the current user's email.
   */
  email?: string;
  /**
   * Amount to charge (if not using a Paystack Plan Code).
   */
  amount?: number;
  /**
   * Currency code (e.g., "NGN").
   */
  currency?: string;
  /**
   * The callback URL to redirect to after payment.
   */
  callbackURL?: string;
  /**
   * Additional metadata to store with the transaction.
   */
  metadata?: Record<string, unknown>;
  /**
   * Reference ID for the subscription owner (User ID or Org ID).
   * Defaults to the current user's ID.
   */
  referenceId?: string;
  /**
   * Number of seats to purchase (for team plans).
   */
  quantity?: number;
};
```

### `authClient.paystack.transaction.initialize`

Same as `upgrade`, but can also be used for one-time payments by omitting `plan` and providing `amount` or `product`.

```ts
type initializeTransaction = {
  /**
   * Plan name (for subscriptions).
   */
  plan?: string;
  /**
   * Product name (for one-time purchases).
   */
  product?: string;
  /**
   * Amount to charge (if sending raw amount).
   */
  amount?: number;
  /**
   * For existing locally managed subscriptions, calculate a mid-cycle delta and either
   * charge the saved authorization or return a checkout redirect for interactive payment.
   */
  prorateAndCharge?: boolean;
  // ... same as upgradeSubscription
};

type initializeTransactionResult =
  | {
      kind: "checkout";
      url: string;
      reference: string;
      accessCode: string;
      redirect: true;
    }
  | { kind: "scheduled"; status: "success"; message: string; scheduled: true }
  | { kind: "prorated"; status: "success"; message: string; prorated: true };
```

### `authClient.subscription.list`

List subscriptions for a user or organization. Organization-scoped billing actions require an owner/admin membership by default. To allow roles such as `billing`, configure `organization.billingRoles`. For custom resources or deeper policy checks, configure `subscription.authorizeReference`.

```ts
type listSubscriptions = {
  query?: {
    /**
     * Filter by reference ID (User ID or Org ID).
     */
    referenceId?: string;
  };
};
```

### `authClient.subscription.cancel` / `restore`

Cancel or restore a subscription.

- **Cancel**: Sets `cancelAtPeriodEnd: true`. The subscription remains `active` until the end of the current billing period, after which it moves to `canceled`.
- **Restore**: Reactivates a subscription that is scheduled to cancel.

```ts
type cancelSubscription = {
  /**
   * Optional reference owner (user ID or org ID) when managing another billing entity.
   */
  referenceId?: string;
  /**
   * The Paystack subscription code (e.g. SUB_...)
   */
  subscriptionCode: string;
  /**
   * The email token required by Paystack to manage the subscription.
   * Optional: The server will try to fetch it if omitted.
   */
  emailToken?: string;
  /**
   * When true, keep the subscription active until the current period ends.
   */
  atPeriodEnd?: boolean;
};
```

## Schema Reference

The plugin extends your database with the following fields and tables.

### `user` and `organization`

Paystack customer codes are no longer added to Better Auth auth tables. Organization `email`
remains available for billing fallback.

| Field   | Type     | Required | Description                                                                        |
| :------ | :------- | :------- | :--------------------------------------------------------------------------------- |
| `email` | `string` | No       | The billing email for the organization. Falls back to the owner's email if absent. |

### `paystackCustomer`

| Field           | Type     | Required | Description                          |
| :-------------- | :------- | :------- | :----------------------------------- |
| `referenceType` | `string` | Yes      | `user` or `organization`.            |
| `referenceId`   | `string` | Yes      | Owning Better Auth identifier.       |
| `referenceKey`  | `string` | Yes      | Unique provider-owned reference key. |
| `customerCode`  | `string` | Yes      | Paystack customer code.              |
| `email`         | `string` | No       | Billing email.                       |

### `paystackPaymentCredential`

Payment credentials are stored separately as AES-256-GCM ciphertext. Plaintext values are not
returned by subscription APIs, callbacks, logs, or client actions. Set `credentialEncryptionKey`
to a dedicated production secret; the plugin falls back to `secretKey` for compatibility.

| Field                        | Type     | Required | Description                               |
| :--------------------------- | :------- | :------- | :---------------------------------------- |
| `subscriptionId`             | `string` | Yes      | Unique Paystack subscription ID.          |
| `authorizationCodeEncrypted` | `string` | No       | Encrypted recurring-charge authorization. |
| `emailTokenEncrypted`        | `string` | No       | Encrypted subscription-management token.  |

### `paystackSubscription`

| Field                  | Type      | Required | Description                                                          |
| :--------------------- | :-------- | :------- | :------------------------------------------------------------------- |
| `plan`                 | `string`  | Yes      | Lowercased name of the active plan.                                  |
| `referenceId`          | `string`  | Yes      | Associated User ID or Organization ID.                               |
| `userId`               | `string`  | Yes      | User who initiated the subscription checkout.                        |
| `customerCode`         | `string`  | No       | The Paystack customer code for this subscription.                    |
| `subscriptionCode`     | `string`  | No       | The unique code for the subscription (e.g., `SUB_...` or `LOC_...`). |
| `transactionReference` | `string`  | No       | The reference of the transaction that started the subscription.      |
| `planCode`             | `string`  | No       | The Paystack plan code, when Paystack manages the subscription.      |
| `status`               | `string`  | Yes      | `active`, `trialing`, `canceled`, `incomplete`.                      |
| `periodStart`          | `Date`    | No       | Start date of the current billing period.                            |
| `periodEnd`            | `Date`    | No       | End date of the current billing period.                              |
| `trialStart`           | `Date`    | No       | Start date of the trial period.                                      |
| `trialEnd`             | `Date`    | No       | End date of the trial period.                                        |
| `cancelAtPeriodEnd`    | `boolean` | No       | Whether to cancel at the end of the current period.                  |
| `cancelAt`             | `Date`    | No       | Scheduled cancellation timestamp.                                    |
| `canceledAt`           | `Date`    | No       | Cancellation timestamp.                                              |
| `endedAt`              | `Date`    | No       | Subscription end timestamp.                                          |
| `billingInterval`      | `string`  | No       | Billing interval used by the plan.                                   |
| `groupId`              | `string`  | No       | Optional subscription group.                                         |
| `pendingPlan`          | `string`  | No       | Plan pending a future lifecycle change.                              |
| `seats`                | `number`  | No       | Purchased seat count for team billing.                               |
| `createdAt`            | `Date`    | Yes      | Record creation timestamp.                                           |
| `updatedAt`            | `Date`    | Yes      | Record update timestamp.                                             |

### `paystackTransaction`

| Field         | Type     | Required | Description                                          |
| :------------ | :------- | :------- | :--------------------------------------------------- |
| `reference`   | `string` | Yes      | Unique transaction reference.                        |
| `referenceId` | `string` | Yes      | Associated User ID or Organization ID.               |
| `userId`      | `string` | Yes      | The ID of the user who initiated the transaction.    |
| `amount`      | `number` | Yes      | Transaction amount in smallest currency unit.        |
| `currency`    | `string` | Yes      | Currency code (e.g., "NGN").                         |
| `status`      | `string` | Yes      | `success`, `pending`, `failed`, `abandoned`.         |
| `plan`        | `string` | No       | Name of the plan associated with the transaction.    |
| `product`     | `string` | No       | Name of the product associated with the transaction. |
| `metadata`    | `string` | No       | JSON string of extra transaction metadata.           |
| `paystackId`  | `string` | No       | The internal Paystack ID for the transaction.        |
| `createdAt`   | `Date`   | Yes      | Transaction creation timestamp.                      |
| `updatedAt`   | `Date`   | Yes      | Transaction last update timestamp.                   |

### `paystackProduct`

| Field         | Type      | Required | Description                              |
| :------------ | :-------- | :------- | :--------------------------------------- |
| `name`        | `string`  | Yes      | Product name.                            |
| `description` | `string`  | No       | Product description.                     |
| `price`       | `number`  | Yes      | Price in smallest currency unit.         |
| `currency`    | `string`  | Yes      | Currency code (e.g., "NGN").             |
| `quantity`    | `number`  | No       | Available stock quantity.                |
| `unlimited`   | `boolean` | No       | Whether the product has unlimited stock. |
| `paystackId`  | `string`  | No       | The internal Paystack Product ID.        |
| `slug`        | `string`  | Yes      | Unique slug for the product.             |
| `metadata`    | `string`  | No       | JSON string of extra product metadata.   |
| `createdAt`   | `Date`    | Yes      | Product creation timestamp.              |
| `updatedAt`   | `Date`    | Yes      | Product last update timestamp.           |

### `paystackWebhookEvent`

The plugin records verified webhook deliveries with their event type, raw payload, reference (when
available), processing status, and processed timestamp. This table is provider-namespaced so the
Paystack and Flutterwave plugins can be installed together without sharing webhook state.

| Field         | Type     | Required | Description                                |
| :------------ | :------- | :------- | :----------------------------------------- |
| `eventId`     | `string` | Yes      | Stable hash of the exact verified payload. |
| `eventType`   | `string` | Yes      | Paystack event name.                       |
| `reference`   | `string` | No       | Transaction reference when available.      |
| `payload`     | `string` | Yes      | Exact raw webhook payload.                 |
| `status`      | `string` | Yes      | `pending` or `processed`.                  |
| `processedAt` | `Date`   | No       | Processing completion timestamp.           |

### v4 schema migration

After upgrading the package, generate/apply the Better Auth schema first, then run the trusted
server-only operation:

```ts
import { migratePaystackSubscriptionSchema } from "better-auth-paystack";

const report = await migratePaystackSubscriptionSchema(ctx, {
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
  credentialEncryptionKey: process.env.PAYSTACK_CREDENTIAL_ENCRYPTION_KEY,
});
```

Run it in this order:

1. Upgrade the package.
2. Run Better Auth schema generation/migration.
3. Run `migratePaystackSubscriptionSchema()` from a trusted server job.
4. Verify migration counts and billing behavior.
5. Remove legacy columns/tables manually only after verification.

The operation preserves legacy rows, keeps original subscription IDs where possible, skips already
migrated records, encrypts legacy authorization/email tokens, and reports partial failures so a
later run can retry them.

During the compatibility window, customer resolution can still read legacy auth-table customer
codes. Remove those legacy columns manually after the migration has been verified.

---

## Troubleshooting

- **Webhook Signature**: Ensure `PAYSTACK_SECRET_KEY` matches the integration that sends the webhook. Paystack uses this API secret key for `x-paystack-signature`.
- **Email Verification**: Use `requireEmailVerification: true` to prevent unverified checkouts.
- **Redirect Failures**: Check your browser console; Paystack often returns 429 errors if you're hitting the test API too frequently.
- **Reference mismatches**: Ensure `referenceId` is passed correctly for Organization billing.
- **Authorization Denied**: Verify your `authorizeReference` logic is correctly checking user roles or organization memberships. Unauthorized attempts to verify transactions now return a `401 Unauthorized` response to prevent data leaks.

### Database Indexing

The plugin's schema definition includes recommended indexes and uniqueness constraints for performance. When you run `npx better-auth migrate`, these will be automatically applied to your database.

After upgrading, run `npx better-auth migrate` (or `npx better-auth generate` for schema-managed
adapters). The additive `cancelAt`, `canceledAt`, `endedAt`, and `billingInterval` subscription
columns are nullable; historical rows are populated as future lifecycle events are processed.

The following fields are indexed:

- **`paystackTransaction`**: `reference` (unique), `userId`, `referenceId`.
- **`paystackSubscription`**: `subscriptionCode` (unique), `referenceId`, `transactionReference`, `customerCode`, `plan`.
- **`paystackCustomer`**: `referenceKey` (unique), `referenceId`, `customerCode` (unique).
- **`paystackPaymentCredential`**: `subscriptionId` (unique).
- **`paystackProduct`**: `slug` (unique), `paystackId` (unique).

Proration upgrades and trusted renewal charges also persist `paystackTransaction` rows, so local transaction history stays aligned with successful off-session charges.

### Syncing Products

The plugin provides two ways to keep your product inventory aligned with Paystack:

#### 1. Automated Inventory Sync

Whenever a successful one-time payment is made (via webhook or manual verification), the plugin automatically calls **`syncProductQuantityFromPaystack`**. This fetches the real-time remaining quantity from the Paystack API and updates your local database record, ensuring your inventory is always accurate.

#### 2. Trusted Manual Bulk Sync

The public `/paystack/sync-products` endpoint was removed in `2.0.0`.
Run the trusted server operation from backend code instead:

```ts
import { syncPaystackProducts } from "better-auth-paystack";

const ctx = { context: await auth.$context } as any;

await syncPaystackProducts(ctx, paystackOptions);
```

### SDK Compatibility Note

The plugin now targets the official `@alexasomba/paystack-node` grouped client surface directly.
If you inject a custom client, it should match the real SDK methods used by the plugin such as `transaction.initialize`, `transaction.verify`, `transaction.chargeAuthorization`, `subscription.create`, `subscription.disable`, and `subscription.enable`.

---

## 🏗️ Development & Contributing

This repository is powered by **Vite+**. You use the `vp` CLI to manage the entire workspace.

```bash
# Install dependencies
vp i

# Check project health (format, lint, types)
vp check --fix

# Build the core library
vp build

# Run tests
vp test

# Run the TanStack Start example
vp run examples/tanstack dev
```

Contributions are welcome! Please open an issue or pull request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Roadmap

Future features planned for upcoming versions:

### v1.1.0 - Manual Recurring Subscriptions (Available Now)

- [x] **Stored Authorization Codes**: Securely store Paystack authorization codes from verified transactions.
- [x] **Trusted Renewal Operation**: Server-side helper to charge stored cards for renewals.
- [ ] **Card Management UI**: Let users view/delete saved payment methods (masked card data only) - _Upcoming_
- [ ] **Renewal Scheduler Integration**: Documentation for integrating with Cloudflare Workers Cron, Vercel Cron, etc. - _Upcoming_

> **Note**: For local-managed subscriptions (no `planCode`), the plugin automatically captures and stores the `authorization_code`. Trigger renewals from trusted backend code with `chargeSubscriptionRenewal(...)`.

### Future Considerations

- [ ] Multi-currency support improvements
- [ ] Invoice generation
- [ ] Payment retry logic for failed renewals

## Links

- GitHub Repository: [alexasomba/better-auth-paystack](https://github.com/alexasomba/better-auth-paystack)
- Comprehensive and up-to-date Paystack Node SDK: [alexasomba/paystack-node](https://github.com/alexasomba/paystack-node)
- Comprehensive and up-to-date Paystack Inline SDK: [alexasomba/paystack-inline](https://github.com/alexasomba/paystack-inline)
- [TanStack Start Example Implementation](https://github.com/alexasomba/better-auth-paystack/tree/main/examples/tanstack)
- Paystack Webhooks: https://paystack.com/docs/payments/webhooks/
- Paystack Transaction API: https://paystack.com/docs/api/transaction/
- Paystack Subscription API: https://paystack.com/docs/api/subscription/
- Paystack Plan API: https://paystack.com/docs/api/plan/
- [Better Auth Documentation](https://www.better-auth.com/docs)
