import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
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

export function createAuth(req?: Request) {
    const envBaseURL = process.env.BETTER_AUTH_BASE_URL;
    const requestOrigin = req ? new URL(req.url).origin : undefined;

    const baseURL = envBaseURL ?? requestOrigin ?? "http://localhost:3000";

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;

    if (!secretKey) {
        throw new Error("Missing PAYSTACK_SECRET_KEY");
    }
    if (!webhookSecret) {
        throw new Error("Missing PAYSTACK_WEBHOOK_SECRET");
    }

    const paystackClient = createPaystackRestClient(secretKey);

    return betterAuth({
        baseURL,
        database: memory,
        emailAndPassword: { enabled: true },
        plugins: [
            paystack<ReturnType<typeof createPaystackRestClient>>({
                paystackClient,
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
        ],
    });
}
