# OpenNext Starter

## Better Auth + Paystack

This example mounts Better Auth (with the Paystack plugin) at `GET/POST /api/auth/[...all]`.

### Setup

1. Install + build (repo root):

```bash
vp install
vp pack
```

2. Install example deps:

```bash
cd examples/nextjs
vp install
```

3. Configure env:

- Copy `.env.example` to `.env.local`
- Fill in `PAYSTACK_SECRET_KEY`

Note: Paystack webhook verification uses the same Paystack secret key for the `x-paystack-signature` HMAC. `PAYSTACK_WEBHOOK_SECRET` is optional and defaults to `PAYSTACK_SECRET_KEY` in this example.

Optional:

- Set `PAYSTACK_CREATE_CUSTOMER_ON_SIGNUP=1` if you want the demo to create a Paystack customer record when a user signs up.

This demo supports Paystack customer creation on sign-up and Paystack subscription flows, so use a real Paystack test secret key.

### Validate

From the repository root:

```bash
vp -C examples/nextjs run typecheck
vp -C examples/nextjs run lint
vp -C examples/nextjs run build
```

### Storage

Like the TanStack Start example, this demo uses Better Auth's in-memory adapter.
It is intended for local exploration and resets its users, organizations, subscriptions,
products, plans, and transactions when the process restarts. Use a production adapter before
deploying persistent billing data.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Read the documentation at https://opennext.js.org/cloudflare.

## Develop

Run the Next.js development server:

```bash
vp dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## What to test

The homepage is an interactive demo UI that exercises:

- Anonymous and email/password authentication
- Organization creation and personal/organization billing targets
- Five subscription plans, trials, seat quantity, schedule-at-period-end, and prorated upgrades
- One-time products, catalog sync, transaction history, and transaction verification
- Subscription cancellation, restoration, Paystack billing portal, and trusted renewals
- Webhook signature verification at `POST /api/auth/paystack/webhook` (sent by Paystack; not triggered from the browser)

Note: webhook verification is “functional” in the sense that the endpoint exists and validates signatures, but you can’t meaningfully test it from the browser. You’ll only see it fire when Paystack sends webhook events to your deployed/tunneled URL.

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

## Preview

Preview the application locally on the Cloudflare runtime:

```bash
vp run preview
```

## Deploy

Deploy the application to Cloudflare:

```bash
vp run deploy
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!
