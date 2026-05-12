# Context

## Domain Terms

### Billing Reference

A user or organization identifier used as the owner of Paystack transactions, subscriptions, limits, and billing history. A billing reference can be the session user id or an organization id authorized for billing actions.

### Reference Access

The authorization decision for a billing reference and billing action. Reference access is granted to the billing reference owner, to organization owner/admin members, or by `subscription.authorizeReference`.

### Billing Store

The persistence module for Paystack billing records stored through the Better Auth adapter. It owns subscription lookup, transaction recording, catalog persistence, customer-code writes, and current subscription selection.

### Paystack Adapter

The module that hides Paystack SDK response shapes and grouped SDK operations behind normalized billing operations.

### Subscription Lifecycle

The workflow that turns checkout, verification, trials, proration, renewals, and scheduled changes into local subscription and transaction state.

### Trusted Operation

A server-only billing operation that must not be exposed as a browser-triggered auth endpoint. Catalog sync and local subscription renewal are trusted operations.
