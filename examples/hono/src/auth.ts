import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { paystack } from "@alexasomba/better-auth-paystack";
import { createPaystackRestClient } from "./paystack-rest";

export type Bindings = {
    PAYSTACK_SECRET_KEY: string;
    PAYSTACK_WEBHOOK_SECRET: string;
    BETTER_AUTH_BASE_URL?: string;
};

const data = {
    user: [],
    session: [],
    verification: [],
    account: [],
    subscription: [],
};

const memory = memoryAdapter(data);

export function createAuth(req: Request, env: Bindings) {
    const baseURL = env.BETTER_AUTH_BASE_URL ?? new URL(req.url).origin;

    const paystackClient = createPaystackRestClient(env.PAYSTACK_SECRET_KEY);

    return betterAuth({
        baseURL,
        database: memory,
        emailAndPassword: { enabled: true },
        plugins: [
            paystack<ReturnType<typeof createPaystackRestClient>>({
                paystackClient,
                paystackWebhookSecret: env.PAYSTACK_WEBHOOK_SECRET,
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
