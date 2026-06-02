---
name: paystack-organization-billing
description: >
  Configure organization billing in @alexasomba/better-auth-paystack. Use for organization.enabled, Better Auth organization plugin setup, owner/admin default billing authorization, organization.billingRoles, subscription.authorizeReference, organization Paystack customers, seats, invitations, members, and team limits.
type: core
library: "@alexasomba/better-auth-paystack"
library_version: "3.0.0" # x-release-please-version
license: "MIT"
compatibility: "Node.js >=22.0.0; better-auth ^1.6.9; @alexasomba/paystack-node 1.10.x; @alexasomba/better-auth-paystack >=3.0.0 <4.0.0"
sources:
  - "alexasomba/better-auth-paystack:README.md"
  - "alexasomba/better-auth-paystack:src/index.ts"
  - "alexasomba/better-auth-paystack:src/utils.ts"
  - "alexasomba/better-auth-paystack:src/limits.ts"
---

## Setup

Install the Better Auth organization plugin and enable Paystack organization billing:

```ts
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins/organization";
import { paystack } from "@alexasomba/better-auth-paystack";

export const auth = betterAuth({
  plugins: [
    organization(),
    paystack({
      secretKey: process.env.PAYSTACK_SECRET_KEY!,
      webhook: {
        secret: process.env.PAYSTACK_WEBHOOK_SECRET!,
      },
      subscription: {
        enabled: true,
        plans: [
          {
            name: "team",
            amount: 1_000_000,
            currency: "NGN",
            interval: "monthly",
            planCode: "PLN_team",
            paystackId: "1002",
            limits: {
              seats: 10,
              teams: 3,
            },
          },
        ],
      },
      organization: {
        enabled: true,
        billingRoles: ["owner", "admin", "billing"],
      },
    }),
  ],
});
```

## Core Patterns

### Rely on the safe default for billing authorization

When `subscription.authorizeReference` is not supplied, organization billing actions require membership role `owner` or `admin`.

Ordinary members are rejected by default. Do not write UI or tests that assume any member can create, upgrade, cancel, or restore organization subscriptions.

### Add trusted billing roles without replacing the default

Use `organization.billingRoles` when a product needs a role such as `billing`, `finance`, or `accounting` to manage organization billing while preserving the built-in user self-access, organization membership lookup, and action scoping.

```ts
paystack({
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
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

Role matching supports Better Auth string roles, comma-separated role strings like `"member,billing"`, and array roles like `["member", "billing"]`.

### Override authorization explicitly for custom workflows

Use `subscription.authorizeReference` when a product needs lower-level policy checks that cannot be represented as organization roles:

```ts
paystack({
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
  subscription: {
    enabled: true,
    plans: [],
    authorizeReference: async ({ user, referenceId }, ctx) => {
      if (referenceId === user.id) return true;

      const memberships = await ctx.context.adapter.findMany({
        model: "member",
        where: [
          { field: "userId", value: user.id },
          { field: "organizationId", value: referenceId },
        ],
      });

      return memberships.some((membership) => {
        const role = (membership as { role?: string }).role;
        return role === "owner" || role === "admin" || role === "billing";
      });
    },
  },
  organization: {
    enabled: true,
  },
});
```

When supplied, `authorizeReference` is authoritative. Include all user and organization cases you want to allow.

### Create organization Paystack customers

When organization billing is enabled and the organization plugin is present, the plugin wires organization creation hooks. It tries to create a Paystack customer for the organization and stores `paystackCustomerCode`.

Customize creation params when needed:

```ts
organization: {
  enabled: true,
  getCustomerCreateParams: async (org) => ({
    metadata: JSON.stringify({
      organizationId: org.id,
      billingSource: "better-auth-paystack",
    }),
  }),
  onCustomerCreate: async ({ paystackCustomer, organization }, ctx) => {
    await ctx.context.adapter.update({
      model: "organization",
      where: [{ field: "id", value: organization.id }],
      update: {
        paystackCustomerCode: paystackCustomer.customer_code,
      },
    });
  },
}
```

## Common Mistakes

### Enabling organization billing without the organization plugin

If `organization.enabled` is true but Better Auth's organization plugin is missing, Paystack logs a clear error and skips organization hook wiring. Add `organization()` before relying on organization customer creation, members, invitations, seats, or team hooks.

### Assuming member limits apply without subscription plans

Seat and team limits come from subscription plan limits. If a plan has no relevant `limits` value, the plugin cannot enforce that limit.

### Forgetting seat sync after membership changes

The plugin hooks member/invitation lifecycle events when the organization plugin is present. If you implement custom membership mutation routes outside Better Auth's adapter hooks, explicitly re-check or sync seat state in that custom path.
