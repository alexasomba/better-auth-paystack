import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { anonymous } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { paystack } from "@alexasomba/better-auth-paystack";
import { createPaystack } from "@alexasomba/paystack-node";

const data = {
    user: [],
    session: [],
    verification: [],
    account: [],
    subscription: [],
    paystackTransaction: [],
};

const memory = memoryAdapter(data);

const baseURL = process.env.VITE_BETTER_AUTH_BASE_URL ?? process.env.VITE_BETTER_AUTH_URL ?? "http://localhost:4173";

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
        ...(paystackClient && webhookSecret ? [
            paystack({
                paystackClient,
                paystackWebhookSecret: webhookSecret,
                subscription: {
                    enabled: true,
                    plans: [
                        {
                            name: "starter",
                            amount: 500000, // 5,000 NGN
                            currency: "NGN",
                            interval: "monthly",
                        },
                        {
                            name: "pro",
                            amount: 1200000, // 12,000 NGN
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
