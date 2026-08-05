---
name: paystack-schema-migrations
description: >
  Modify or review better-auth-paystack database schema behavior. Use for paystackProduct, paystackPlan, paystackTransaction, subscription, user.paystackCustomerCode, organization.paystackCustomerCode/email, Better Auth schema overrides, mergeSchema behavior, migrations, indexes, unique fields, and backward-compatible table or field changes.
type: core
library: "better-auth-paystack"
library_version: "3.2.1" # x-release-please-version
license: "MIT"
compatibility: "Node.js >=22.0.0; better-auth ^1.6.9; @alexasomba/paystack-node 1.10.x; better-auth-paystack >=3.0.0 <4.0.0"
sources:
  - "alexasomba/better-auth-paystack:src/schema.ts"
  - "alexasomba/better-auth-paystack:src/types.ts"
  - "alexasomba/better-auth-paystack:test/paystack.test.ts"
  - "alexasomba/better-auth-paystack:test/typesafety.test.ts"
---

## Schema Contract

The plugin contributes Better Auth schema through `getSchema(options)`.

Always included:

- `user.paystackCustomerCode`
- `paystackTransaction`
- `paystackProduct`
- `paystackPlan`

Included when `subscription.enabled` is true:

- `subscription`

Included when `organization.enabled` is true:

- `organization.paystackCustomerCode`
- `organization.email`

Product and plan tables are intentionally always present. Do not make them optional in a
compatibility-preserving release.

## Core Patterns

### Use schema overrides only for Better Auth-supported customization

Consumers can pass `options.schema` and the plugin merges it with the default schema via
`mergeSchema`. Use this for model/field naming and migration metadata, not for removing core billing
state.

When subscriptions are disabled, `getSchema` strips a user-provided `subscription` override before
merging so the subscription model is not reintroduced accidentally.

### Preserve field compatibility

Schema changes affect persisted billing state. Treat these as migration-sensitive:

- changing required fields
- changing uniqueness or indexes
- renaming `paystack*` identity fields
- changing transaction `reference` uniqueness
- changing subscription `paystackSubscriptionCode` uniqueness
- changing product/plan `paystackId` or `planCode` uniqueness

Prefer additive optional fields in minor releases. Required field changes need clear migrations and
major-version scrutiny.

### Keep TypeScript schema exports aligned

`PaystackPluginSchema`, individual schema exports, and `PaystackOptions["schema"]` should stay in
sync. If a field is added to a schema table, update the corresponding TypeScript table type in
`src/schema.ts`.

## Common Mistakes

### Removing catalog tables when products are unused

The package supports catalog sync and discovery. `paystackProduct` and `paystackPlan` remain part of
the plugin schema even if a specific app only uses subscriptions or only uses transactions.

### Reintroducing subscription schema when subscriptions are disabled

Keep the guard in `getSchema` that removes `options.schema.subscription` unless
`subscription.enabled` is true.

### Forgetting organization schema conditions

Organization billing fields should only be added when `organization.enabled` is true.

## Verification

Run schema and type tests after schema changes:

```bash
vp test test/paystack.test.ts test/typesafety.test.ts
vp check
```
