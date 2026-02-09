# Better Auth Paystack - TanStack Start Example

A complete example demonstrating the `@alexasomba/better-auth-paystack` plugin with TanStack Start, deployed on Cloudflare Workers.

[**Live Demo**](https://better-auth-paystack.gittech.workers.dev)

## Features Demonstrated

- [x] Anonymous sign-in (demo purposes)
- [x] Paystack subscription checkout (redirect flow)
- [x] Transaction verification and status tracking
- [x] Subscription management (list, cancel)
- [x] **Organization billing** - Bill subscriptions to organizations instead of personal accounts
- [x] **Plan Code subscriptions** - Use Paystack-managed plans (`planCode`)
- [x] Dynamic plan configuration via `/paystack/get-config`

## Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start)
- **Auth**: [Better Auth](https://www.better-auth.com/)
- **Payments**: [Paystack](https://paystack.com/) via `@alexasomba/better-auth-paystack`
- **UI**: React + [Shadcn UI](https://ui.shadcn.com/) + Tailwind CSS
- **Deployment**: Cloudflare Workers

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

Create a `.dev.vars` file:

```env
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_WEBHOOK_SECRET=sk_test_...
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:8787
VITE_BETTER_AUTH_URL=http://localhost:8787
```

### 3. Run development server

```bash
pnpm dev
```

Open [http://localhost:8787](http://localhost:8787) in your browser.

### 4. Build for production

```bash
pnpm build
```

### 5. Deploy to Cloudflare Workers

```bash
pnpm deploy
```

## Project Structure

```
src/
├── lib/
│   ├── auth.ts                 # Better Auth + Paystack plugin config
│   └── auth-client.ts          # Client-side auth with Paystack client
├── routes/
│   ├── __root.tsx              # Root layout
│   ├── index.tsx               # Landing page
│   ├── dashboard.tsx           # Protected dashboard
│   └── billing/
│       └── paystack/
│           └── callback.tsx    # Paystack redirect callback
└── components/
    └── dashboard/
        ├── DashboardContent.tsx   # Dashboard tabs container
        ├── PaymentManager.tsx     # Subscription & billing UI
        ├── TransactionsTable.tsx  # Transaction history
        └── OrganizationManager.tsx # Organization management
```

## Key Implementation Details

### Server Configuration (`src/lib/auth.ts`)

```ts
import { paystack } from '@alexasomba/better-auth-paystack'
import { organization } from 'better-auth/plugins'

export const auth = betterAuth({
  plugins: [
    organization(),
    paystack({
      paystackClient,
      paystackWebhookSecret: env.PAYSTACK_SECRET_KEY,
      subscription: {
        enabled: true,
        plans: [
          // Paystack-managed plans (uses planCode)
          { name: 'starter', planCode: 'PLN_xxxxx' },
          { name: 'pro', planCode: 'PLN_yyyyy' },
          // Locally-defined plans
          {
            name: 'team',
            amount: 2500000,
            currency: 'NGN',
            interval: 'monthly',
          },
        ],
        // Control who can bill to which organization
        authorizeReference: async ({ referenceId, user }) => {
          const membership = await db.query.member.findFirst({
            where: and(
              eq(member.organizationId, referenceId),
              eq(member.userId, user.id),
            ),
          })
          return !!membership
        },
      },
    }),
  ],
})
```

### Client Configuration (`src/lib/auth-client.ts`)

```ts
import { createAuthClient } from 'better-auth/react'
import { paystackClient } from '@alexasomba/better-auth-paystack/client'
import { organizationClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL,
  plugins: [paystackClient({ subscription: true }), organizationClient()],
})
```

### Billing to an Organization

```ts
// Initialize a subscription for an organization
const result = await authClient.paystack.transaction.initialize({
  plan: 'team',
  callbackURL: `${window.location.origin}/billing/paystack/callback`,
  referenceId: 'org_123', // Organization ID
})

if (result.data?.url) {
  window.location.href = result.data.url
}
```

## Environment Variables

| Variable                  | Description                                         |
| ------------------------- | --------------------------------------------------- |
| `PAYSTACK_SECRET_KEY`     | Your Paystack secret key                            |
| `PAYSTACK_WEBHOOK_SECRET` | Webhook signing secret (usually same as secret key) |
| `BETTER_AUTH_SECRET`      | Secret for Better Auth session encryption           |
| `BETTER_AUTH_URL`         | Server-side base URL                                |
| `VITE_BETTER_AUTH_URL`    | Client-side base URL                                |

## Learn More

- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Paystack API Documentation](https://paystack.com/docs/api/)
- [@alexasomba/better-auth-paystack](https://github.com/alexasomba/better-auth-paystack)
- [TanStack Start](https://tanstack.com/start)
