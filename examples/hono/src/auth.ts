import { betterAuth } from "better-auth";
import {
  paystack,
  type PaystackOptions,
  type PaystackPlan,
  type PaystackProduct,
} from "better-auth-paystack";
import { memoryAdapter } from "better-auth/adapters/memory";
import { anonymous, admin, organization } from "better-auth/plugins";

import { createPaystackRestClient, type PaystackRestClient } from "./paystack-rest";

export interface Bindings {
  PAYSTACK_SECRET_KEY?: string;
  PAYSTACK_WEBHOOK_SECRET?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_BASE_URL?: string;
}

const data: Record<string, unknown[]> = {
  user: [],
  session: [],
  verification: [],
  account: [],
  subscription: [],
  paystackSubscription: [],
  paystackTransaction: [],
  paystackCustomer: [],
  paystackPaymentCredential: [],
  paystackProduct: [],
  paystackPlan: [],
  paystackWebhookEvent: [],
  organization: [],
  member: [],
  invitation: [],
};

const memory = memoryAdapter(data);

const subscriptionPlans: PaystackPlan[] = [
  {
    name: "starter",
    amount: 500000,
    currency: "NGN",
    interval: "monthly",
    paystackId: "starter",
    freeTrial: { days: 7 },
    description: "Perfect for testing the waters",
    features: ["Basic analytics", "Up to 5 projects", "Community support"],
  },
  {
    name: "pro",
    amount: 1000000,
    currency: "NGN",
    interval: "monthly",
    paystackId: "pro",
    description: "For serious professionals",
    features: ["Advanced analytics", "Unlimited projects", "Priority support"],
  },
  {
    name: "team",
    amount: 2500000,
    currency: "NGN",
    interval: "monthly",
    seatAmount: 500000,
    paystackId: "team",
    description: "Best for growing teams",
    features: ["Everything in Pro", "Team collaboration", "Audit logs"],
  },
  {
    name: "business",
    amount: 5000000,
    currency: "NGN",
    interval: "monthly",
    seatAmount: 1000000,
    paystackId: "business",
    freeTrial: { days: 7 },
    description: "Best for established businesses",
    features: ["Everything in Pro", "Team collaboration", "Priority support"],
  },
  {
    name: "enterprise",
    amount: 10000000,
    currency: "NGN",
    interval: "annually",
    paystackId: "enterprise",
    description: "For large scale organizations",
    features: ["Everything in Team", "Dedicated account manager", "SLA"],
  },
];

const productCatalog: PaystackProduct[] = [
  {
    name: "50 Credits Pack",
    price: 250000,
    currency: "NGN",
    metadata: JSON.stringify({ type: "credits", quantity: 50 }),
  },
  {
    name: "150 Credits Pack",
    price: 600000,
    currency: "NGN",
    metadata: JSON.stringify({ type: "credits", quantity: 150 }),
  },
];

export function createPaystackOptions(env: Bindings): PaystackOptions<PaystackRestClient> {
  const secretKey = env.PAYSTACK_SECRET_KEY ?? "missing-paystack-secret";
  const paystackClient = createPaystackRestClient(secretKey);

  return {
    secretKey,
    paystackClient,
    paystackWebhookSecret: env.PAYSTACK_WEBHOOK_SECRET ?? secretKey,
    organization: { enabled: true },
    subscription: {
      enabled: true,
      allowedPaymentChannels: ["card"],
      plans: subscriptionPlans,
      authorizeReference: async ({ user, referenceId }, ctx) => {
        if (referenceId === "" || referenceId === user.id) {
          return true;
        }

        const members = await ctx.context.adapter.findMany({
          model: "member",
          where: [
            { field: "userId", value: user.id },
            { field: "organizationId", value: referenceId },
          ],
        });
        if (members.length === 0) return false;
        const member = (members as { role?: unknown }[])[0];
        return member.role === "owner" || member.role === "admin";
      },
    },
    products: { products: productCatalog },
  };
}

export function createAuth(req: Request, env: Bindings) {
  const baseURL = env.BETTER_AUTH_URL ?? env.BETTER_AUTH_BASE_URL ?? new URL(req.url).origin;
  const secret = env.BETTER_AUTH_SECRET ?? env.PAYSTACK_SECRET_KEY;

  if (secret == null || secret.length === 0) {
    throw new Error("Missing BETTER_AUTH_SECRET. Set it in .dev.vars to run the example.");
  }

  return betterAuth({
    baseURL,
    secret,
    database: memory,
    emailAndPassword: { enabled: true },
    plugins: [anonymous(), organization(), admin(), paystack(createPaystackOptions(env))],
  });
}
