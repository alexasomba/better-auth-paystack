import { betterAuth } from "better-auth";
import {
  paystack,
  type PaystackOptions,
  type PaystackPlan,
  type PaystackProduct,
} from "better-auth-paystack";
import { memoryAdapter } from "better-auth/adapters/memory";
import { nextCookies } from "better-auth/next-js";
import { anonymous, admin, organization } from "better-auth/plugins";

import { createPaystackRestClient, type PaystackRestClient } from "./paystack-rest";

const data = {
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

const baseURL =
  process.env.BETTER_AUTH_URL ?? process.env.BETTER_AUTH_BASE_URL ?? "http://localhost:3000";

const secretKey = process.env.PAYSTACK_SECRET_KEY ?? "missing-paystack-secret";

export const paystackClient = createPaystackRestClient(secretKey);

export const subscriptionPlans: PaystackPlan[] = [
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

export const productCatalog: PaystackProduct[] = [
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

export const paystackOptions = {
  paystackClient,
  secretKey,
  paystackWebhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET ?? secretKey,
  organization: {
    enabled: true,
  },
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
} satisfies PaystackOptions<PaystackRestClient>;

export function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret == null || secret.length === 0) {
    throw new Error(
      "Missing BETTER_AUTH_SECRET. Set it in .env.local (or .env) for the Next.js example.",
    );
  }

  return betterAuth({
    baseURL,
    secret,
    database: memory,
    emailAndPassword: { enabled: true },
    plugins: [
      anonymous(),
      organization(),
      admin(),
      paystack(paystackOptions),
      // Keep Next.js server actions / RSC cookie handling enabled.
      nextCookies(),
    ],
  });
}

export const auth = createAuth();
