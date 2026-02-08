# Better Auth Paystack Plugin

A TypeScript-first plugin that integrates Paystack into Better Auth, enabling seamless customer creation, secure checkout, webhook verification, and native subscription flows. Designed for modern frameworks like Tanstack Start, Next.js, Hono, and Cloudflare Workers, it provides typed APIs, subscription management, and end-to-end payment integration with Paystack.

[**Live Demo (Tanstack Start)**](https://better-auth-paystack.gittech.workers.dev)

- Hosted on Cloudflare Workers
- Better-Auth Anonymous Login (for demo purpose)
- Session stored in Memory, no DB (for demo purpose)
- Please note that due to rate-limit on Paystack Secrete Test API, you might get Error "Failed to get redirect URL from Paystack" during the demo if your IP is rate limited. Other errors can be found in console.

## Features

[x] Optional Paystack customer creation on sign up (`createCustomerOnSignUp`)
[x] Paystack checkout via transaction initialize + verify (redirect-first)
[x] Paystack webhook signature verification (`x-paystack-signature`, HMAC-SHA512)
[x] Local subscription records stored in your Better Auth database
[x] Subscription management via Paystack-hosted pages (`/subscription/manage-link`)
[x] Subscription activation/deactivation endpoints (`/subscription/enable` + `/subscription/disable`)
[x] Support for one-time payment products (e.g., credit packs, top-ups)
[x] Explicit billing interval support for plans (monthly, annually, etc.)
[x] Dynamic configuration sharing via `/paystack/get-config`
[x] **Organization/Team Billing**: Bill to organizations instead of individual users via `referenceId` + `authorizeReference`
[x] Complete implementation demo on Tanstack Start example
[ ] Complete implementation demo on Next.js example (85% ready)
[ ] Complete implementation demo on Hono example

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

- Use `planCode` (Paystack plan code). When `planCode` is provided, Paystack uses the plan's amount, currency, and interval from its own records.
- Or use `amount` (smallest currency unit) for local-only plans where you handle recurring logic yourself.

#### Using Paystack Plan Codes (Recommended for Subscriptions)

When you create a plan on your Paystack dashboard, you get a plan code like `PLN_jm9wgvkqykajlp7`. You can use this in your configuration:

```ts
paystack({
  paystackClient,
  paystackWebhookSecret: process.env.PAYSTACK_SECRET_KEY!,
  subscription: {
    enabled: true,
    plans: [
      {
        name: "starter",
        planCode: "PLN_jm9wgvkqykajlp7", // Your Paystack plan code
        // amount, currency, interval are optional when using planCode
        // since Paystack already has this info stored
      },
      {
        name: "pro",
        planCode: "PLN_xxxxxxxxxxxxxx",
      },
      {
        name: "enterprise",
        planCode: "PLN_yyyyyyyyyyyyyy",
      },
    ],
  },
});
```

**How it works:**

1. When initializing a transaction with `plan: "starter"`, the plugin sends `plan: "PLN_jm9wgvkqykajlp7"` to Paystack
2. Paystack uses its stored plan configuration (amount, currency, interval)
3. When webhooks arrive (e.g., `subscription.create`), the plugin matches the `plan_code` from the webhook to update local subscription state

> **Tip:** You can still include `amount`, `currency`, and `interval` alongside `planCode` for reference in your app, but Paystack will use its own stored values.

#### Using Local Plans (Without Paystack Plan Codes)

For one-time payments or when you prefer to manage billing logic yourself:

```ts
plans: [
  {
    name: "basic",
    amount: 500000, // 5,000 NGN (in kobo)
    currency: "NGN",
    interval: "monthly", // For your app's reference
  },
];
```

In this mode, the plugin sends the `amount` directly to Paystack's transaction initialize endpoint.

### Organization / Team Billing

The plugin supports billing to entities other than the current user (e.g., organizations, teams, or any reference ID). This is controlled via the `authorizeReference` callback and `referenceId` parameter.

#### Setting Up Authorization

Combine with Better Auth's organization plugin or your own access control:

```ts
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { paystack } from "@alexasomba/better-auth-paystack";

export const auth = betterAuth({
  plugins: [
    organization(),
    paystack({
      paystackClient,
      paystackWebhookSecret: process.env.PAYSTACK_SECRET_KEY!,
      subscription: {
        enabled: true,
        plans: [
          { name: "starter", planCode: "PLN_starter_code" },
          {
            name: "team",
            amount: 2500000,
            currency: "NGN",
            interval: "monthly",
          },
        ],
        // Authorization callback: return true if user can bill to this referenceId
        authorizeReference: async ({ referenceId, user }) => {
          // Check if user is owner/admin of the organization
          const membership = await db.query.member.findFirst({
            where: and(
              eq(member.organizationId, referenceId),
              eq(member.userId, user.id),
              inArray(member.role, ["owner", "admin"]),
            ),
          });
          return !!membership;
        },
      },
    }),
  ],
});
```

#### Billing to an Organization

On the frontend, pass `referenceId` when initializing a transaction:

```ts
// Bill to an organization
const init = await authClient.paystack.transaction.initialize({
  plan: "team",
  callbackURL: `${window.location.origin}/billing/paystack/callback`,
  referenceId: "org_123abc", // The organization ID
});

if (init?.data?.url) window.location.href = init.data.url;
```

#### Querying Subscriptions by Reference

```ts
// List subscriptions for an organization
const subs = await authClient.paystack.subscription.listLocal({
  query: { referenceId: "org_123abc" },
});
```

> **Note:** If `referenceId` is omitted, the current user's ID is used as the default reference.

### Organization as Customer

When using Better Auth's organization plugin, you can automatically create a Paystack customer for each organization. This enables organization-level billing where the organization (not individual users) is the customer of record.

#### Enabling Organization Support

```ts
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { paystack } from "@alexasomba/better-auth-paystack";

export const auth = betterAuth({
  plugins: [
    organization(),
    paystack({
      paystackClient,
      paystackWebhookSecret: process.env.PAYSTACK_SECRET_KEY!,
      organization: {
        enabled: true,
        // Called when a Paystack customer is created for an organization
        onCustomerCreate: async ({ paystackCustomer, organization }) => {
          console.log(
            `Created Paystack customer ${paystackCustomer.customer_code} for org ${organization.id}`,
          );
        },
        // Optionally provide custom parameters for customer creation
        getCustomerCreateParams: async (org, ctx) => ({
          metadata: { organizationId: org.id, plan: "enterprise" },
        }),
      },
      subscription: {
        enabled: true,
        plans: [{ name: "team", planCode: "PLN_xxx" }],
        authorizeReference: async ({ referenceId, user }) => {
          // Check if user can bill to this organization
          // ...
          return true;
        },
      },
    }),
  ],
});
```

**How it works:**

1. When an organization is created, the plugin automatically creates a corresponding Paystack customer
2. The organization's `paystackCustomerCode` field is populated with the customer code
3. Subscriptions billed to `referenceId: "org_123"` are associated with that organization

### Subscription Lifecycle Hooks

The plugin provides hooks at key points in the subscription lifecycle for custom business logic.

```ts
subscription: {
  enabled: true,
  plans: [{ name: "pro", planCode: "PLN_pro" }],

  // Called when subscription is created (via webhook)
  onSubscriptionCreated: async ({ event, subscription, plan }, ctx) => {
    // Send welcome email, provision resources, etc.
    await sendWelcomeEmail(subscription.referenceId, plan.name);
  },

  // Called when subscription is canceled (via webhook)
  onSubscriptionCancel: async ({ event, subscription }, ctx) => {
    // Cleanup, send cancellation email, etc.
    await sendCancellationEmail(subscription.referenceId);
  },

  // Called when transaction verification completes a subscription
  onSubscriptionComplete: async ({ event, subscription, plan }, ctx) => {
    // Grant access, update user permissions, etc.
  },

  // Called when subscription is updated
  onSubscriptionUpdate: async ({ subscription }, ctx) => {
    // Handle plan changes, seat updates, etc.
  },
}
```

### Trial Periods

Define trial periods on your plans to let users try before they pay.

```ts
plans: [
  {
    name: "pro",
    planCode: "PLN_pro",
    freeTrial: {
      days: 14,
      // Called when a trial starts
      onTrialStart: async (subscription) => {
        await sendTrialStartEmail(subscription.referenceId);
      },
      // Called when trial ends and converts to paid
      onTrialEnd: async (subscription) => {
        await sendTrialEndEmail(subscription.referenceId);
      },
      // Called when trial expires without conversion
      onTrialExpired: async (subscription) => {
        await sendTrialExpiredEmail(subscription.referenceId);
      },
    },
  },
];
```

#### Trial Abuse Prevention

The plugin automatically prevents trial abuse by checking if a `referenceId` has ever had a trial before. If a user or organization has previously used a trial, they will not receive another trial when subscribing.

**How it works:**

1. When initializing a transaction with a plan that has `freeTrial.days` configured
2. The plugin checks for any previous subscriptions with the same `referenceId` that have `trialStart`, `trialEnd`, or `status: "trialing"`
3. If found, no trial is granted—the subscription starts immediately as paid
4. If not found, a trial is granted and `onTrialStart` is called

### Limits & Seat Management

The plugin provides built-in support for enforcing limits based on the active subscription.

#### 1. Seat Limits (Per-User Billing)

You can bill based on the number of "seats" (members) in an organization.

**Frontend:** Pass `quantity` when initializing the transaction:

```ts
const init = await authClient.paystack.transaction.initialize({
  plan: "team-plan",
  referenceId: "org_123",
  quantity: 5, // 5 Seats
  callbackURL: "...",
});
```

**Enforcement:**
The plugin automatically injects Better Auth hooks (`member.create`, `invitation.create`) to prevent adding more members than the number of purchased seats.

- if `subscription.seats` is 5, trying to add a 6th member will throw an error: `Organization member limit reached`.

#### 2. Resource Limits (e.g., Teams)

You can define arbitrary limits in your plan configuration. The plugin natively understands `teams` limit if you use the Better Auth Organization plugin.

**Config:**

```ts
plans: [
  {
    name: "startup",
    amount: 500000,
    interval: "monthly",
    limits: {
      teams: 3, // Max 3 teams allowed for this organization
    },
  },
];
```

**Enforcement:**
The plugin checks `team.create` and blocks creation if the organization has reached the `teams` limit defined in their active plan.

### Frontend checkout (redirect)

This flow matches Paystack’s transaction initialize/verify APIs:

1. Call `POST {AUTH_BASE}/paystack/transaction/initialize`
2. Redirect the user to the returned Paystack `url`
3. On your callback route/page, call `POST {AUTH_BASE}/paystack/transaction/verify` (this updates local subscription state)

####Example (typed via Better Auth client plugin):

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
if (init?.data?.url) window.location.href = init.data.url;

// 1b. Start checkout with organization billing
const initOrg = await authClient.paystack.transaction.initialize(
  {
    plan: "team",
    callbackURL: `${window.location.origin}/billing/paystack/callback`,
    referenceId: "org_123", // Bill to organization instead of personal
  },
  { throw: true },
);
if (initOrg?.url) window.location.href = initOrg.url;

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

#### Example (framework-agnostic):

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

### `organization` (only when `organization.enabled: true`)

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

### `paystackTransaction`

| Field         | Type     | Required | Default     |
| ------------- | -------- | -------- | ----------- |
| `reference`   | `string` | yes      | —           |
| `referenceId` | `string` | yes      | —           |
| `userId`      | `string` | no       | —           |
| `amount`      | `number` | yes      | —           |
| `currency`    | `string` | no       | `"NGN"`     |
| `status`      | `string` | no       | `"pending"` |
| `plan`        | `string` | no       | —           |
| `metadata`    | `string` | no       | —           |
| `paystackId`  | `string` | no       | —           |

## Options

### Main Options

| Option                    | Type       | Description                                              |
| ------------------------- | ---------- | -------------------------------------------------------- |
| `paystackClient`          | `Paystack` | Paystack SDK client instance                             |
| `paystackWebhookSecret`   | `string`   | Secret for webhook signature verification                |
| `createCustomerOnSignUp`  | `boolean`  | Create Paystack customer when user signs up              |
| `onCustomerCreate`        | `function` | Called after customer is created                         |
| `getCustomerCreateParams` | `function` | Customize customer creation params                       |
| `onEvent`                 | `function` | Called for all webhook events (after signature verified) |
| `schema`                  | `object`   | Schema overrides for field/table names                   |

### Organization Options (`organization`)

| Option                    | Type       | Description                           |
| ------------------------- | ---------- | ------------------------------------- |
| `enabled`                 | `boolean`  | Enable organization customer creation |
| `onCustomerCreate`        | `function` | Called after org customer is created  |
| `getCustomerCreateParams` | `function` | Customize org customer creation       |

### Subscription Options (`subscription`)

| Option                     | Type       | Description                                      |
| -------------------------- | ---------- | ------------------------------------------------ |
| `enabled`                  | `boolean`  | Enable subscription features                     |
| `plans`                    | `array`    | Plan configurations (or async function)          |
| `requireEmailVerification` | `boolean`  | Require verified email for checkout              |
| `authorizeReference`       | `function` | Authorize billing to referenceId                 |
| `onSubscriptionComplete`   | `function` | Called when subscription is completed via verify |
| `onSubscriptionCreated`    | `function` | Called when subscription.create webhook fires    |
| `onSubscriptionCancel`     | `function` | Called when subscription.disable webhook fires   |
| `onSubscriptionUpdate`     | `function` | Called when subscription is updated              |
| `onSubscriptionDelete`     | `function` | Called when subscription is deleted              |

### Plan Configuration

| Option      | Type     | Description                          |
| ----------- | -------- | ------------------------------------ |
| `name`      | `string` | Plan name (used in API calls)        |
| `planCode`  | `string` | Paystack plan code (recommended)     |
| `amount`    | `number` | Amount in smallest currency unit     |
| `currency`  | `string` | Currency code (e.g., "NGN")          |
| `interval`  | `string` | Billing interval (monthly, annually) |
| `limits`    | `object` | Resource limits for the plan         |
| `freeTrial` | `object` | Trial configuration with hooks       |

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

Contributions are welcome! Please open an issue or pull request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Roadmap

Future features planned for upcoming versions:

### v0.3.0 - Manual Recurring Subscriptions

- [ ] **Stored Authorization Codes**: Securely store Paystack authorization codes from verified transactions
- [ ] **Card Management UI**: Let users view/delete saved payment methods (masked card data only)
- [ ] **Charge Authorization Endpoint**: Server-side endpoint to charge stored cards for renewals
- [ ] **Renewal Scheduler Integration**: Documentation for integrating with Cloudflare Workers Cron, Vercel Cron, etc.

> **Note**: For automatic recurring subscriptions today, use Paystack-managed plans via `planCode`. Manual recurring (storing authorization codes) is planned for a future release.

### Future Considerations

- [ ] Multi-currency support improvements
- [ ] Proration for plan upgrades/downgrades
- [ ] Invoice generation
- [ ] Payment retry logic for failed renewals

## Links

- GitHub Repository: [alexasomba/better-auth-paystack](https://github.com/alexasomba/better-auth-paystack)
- Comprehensive Paystack Node SDK: [alexasomba/paystack-node](https://github.com/alexasomba/paystack-node)
- Comprehensive Paystack Browser SDK: [alexasomba/paystack-browser](https://github.com/alexasomba/paystack-browser)
- Paystack Webhooks: https://paystack.com/docs/payments/webhooks/
- Paystack Transaction API: https://paystack.com/docs/api/transaction/
- Paystack Subscription API: https://paystack.com/docs/api/subscription/
- Paystack Plan API: https://paystack.com/docs/api/plan/
