# Better Auth Paystack Plugin (Community)

A community-maintained Better Auth plugin that integrates Paystack for customer creation, payments, and (optionally) subscriptions.

## Install

```bash
npm install better-auth @alexasomba/better-auth-paystack
```

## Server

```ts
import { betterAuth } from "better-auth";
import { paystack } from "@alexasomba/better-auth-paystack";
import Paystack from "@alexasomba/paystack-node";

const paystackClient = new Paystack(process.env.PAYSTACK_SECRET_KEY!);

export const auth = betterAuth({
  plugins: [
    paystack({
      paystackClient,
      paystackWebhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET!,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: [{ name: "starter", amount: 500000, currency: "NGN" }],
      },
    }),
  ],
});
```

## Client

```ts
import { createAuthClient } from "better-auth/client";
import { paystackClient } from "@alexasomba/better-auth-paystack/client";

export const client = createAuthClient({
  plugins: [paystackClient({ subscription: true })],
});
```

## Notes

- Webhook verification uses the `x-paystack-signature` header (HMAC-SHA512).
- For Paystack-native subscription flows, use `/paystack/transaction/initialize` + `/paystack/transaction/verify`, and `/paystack/subscription/enable|disable` (email token + subscription code).
