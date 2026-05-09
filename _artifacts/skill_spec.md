# Better Auth Paystack Intent Skill Spec

This package should expose skills for agents implementing Paystack billing with Better Auth. The skills should be task-focused and grounded in the public package surface:

- `paystack()` server plugin from `@alexasomba/better-auth-paystack`
- `paystackClient()` client plugin from `@alexasomba/better-auth-paystack/client`
- subscription actions: `create`, `upgrade`, `cancel`, `restore`, `list`, `billingPortal`
- transaction actions: initialize, verify, list
- server-only operations: `chargeSubscriptionRenewal`, `syncPaystackProducts`, `syncPaystackPlans`
- organization authorization defaults: `owner`/`admin` unless `subscription.authorizeReference` is supplied

Generate flat skills because the package is focused and has fewer than five high-value agent intents.

## Skill List

1. `better-auth-paystack/setup`
   - Use when installing or configuring the package with Better Auth.
   - Cover server and client plugin setup, schema behavior, environment secrets, products/plans, and canonical client namespaces.

2. `better-auth-paystack/subscriptions-and-transactions`
   - Use when building checkout, transaction verification, subscription lifecycle, products/plans, or recurring renewal/catalog sync flows.
   - Emphasize browser-safe client methods vs server-only helpers.

3. `better-auth-paystack/organization-billing`
   - Use when enabling organization billing, owner/admin authorization, custom `authorizeReference`, customer creation, seats, teams, invitations, and member limits.

4. `better-auth-paystack/billing-catalog-and-limits`
   - Use when configuring products, plans, native vs local billing, trials, seat billing, plan limits, and catalog sync.
   - Emphasize `planCode`, `freeTrial`, `seatAmount`, `seatPlanCode`, `limits`, `syncPaystackProducts`, and `syncPaystackPlans`.

5. `better-auth-paystack/tanstack-start`
   - Use when integrating the package in the TanStack Start example pattern, including API routes, `tanstackStartCookies()`, server functions, and Cloudflare Worker deployment.

## Shared Constraints

- Do not instruct agents to import from `@better-auth/core/*` in runtime package code.
- Keep product and plan schema tables enabled by default.
- Prefer canonical client methods over deprecated `subscription.disable` and `subscription.enable` aliases.
- Do not expose admin renewal or catalog sync helpers to browser-triggered auth client actions.
- Organization billing defaults to owner/admin access unless explicitly overridden.
