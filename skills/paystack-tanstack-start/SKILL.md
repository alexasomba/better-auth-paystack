---
name: paystack-tanstack-start
description: >
  Integrate better-auth-paystack in TanStack Start. Use for Better Auth API routes, tanstackStartCookies(), server functions, getRequestHeaders(), authClient Paystack actions, admin billing server functions, and Cloudflare Workers deployment.
type: composition
library: "better-auth-paystack"
library_version: "3.1.1" # x-release-please-version
license: "MIT"
compatibility: "Node.js >=22.0.0; better-auth ^1.6.9; @alexasomba/paystack-node 1.10.x; better-auth-paystack >=3.0.0 <4.0.0"
sources:
  - "alexasomba/better-auth-paystack:examples/tanstack/README.md"
  - "alexasomba/better-auth-paystack:examples/tanstack/src/lib/auth.ts"
  - "alexasomba/better-auth-paystack:examples/tanstack/src/lib/auth-client.ts"
  - "alexasomba/better-auth-paystack:examples/tanstack/src/routes/api/auth/$.ts"
---

## Setup

Create the Better Auth server config with Paystack and `tanstackStartCookies()` last:

```ts
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { paystack } from "better-auth-paystack";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  plugins: [
    paystack({
      secretKey: process.env.PAYSTACK_SECRET_KEY!,
      subscription: {
        enabled: true,
        plans: [],
      },
    }),
    tanstackStartCookies(),
  ],
});
```

Wire the catch-all auth route:

```ts
import { createFileRoute } from "@tanstack/react-router";
import { auth } from "../../../lib/auth";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
});
```

Create the client plugin:

```ts
import { createAuthClient } from "better-auth/client";
import { paystackClient } from "better-auth-paystack/client";

export const authClient = createAuthClient({
  plugins: [paystackClient()],
});
```

## Core Patterns

### Use Paystack client actions in client components

```tsx
import { authClient } from "../lib/auth-client";

export function SubscribeButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.subscription.create({
          plan: "starter",
        });
      }}
    >
      Subscribe
    </button>
  );
}
```

Use client actions for checkout and user-triggered subscription lifecycle calls. Do not import server helpers into React components.

### Use server functions for trusted billing operations

```ts
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "./auth";
import { syncPaystackPlans } from "better-auth-paystack";

export const syncPlans = createServerFn({ method: "POST" }).handler(async () => {
  const session = await auth.api.getSession({
    headers: await getRequestHeaders(),
  });

  if (!session?.user) {
    throw new Response("Unauthorized", { status: 401 });
  }

  await syncPaystackPlans(await auth.$context, {
    secretKey: process.env.PAYSTACK_SECRET_KEY!,
  });

  return { ok: true };
});
```

Pass request headers when Better Auth needs session context.

### Keep SEO and discovery route-owned

Use TanStack route `head` functions for titles, descriptions, Open Graph/Twitter tags, canonical
links, robots meta, and JSON-LD. Keep `<HeadContent />` in the root document head and `<Scripts />`
in the body.

Only leaf public pages should emit canonical links. Authenticated dashboards, billing layouts, and
Paystack callback routes should be `noindex` and excluded from the sitemap, while still remaining
available for checkout redirects and payment verification.

### Keep Cloudflare Worker dependencies compatible

The TanStack example deploys to Cloudflare Workers. Keep Better Auth companion packages on compatible versions. If `@better-auth/infra` pulls in `@better-auth/sso`, avoid mixing a beta SSO package with stable `better-auth`.

The known safe pin for this package version is:

```yaml
overrides:
  "@better-auth/sso": 1.6.9
```

## Common Mistakes

### Putting `tanstackStartCookies()` before Paystack

`tanstackStartCookies()` should be last in the Better Auth plugin array so cookie handling wraps the final auth behavior.

### Omitting auth headers in server functions

Wrong:

```ts
const session = await auth.api.getSession();
```

Correct:

```ts
const session = await auth.api.getSession({
  headers: await getRequestHeaders(),
});
```

### Debugging only root package builds

The root package can pass `vp pack` while the example Worker build fails. Reproduce Worker issues with:

```bash
pnpm --filter ./examples/tanstack build
pnpm --filter ./examples/tanstack exec wrangler deploy --dry-run
```
