import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { anonymous } from "better-auth/plugins";
import { paystack } from "@alexasomba/better-auth-paystack";
import { createPaystack } from "@alexasomba/paystack-node";

const data = {
    user: [],
    session: [],
    verification: [],
    account: [],
    subscription: [],
};

const memory = memoryAdapter(data);

const baseURL = process.env.BETTER_AUTH_BASE_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

const secretKey = process.env.PAYSTACK_SECRET_KEY;
const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;

if (!secretKey) {
    throw new Error("Missing PAYSTACK_SECRET_KEY");
}
if (!webhookSecret) {
    throw new Error("Missing PAYSTACK_WEBHOOK_SECRET");
}

const paystackClient = createPaystack({
    secretKey,
});

export const auth = betterAuth({
    baseURL,
    database: memory,
    emailAndPassword: { enabled: true },
    plugins: [
        anonymous(),
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
        }),
    ],
});
