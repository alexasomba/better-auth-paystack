/* eslint-disable no-console */
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { anonymous, organization } from "better-auth/plugins";
import { dash } from "@better-auth/infra";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import {
  paystack,
  type Subscription,
  type PaystackPlan,
  type PaystackProduct,
} from "@alexasomba/better-auth-paystack";
import { createPaystack } from "@alexasomba/paystack-node";

export const data: Record<string, unknown[]> = {
  user: [],
  session: [],
  verification: [],
  account: [],
  subscription: [],
  paystackTransaction: [],
  paystackProduct: [],
  organization: [],
  member: [],
  invitation: [],
  paystackPlan: [],
};

const memory = memoryAdapter(data);

const baseURL =
  process.env.BETTER_AUTH_URL ?? process.env.VITE_BETTER_AUTH_URL ?? "http://localhost:8787";

const secretKey = process.env.PAYSTACK_SECRET_KEY;
const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;

if (secretKey === undefined || secretKey === null || secretKey === "") {
  console.warn("Missing PAYSTACK_SECRET_KEY in environment variables");
}
if (webhookSecret === undefined || webhookSecret === null || webhookSecret === "") {
  console.warn("Missing PAYSTACK_WEBHOOK_SECRET in environment variables");
}

const paystackClient =
  secretKey !== undefined && secretKey !== null && secretKey !== ""
    ? createPaystack({
        secretKey,
      })
    : null;

export const auth = betterAuth({
  baseURL,
  database: memory,
  emailAndPassword: { enabled: true },
  plugins: [
    anonymous(),
    organization(),
    ...(paystackClient !== null &&
    webhookSecret !== undefined &&
    webhookSecret !== null &&
    webhookSecret !== ""
      ? [
          paystack({
            paystackClient: paystackClient as any, // Cast to any because of SDK structure mismatch
            secretKey: secretKey!,
            webhook: { secret: webhookSecret },

            organization: {
              enabled: true,
              onCustomerCreate: async ({ organization: org, paystackCustomer }) => {
                await Promise.resolve(); // satisfying require-await
                console.log(
                  `🏢 Paystack customer created for org "${String((org as Record<string, unknown>).name)}": ${String(paystackCustomer.customer_code)}`,
                );
              },
            },

            subscription: {
              enabled: true,

              // v0.3.0: Subscription lifecycle hooks
              onSubscriptionCreated: async ({ subscription, plan }) => {
                await Promise.resolve();
                console.log(
                  `🎉 Subscription created: ${plan.name} plan - Status: ${subscription.status}`,
                );
                if (subscription.trialStart !== undefined && subscription.trialStart !== null) {
                  console.log(
                    `   ⏰ Trial active until ${subscription.trialEnd instanceof Date ? subscription.trialEnd.toISOString() : String(subscription.trialEnd)}`,
                  );
                }
              },
              onSubscriptionCancel: async ({ subscription }) => {
                await Promise.resolve();
                console.log(`❌ Subscription cancelled: ${subscription.plan}`);
              },

              plans: [
                // ========================================
                // Plans WITH planCode (Paystack-managed)
                // ========================================
                {
                  name: "starter",
                  amount: 500000,
                  currency: "NGN",
                  interval: "monthly",
                  planCode: "PLN_jm9wgvkqykajlp7",
                  paystackId: "starter",
                  // v0.3.0: Trial period with abuse prevention (user can only get trial once)
                  freeTrial: {
                    days: 7,
                    onTrialStart: async (subscription: Subscription) => {
                      await Promise.resolve();
                      console.log(`⏰ 7-day trial started for ${subscription.referenceId}`);
                    },
                    onTrialEnd: async ({ subscription }: { subscription: Subscription }) => {
                      await Promise.resolve();
                      console.log(`✅ Trial ended, now active: ${subscription.referenceId}`);
                    },
                    onTrialExpired: async (subscription: Subscription) => {
                      await Promise.resolve();
                      console.log(
                        `⚠️ Trial expired without conversion: ${subscription.referenceId}`,
                      );
                    },
                  },
                  description: "Perfect for testing the waters",
                  features: ["Basic analytics", "Up to 5 projects", "Community support"],
                },
                {
                  name: "pro",
                  amount: 1000000,
                  currency: "NGN",
                  interval: "monthly",
                  planCode: "PLN_6ikzoaxnunttb5e",
                  paystackId: "pro",
                  description: "For serious professionals. Supports scheduled changes.",
                  features: [
                    "Advanced analytics",
                    "Unlimited projects",
                    "Priority support",
                    "Custom domain",
                  ],
                },

                // ========================================
                // Plans WITHOUT planCode (Local/Custom)
                // ========================================
                {
                  name: "team",
                  amount: 2500000,
                  currency: "NGN",
                  interval: "monthly",
                  seatAmount: 500000,
                  description: "Best for growing teams (Seat-based)",
                  features: ["Everything in Pro", "Team collaboration", "Audit logs", "SSO"],
                },
                {
                  name: "business",
                  amount: 5000000,
                  currency: "NGN",
                  interval: "monthly",
                  seatAmount: 1000000,
                  freeTrial: {
                    days: 7,
                    onTrialStart: async (subscription: Subscription) => {
                      await Promise.resolve();
                      console.log(`⏰ 7-day trial started for ${subscription.referenceId}`);
                    },
                    onTrialEnd: async ({ subscription }: { subscription: Subscription }) => {
                      await Promise.resolve();
                      console.log(`✅ Trial ended, now active: ${subscription.referenceId}`);
                    },
                    onTrialExpired: async (subscription: Subscription) => {
                      await Promise.resolve();
                      console.log(
                        `⚠️ Trial expired without conversion: ${subscription.referenceId}`,
                      );
                    },
                  },
                  description: "Best for established businesses (Seat-based)",
                  features: ["Everything in Pro", "Team collaboration", "Audit logs", "SSO"],
                },
                {
                  name: "enterprise",
                  amount: 10000000,
                  currency: "NGN",
                  interval: "annually",
                  description: "For large scale organizations",
                  features: [
                    "Everything in Team",
                    "Dedicated account manager",
                    "SLA",
                    "On-premise deployment",
                  ],
                },
              ] as PaystackPlan[],

              // Authorize referenceId for organization billing
              authorizeReference: async (
                { user, session: _session, referenceId, action: _action },
                ctx,
              ) => {
                // If no referenceId provided, allow (defaults to user.id)
                if (
                  referenceId === undefined ||
                  referenceId === null ||
                  referenceId === "" ||
                  referenceId === user.id
                ) {
                  return true;
                }

                // Check if referenceId is an organization the user belongs to
                try {
                  const members = await ctx.context.adapter.findMany({
                    model: "member",
                    where: [
                      { field: "userId", value: user.id },
                      { field: "organizationId", value: referenceId },
                    ],
                  });

                  // User is a member of this organization
                  if ((members as Record<string, unknown>[]).length > 0) {
                    const member = (members as Record<string, unknown>[])[0] as { role: string };
                    // Only owners and admins can manage billing
                    return member.role === "owner" || member.role === "admin";
                  }
                } catch (e) {
                  console.error("Error checking org membership:", e);
                }

                return false;
              },
            },
            products: {
              products: [
                {
                  name: "50 Credits Pack",
                  price: 250000, // 2,500 NGN
                  currency: "NGN",
                  metadata: JSON.stringify({ type: "credits", quantity: 50 }),
                },
                {
                  name: "150 Credits Pack",
                  price: 600000, // 6,000 NGN
                  currency: "NGN",
                  metadata: JSON.stringify({ type: "credits", quantity: 150 }),
                },
              ] as PaystackProduct[],
            },
          }),
        ]
      : []),
    dash(),
    tanstackStartCookies(), // make sure this is the last plugin in the array
  ],
});
