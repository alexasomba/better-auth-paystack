# Better Auth Paystack Plugin

A TypeScript-first plugin that integrates Paystack into [Better Auth](https://www.better-auth.com), providing a production-ready billing system with support for subscriptions (native & local), one-time payments, trials, organization billing, and secure webhooks.

[**Live Demo (Tanstack Start)**](https://better-auth-paystack.gittech.workers.dev) | [**Source Code**](https://github.com/alexasomba/better-auth-paystack/tree/main/examples/tanstack)

## Features

- [x] **Billing Patterns**: Support for Paystack-native plans, local-managed subscriptions, and one-time payments (products/amounts).
- [x] **Auto Customer Creation**: Optional Paystack customer creation on user sign up or organization creation.
- [x] **Trial Management**: Configurable trial periods with built-in abuse prevention logic.
- [x] **Organization Billing**: Associate subscriptions with organizations and authorize access via roles.
- [x] **Enforced Limits**: Automatic enforcement of seat limits (members) and resource limits (teams).
- [x] **Popup Modal Flow**: Optional support for Paystack's inline checkout experience via `@alexasomba/paystack-browser`.
- [x] **Webhook Security**: Pre-configured signature verification (HMAC-SHA512).
- [x] **Transaction History**: Built-in support for listing and viewing local transaction records.

---

## Quick Start

### 1. Install Plugin & SDKs

```bash
npm install better-auth @alexasomba/better-auth-paystack @alexasomba/paystack-node
```

#### Optional: Browser SDK (for Popup Modals)

```bash
npm install @alexasomba/paystack-browser
```

### 2. Configure Environment Variables

```env
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_WEBHOOK_SECRET=sk_test_... # Usually same as your paystack secret key
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:8787
```

### 3. Setup Server Plugin

```ts title="auth.ts"
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
            name: "pro",
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

### 4. Configure Client Plugin

```ts title="client.ts"
import { createAuthClient } from "better-auth/client";
import { paystackClient } from "@alexasomba/better-auth-paystack/client";

export const client = createAuthClient({
  plugins: [paystackClient({ subscription: true })],
});
```

### 5. Migrate Database Schema

```bash
npx better-auth migrate
```

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

The plugin automatically enforces limits based on the active subscription.

### Member Seat Limits

Purchased seats are stored in the `subscription.seats` field. The plugin hooks into `member.create` and `invitation.create` to block additions once the limit is reached.

### Resource Limits (e.g., Teams)

Define limits in your plan config, and they will be checked during resource creation:

```ts
plans: [{ name: "pro", limits: { teams: 5, seats: 10 } }];
```

The plugin natively checks the `teams` limit if using the Better Auth Organization plugin.

---

## Advanced Usage

### Organization Billing

Enable `organization.enabled` to bill organizations instead of users.

- **Auto Customer**: Organizations get their own `paystackCustomerCode`.
- **Authorization**: Use `authorizeReference` to control who can manage billing (e.g., Owners/Admins).

### Inline Popup Modal

Use `@alexasomba/paystack-browser` for a seamless UI.

```ts
const { data } = await authClient.subscription.upgrade({ plan: "pro" });
if (data?.accessCode) {
  const paystack = createPaystack({ publicKey: "pk_test_..." });
  paystack.checkout({
    accessCode: data.accessCode,
    onSuccess: (res) =>
      authClient.paystack.transaction.verify({ reference: res.reference }),
  });
}
```

### Trial Abuse Prevention

The plugin checks the `referenceId` history. If a trial was ever used (active, expired, or trialing), it will not be granted again, preventing resubscribe-abuse.

### Lifecycle Hooks

React to billing events on the server by providing callbacks in your configuration:

#### Subscription Hooks (`subscription.*`)

- `onSubscriptionComplete`: Called after successful transaction verification (Native or Local).
- `onSubscriptionCreated`: Called when a subscription record is first initialized in the DB.
- `onSubscriptionUpdate`: Called whenever a subscription's status or period is updated.
- `onSubscriptionCancel`: Called when a user or organization cancels their subscription.
- `onSubscriptionDelete`: Called when a subscription record is deleted.

#### Customer Hooks (`top-level` or `organization.*`)

- `onCustomerCreate`: Called after the plugin successfully creates a Paystack customer.
- `getCustomerCreateParams`: Return a custom object to override/extend the data sent to Paystack during customer creation.

#### Trial Hooks (`subscription.plans[].freeTrial.*`)

- `onTrialStart`: Called when a new trial period begins.
- `onTrialEnd`: Called when a trial period ends naturally or via manual upgrade.

#### Global Hook

- `onEvent`: Receives every webhook event payload sent from Paystack for custom processing.

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

The client plugin exposes fully typed methods under `authClient.paystack` and `authClient.subscription`.

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
  metadata?: Record<string, any>;
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
  // ... same as upgradeSubscription
};
```

### `authClient.subscription.list`

List subscriptions for a user or organization.

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
   * The Paystack subscription code (e.g. SUB_...)
   */
  subscriptionCode: string;
  /**
   * The email token required by Paystack to manage the subscription.
   * Optional: The server will try to fetch it if omitted.
   */
  emailToken?: string;
};
```

## Schema Reference

The plugin extends your database with the following fields and tables.

### `user`

| Field                  | Type     | Required | Description                                   |
| :--------------------- | :------- | :------- | :-------------------------------------------- |
| `paystackCustomerCode` | `string` | No       | The unique customer identifier from Paystack. |

### `organization`

| Field                  | Type     | Required | Description                                                                                |
| :--------------------- | :------- | :------- | :----------------------------------------------------------------------------------------- |
| `paystackCustomerCode` | `string` | No       | The unique customer identifier for the organization.                                       |
| `email`                | `string` | No       | The billing email for the organization. fallsback to organization owner's email if absent. |

### `subscription`

| Field                          | Type      | Required | Description                                                     |
| :----------------------------- | :-------- | :------- | :-------------------------------------------------------------- |
| `plan`                         | `string`  | Yes      | Lowercased name of the active plan.                             |
| `referenceId`                  | `string`  | Yes      | Associated User ID or Organization ID.                          |
| `paystackCustomerCode`         | `string`  | No       | The Paystack customer code for this subscription.               |
| `paystackSubscriptionCode`     | `string`  | No       | The unique code for the subscription (e.g., `SUB_...`).         |
| `paystackTransactionReference` | `string`  | No       | The reference of the transaction that started the subscription. |
| `status`                       | `string`  | Yes      | `active`, `trialing`, `canceled`, `incomplete`.                 |
| `periodStart`                  | `Date`    | No       | Start date of the current billing period.                       |
| `periodEnd`                    | `Date`    | No       | End date of the current billing period.                         |
| `trialStart`                   | `Date`    | No       | Start date of the trial period.                                 |
| `trialEnd`                     | `Date`    | No       | End date of the trial period.                                   |
| `cancelAtPeriodEnd`            | `boolean` | No       | Whether to cancel at the end of the current period.             |
| `seats`                        | `number`  | No       | Purchased seat count for team billing.                          |

### `paystackTransaction`

| Field         | Type     | Required | Description                                       |
| :------------ | :------- | :------- | :------------------------------------------------ |
| `reference`   | `string` | Yes      | Unique transaction reference.                     |
| `referenceId` | `string` | Yes      | Associated User ID or Organization ID.            |
| `userId`      | `string` | Yes      | The ID of the user who initiated the transaction. |
| `amount`      | `number` | Yes      | Transaction amount in smallest currency unit.     |
| `currency`    | `string` | Yes      | Currency code (e.g., "NGN").                      |
| `status`      | `string` | Yes      | `success`, `pending`, `failed`, `abandoned`.      |
| `plan`        | `string` | No       | Name of the plan associated with the transaction. |
| `metadata`    | `string` | No       | JSON string of extra transaction metadata.        |
| `paystackId`  | `string` | No       | The internal Paystack ID for the transaction.     |

---

## Troubleshooting

- **Webhook Signature**: Ensure `PAYSTACK_WEBHOOK_SECRET` is correct matches your Paystack Dashboard's secret key.
- **Email Verification**: Use `requireEmailVerification: true` to prevent unverified checkouts.
- **Redirect Failures**: Check your browser console; Paystack often returns 429 errors if you're hitting the test API too frequently.
- **Reference mismatches**: Ensure `referenceId` is passed correctly for Organization billing.
- **Authorization Denied**: Verify your `authorizeReference` logic is correctly checking user roles or organization memberships.

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

### v1.1.0 - Manual Recurring Subscriptions

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
- Comprehensive and up-to-date Paystack Node SDK: [alexasomba/paystack-node](https://github.com/alexasomba/paystack-node)
- Comprehensive and up-to-date Paystack Browser SDK: [alexasomba/paystack-browser](https://github.com/alexasomba/paystack-browser)
- [TanStack Start Example Implementation](https://github.com/alexasomba/better-auth-paystack/tree/main/examples/tanstack)
- Paystack Webhooks: https://paystack.com/docs/payments/webhooks/
- Paystack Transaction API: https://paystack.com/docs/api/transaction/
- Paystack Subscription API: https://paystack.com/docs/api/subscription/
- Paystack Plan API: https://paystack.com/docs/api/plan/
- [Better Auth Documentation](https://www.better-auth.com/docs)
