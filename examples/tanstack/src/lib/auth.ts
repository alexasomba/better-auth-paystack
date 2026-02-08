import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { anonymous, organization } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { paystack } from "@alexasomba/better-auth-paystack";
import { createPaystack } from "@alexasomba/paystack-node";

const data: Record<string, Array<any>> = {
    user: [],
    session: [],
    verification: [],
    account: [],
    subscription: [],
    paystackTransaction: [],
    organization: [],
    member: [],
    invitation: [],
};

const memory = memoryAdapter(data);

const baseURL = process.env.BETTER_AUTH_URL ?? process.env.VITE_BETTER_AUTH_URL ?? "http://localhost:8787";

const secretKey = process.env.PAYSTACK_SECRET_KEY;
const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;

if (!secretKey) {
    console.warn("Missing PAYSTACK_SECRET_KEY in environment variables");
}
if (!webhookSecret) {
    console.warn("Missing PAYSTACK_WEBHOOK_SECRET in environment variables");
}

const paystackClient = secretKey ? createPaystack({
    secretKey,
}) : null;

export const auth = betterAuth({
    baseURL,
    database: memory,
    emailAndPassword: { enabled: true },
    plugins: [
        anonymous(),
        organization(),
        ...(paystackClient && webhookSecret ? [
            paystack({
                paystackClient,
                paystackWebhookSecret: webhookSecret,
                subscription: {
                    enabled: true,
                    plans: [
                        // ========================================
                        // Plans WITH planCode (Paystack-managed)
                        // ========================================
                        // When planCode is provided, Paystack uses its stored
                        // plan configuration (amount, currency, interval).
                        // Replace these with your actual Paystack plan codes.
                        {
                            name: "starter",
                            planCode: "PLN_jm9wgvkqykajlp7", // Replace with your Paystack plan code
                            // amount/currency/interval optional - Paystack uses its stored values
                        },
                        {
                            name: "pro",
                            planCode: "PLN_6ikzoaxnunttb5e", // Replace with your Paystack plan code
                        },
                        
                        // ========================================
                        // Plans WITHOUT planCode (Local/Custom)
                        // ========================================
                        // When planCode is NOT provided, you define the amount locally.
                        // Useful for org/team billing with referenceId.
                        {
                            name: "team",
                            amount: 2500000, // 25,000 NGN
                            currency: "NGN",
                            interval: "monthly",
                        },
                        {
                            name: "enterprise",
                            amount: 10000000, // 100,000 NGN
                            currency: "NGN",
                            interval: "annually",
                        },
                    ],
                    
                    // Authorize referenceId for organization billing
                    // This callback determines if a user can bill against a referenceId
                    authorizeReference: async ({ user, session: _session, referenceId, action: _action }, ctx) => {
                        // If no referenceId provided, allow (defaults to user.id)
                        if (!referenceId || referenceId === user.id) {
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
                            if (members.length > 0) {
                                const member = members[0] as any;
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
                            amount: 250000, // 2,500 NGN
                            currency: "NGN",
                            metadata: { type: "credits", quantity: 50 },
                        },
                        {
                            name: "150 Credits Pack",
                            amount: 600000, // 6,000 NGN
                            currency: "NGN",
                            metadata: { type: "credits", quantity: 150 },
                        },
                    ],
                },
            })
        ] : []),
        tanstackStartCookies(), // make sure this is the last plugin in the array
    ],
});
