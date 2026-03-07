# Better Auth Paystack Plugin

A TypeScript-first plugin that integrates Paystack into [Better Auth](https://www.better-auth.com), providing a production-ready billing system with support for subscriptions (native & local), one-time payments, trials, organization billing, and secure webhooks.

<div align="center">

![npm downloads](https://img.shields.io/npm/dm/@alexasomba/better-auth-paystack.svg)
[![GitHub stars](https://img.shields.io/github/stars/alexasomba/better-auth-paystack.svg?style=social&label=Star)](https://github.com/alexasomba/better-auth-paystack/stargazers)
[![GitHub release](https://img.shields.io/github/v/release/alexasomba/better-auth-paystack)](https://github.com/alexasomba/better-auth-paystack/releases) 
[![bundlephobia](https://img.shields.io/bundlephobia/minzip/@alexasomba/better-auth-paystack)](https://bundlephobia.com/result?p=@alexasomba/better-auth-paystack)
[![Follow on Twitter](https://img.shields.io/twitter/follow/alexasomba?style=social)](https://twitter.com/alexasomba)
![GitHub License](https://img.shields.io/github/license/alexasomba/better-auth-paystack)

</div>

[**Live Demo (Tanstack Start)**](https://better-auth-paystack.gittech.workers.dev) | [**Source Code**](https://github.com/alexasomba/better-auth-paystack/tree/main/examples/tanstack)

## Features

- [x] **Billing Patterns**: Support for Paystack-native plans, local-managed subscriptions, and one-time payments (products/amounts).
- [x] **Auto Customer Creation**: Optional Paystack customer creation on user sign up or organization creation.
- [x] **Trial Management**: Configurable trial periods with built-in abuse prevention logic.
- [x] **Organization Billing**: Associate subscriptions with organizations and authorize access via roles.
- [x] **Enforced Limits & Seats**: Automatic enforcement of member seat upgrades and resource limits (teams).
- [x] **Scheduled Changes**: Defer subscription updates or cancellations to the end of the billing cycle.
- [x] **Proration**: Immediate mid-cycle prorated charges for seat and plan upgrades.
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

(Original content continues below here...)
