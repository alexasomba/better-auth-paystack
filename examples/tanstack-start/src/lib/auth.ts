import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { paystack } from "@alexasomba/better-auth-paystack";
import { createPaystackRestClient } from "@/lib/paystack-rest";

const data = {
    user: [],
    session: [],
    verification: [],
    account: [],
    subscription: [],
};

const memory = memoryAdapter(data);

const secretKey = process.env.PAYSTACK_SECRET_KEY ?? "";
const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET ?? "";

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_BASE_URL ?? "http://localhost:3000",
    database: memory,
    emailAndPassword: { enabled: true },
    plugins: [
        paystack<ReturnType<typeof createPaystackRestClient>>({
            paystackClient: createPaystackRestClient(secretKey),
            paystackWebhookSecret: webhookSecret,
            subscription: {
                enabled: true,
                plans: [
                    {
                        name: "starter",
                        amount: 5000,
                        currency: "NGN",
                    },
                ],
            },
        }),
        // must be last
        tanstackStartCookies(),
    ],
});
