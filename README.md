# Better Auth Paystack Plugin

Better Auth plugin that integrates Paystack for customer creation, checkout, and Paystack-native subscription flows.

## Features

- Optional Paystack customer creation on sign up (`createCustomerOnSignUp`)
- Paystack checkout via transaction initialize + verify (redirect-first)
- Paystack webhook signature verification (`x-paystack-signature`, HMAC-SHA512)
- Local subscription records stored in your Better Auth database
- Subscription management endpoints using Paystack’s email-token flows (`/subscription/enable` + `/subscription/disable`)
- Reference ID support (user by default; org/team via `referenceId` + `authorizeReference`)

## Installation

### Install packages

```bash
npm install better-auth @alexasomba/better-auth-paystack
```

If you want strict typing and the recommended server SDK client:

```bash
npm install @alexasomba/paystack-node
```

If your app has separate client + server bundles, install the plugin in both.

### Configure the server plugin

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
      paystackWebhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET!,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: [
          {
            name: "starter",
            amount: 500000,
            currency: "NGN",
            // If you use Paystack Plans, prefer planCode + (optional) invoiceLimit.
            // planCode: "PLN_...",
            // invoiceLimit: 12,
          },
        ],
        authorizeReference: async ({ user, referenceId, action }, ctx) => {
          // Allow only the current user by default; authorize org/team IDs here.
          // return await canUserManageOrg(user.id, referenceId)
          return referenceId === user.id;
        },
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
3. On your callback route/page, call `GET {AUTH_BASE}/paystack/transaction/verify?reference=...`

Example (framework-agnostic):

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

The plugin adds:

- `user.paystackCustomerCode?: string`
- `subscription` table with fields like: `plan`, `referenceId`, `paystackCustomerCode`, `paystackSubscriptionCode`, `paystackTransactionReference`, `status`, and optional period/trial fields.

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

## Links

- Paystack Webhooks: https://paystack.com/docs/payments/webhooks/
- Paystack Transaction API: https://paystack.com/docs/api/transaction/
- Paystack Subscription API: https://paystack.com/docs/api/subscription/
- Paystack Plan API: https://paystack.com/docs/api/plan/
