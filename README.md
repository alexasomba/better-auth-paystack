# Better Auth Paystack Plugin

Better Auth plugin that integrates Paystack for customer creation, checkout, and Paystack-native subscription flows.

## Features

- Optional Paystack customer creation on sign up (`createCustomerOnSignUp`)
- Paystack checkout via transaction initialize + verify (redirect-first)
- Paystack webhook signature verification (`x-paystack-signature`, HMAC-SHA512)
- Local subscription records stored in your Better Auth database
- Subscription management via Paystack-hosted pages (`/subscription/manage-link`)
- Subscription activation/deactivation endpoints (`/subscription/enable` + `/subscription/disable`)
- Support for one-time payment products (e.g., credit packs, top-ups)
- Explicit billing interval support for plans (monthly, annually, etc.)
- Dynamic configuration sharing via `/paystack/get-config`
- Reference ID support (user by default; org/team via `referenceId` + `authorizeReference`)

## Installation

### Install packages

```bash
npm install better-auth @alexasomba/better-auth-paystack
```

## 🔑 Environment Variables

To use this plugin, you'll need to configure the following in your `.env`:

```env
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_WEBHOOK_SECRET=sk_test_... # Usually the same as SECRET_KEY
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000
```

---

## ⚙️ Configuration

### 1. Server Plugin

```ts
import { betterAuth } from "better-auth";
import { paystack } from "@alexasomba/better-auth-paystack";
import { createPaystack } from "@alexasomba/paystack-node";

const paystackClient = createPaystack({
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
});

export const auth = betterAuth({
  plugins: [
    paystack({
      paystackClient,
      // Paystack signs webhooks with an HMAC SHA-512 using your Paystack secret key.
      paystackWebhookSecret: process.env.PAYSTACK_SECRET_KEY!,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: [
          {
            name: "pro",
            amount: 500000,
            currency: "NGN",
            interval: "monthly",
          },
        ],
      },
    }),
  ],
});
```

### Configure the client plugin

```ts
import { createAuthClient } from "better-auth/client";
import { paystackClient } from "@alexasomba/better-auth-paystack/client";

export const client = createAuthClient({
  plugins: [paystackClient({ subscription: true })],
});
```

### Migrate / generate schema

The plugin adds fields/tables to your Better Auth database. Run the Better Auth CLI migration/generate step you already use in your project.

## Webhooks

### Endpoint URL

The plugin exposes a webhook endpoint at:

```
{AUTH_BASE}/paystack/webhook
```

Where `{AUTH_BASE}` is your Better Auth server base path (commonly `/api/auth`).

### Signature verification

Paystack sends `x-paystack-signature` which is an HMAC-SHA512 of the raw payload signed with your secret key. The plugin verifies this using `paystackWebhookSecret`.

### Recommended events

At minimum, enable the events your app depends on. For subscription flows, Paystack documents these as relevant:

- `charge.success`
- `subscription.create`
- `subscription.disable`
- `subscription.not_renew`

The plugin forwards all webhook payloads to `onEvent` (if provided) after signature verification.

## Usage

### Defining plans

Plans are referenced by their `name` (stored lowercased). For Paystack-native subscriptions you can either:

- Use `planCode` (Paystack plan code). When `planCode` is provided, Paystack invalidates `amount` during transaction initialization.
- Or use `amount` (smallest currency unit) for simple payments.

### Frontend checkout (redirect)

This flow matches Paystack’s transaction initialize/verify APIs:

1. Call `POST {AUTH_BASE}/paystack/transaction/initialize`
2. Redirect the user to the returned Paystack `url`
3. On your callback route/page, call `POST {AUTH_BASE}/paystack/transaction/verify` (this updates local subscription state)

**Example (typed via Better Auth client plugin):**

```ts
import { createAuthClient } from "better-auth/client";
import { paystackClient } from "@alexasomba/better-auth-paystack/client";

const plugins = [paystackClient({ subscription: true })];

const authClient = createAuthClient({
  // Your Better Auth base URL (commonly "/api/auth" in Next.js)
  baseURL: "/api/auth",
  plugins,
});

// Start checkout
const init = await authClient.paystack.transaction.initialize(
  {
    plan: "starter",
    callbackURL: `${window.location.origin}/billing/paystack/callback`,
    // Optional for org/team billing (requires authorizeReference)
    // referenceId: "org_123",
  },
  { throw: true },
);
// { url, reference, accessCode, redirect: true }
if (init?.url) window.location.href = init.url;

// 2. Manage / Upgrade / Downgrade (via Paystack-hosted management page)
const manage = await authClient.paystack.getSubscriptionManageLink({
  query: { subscriptionCode: "SUB_..." },
});
if (manage.data?.link) window.location.href = manage.data.link;

// 3. Purchase a One-Time Product
await authClient.paystack.transaction.initialize({
  amount: 250000,
  currency: "NGN",
  metadata: { type: "credits", quantity: 50 },
  callbackURL: `${window.location.origin}/billing/paystack/callback`,
});

// 4. On your callback page/route
const reference = new URLSearchParams(window.location.search).get("reference");
if (reference) {
  await authClient.paystack.transaction.verify({ reference }, { throw: true });
}
```

### Dynamic Configuration

The plugin exposes an endpoint to share your configured plans and products with the client, reducing hard-coding in your components:

`GET {AUTH_BASE}/paystack/get-config`

Returns: `{ plans: PaystackPlan[], products: PaystackProduct[] }`

Server-side (no HTTP fetch needed):

```ts
// On the server you can call the endpoints directly:
// const init = await auth.api.initializeTransaction({ headers: req.headers, body: { plan: "starter" } })
// const verify = await auth.api.verifyTransaction({ headers: req.headers, body: { reference } })
```

**Example (framework-agnostic):**

On your callback route/page, call `GET {AUTH_BASE}/paystack/transaction/verify?reference=...`

```ts
// Start checkout
const initRes = await fetch("/api/auth/paystack/transaction/initialize", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    plan: "starter",
    callbackURL: `${window.location.origin}/billing/paystack/callback`,
    // Optional for org/team billing (requires authorizeReference)
    // referenceId: "org_123",
  }),
});

const init = await initRes.json();
// { url, reference, accessCode, redirect: true }
if (init?.url) window.location.href = init.url;

// On your callback page/route
const reference = new URLSearchParams(window.location.search).get("reference");
if (reference) {
  await fetch(
    `/api/auth/paystack/transaction/verify?reference=${encodeURIComponent(reference)}`,
  );
}
```

### Inline modal checkout (optional)

If you prefer an inline checkout experience, initialize the transaction the same way and use `@alexasomba/paystack-browser` in your UI. This plugin does not render UI — it only provides server endpoints.

### Listing local subscriptions

List subscription rows stored by this plugin:

`GET {AUTH_BASE}/paystack/subscription/list-local`

You can optionally pass `referenceId` as a query param (requires `authorizeReference` when it’s not the current user):

`GET {AUTH_BASE}/paystack/subscription/list-local?referenceId=org_123`

### Enabling / disabling a subscription

Paystack requires both the subscription code and the email token.

For convenience, the plugin lets you omit `emailToken` and will attempt to fetch it from Paystack using the subscription code (via Subscription fetch, with a fallback to Manage Link).

- `POST {AUTH_BASE}/paystack/subscription/enable` with `{ subscriptionCode, emailToken? }`
- `POST {AUTH_BASE}/paystack/subscription/disable` with `{ subscriptionCode, emailToken? }`

Paystack documents these as `code` + `token`. If the server cannot fetch `emailToken`, you can still provide it explicitly (e.g., from the Subscription API or your Paystack dashboard).

## Schema

The plugin adds the following to your Better Auth database schema.

### `user`

| Field                  | Type     | Required | Default |
| ---------------------- | -------- | -------- | ------- |
| `paystackCustomerCode` | `string` | no       | —       |

### `subscription` (only when `subscription.enabled: true`)

| Field                          | Type      | Required | Default        |
| ------------------------------ | --------- | -------- | -------------- |
| `plan`                         | `string`  | yes      | —              |
| `referenceId`                  | `string`  | yes      | —              |
| `paystackCustomerCode`         | `string`  | no       | —              |
| `paystackSubscriptionCode`     | `string`  | no       | —              |
| `paystackTransactionReference` | `string`  | no       | —              |
| `status`                       | `string`  | no       | `"incomplete"` |
| `periodStart`                  | `date`    | no       | —              |
| `periodEnd`                    | `date`    | no       | —              |
| `trialStart`                   | `date`    | no       | —              |
| `trialEnd`                     | `date`    | no       | —              |
| `cancelAtPeriodEnd`            | `boolean` | no       | `false`        |
| `groupId`                      | `string`  | no       | —              |
| `seats`                        | `number`  | no       | —              |

## Options

Main options:

- `paystackClient` (recommended: `createPaystack({ secretKey })`)
- `paystackWebhookSecret`
- `createCustomerOnSignUp?`
- `onCustomerCreate?`, `getCustomerCreateParams?`
- `onEvent?`
- `schema?` (override/mapping)

Subscription options (when `subscription.enabled: true`):

- `plans` (array or async function)
- `requireEmailVerification?`
- `authorizeReference?`
- `onSubscriptionComplete?`, `onSubscriptionUpdate?`, `onSubscriptionDelete?`

## Troubleshooting

- Webhook signature mismatch: ensure your server receives the raw body, and `PAYSTACK_WEBHOOK_SECRET` matches the secret key used by Paystack to sign events.
- Subscription list returns empty: verify you’re passing the correct `referenceId`, and that `authorizeReference` allows it.
- Transaction initializes but verify doesn’t update: ensure you call the verify endpoint after redirect, and confirm Paystack returns `status: "success"` for the reference.

---

## 🏗️ Development & Contributing

This repository is set up as a pnpm workspace. You can run and build examples via `--filter`.

```bash
# Install everything
pnpm install

# Build the core library
pnpm --filter "@alexasomba/better-auth-paystack" build

# Run Next.js example (Next.js + Better Auth)
pnpm --filter nextjs-better-auth-paystack dev

# Run TanStack Start example (TanStack Start + Better Auth)
pnpm --filter tanstack-start-better-auth-paystack dev
```

## Links

- GitHub Repository: [alexasomba/better-auth-paystack](https://github.com/alexasomba/better-auth-paystack)
- Paystack Webhooks: https://paystack.com/docs/payments/webhooks/
- Paystack Transaction API: https://paystack.com/docs/api/transaction/
- Paystack Subscription API: https://paystack.com/docs/api/subscription/
- Paystack Plan API: https://paystack.com/docs/api/plan/
