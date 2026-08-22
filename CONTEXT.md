# Context

## Domain Terms

### Billing Reference

A user or organization identifier used as the owner of Paystack transactions, subscriptions, limits, and billing history. A billing reference can be the session user id or an organization id authorized for billing actions.

### Reference Access

The authorization decision for a billing reference and billing action. Reference access is granted to the billing reference owner, to organization owner/admin members, or by `subscription.authorizeReference`.

### Billing Store

The persistence module for Paystack billing records stored through the Better Auth adapter. It owns
provider-namespaced subscription lookup, transaction recording, catalog persistence, Paystack
customer records, and current subscription selection.

### Paystack Adapter

The module that hides Paystack SDK response shapes and grouped SDK operations behind normalized billing operations.

### Subscription Lifecycle

The workflow that turns checkout, verification, trials, proration, renewals, and scheduled changes into local subscription and transaction state.

### Trusted Operation

A server-only billing operation that must not be exposed as a browser-triggered auth endpoint. Catalog sync and local subscription renewal are trusted operations.

### Webhook Event Record

A provider-namespaced record of a verified raw webhook payload. Paystack uses a stable payload hash
as its event identity, persists pending processing state, and acknowledges already-processed
duplicate deliveries without repeating billing side effects.

### Payment Credential Service

The server-only boundary that encrypts and decrypts Paystack authorization codes and email tokens.
Credentials live in `paystackPaymentCredential`, never in `paystackSubscription`, and are never
returned through client-facing APIs or callbacks.

### Schema Migration

`migratePaystackSubscriptionSchema` copies legacy `subscription` rows and auth-table customer
codes into Paystack-owned models without deleting legacy data. It is idempotent and reports retryable
partial failures.
