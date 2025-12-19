import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuthClient } from "better-auth/client";
import { bearer } from "better-auth/plugins";
import { setCookieToHeader } from "better-auth/cookies";
import { paystack } from "../src";
import { paystackClient } from "../src/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("examples/nextjs integration - paystack flow", () => {
    beforeEach(() => {
        process.env.PAYSTACK_SECRET_KEY = "sk_test_123";
        process.env.PAYSTACK_WEBHOOK_SECRET = "whsec_test";
    });

    it("should initialize and verify a transaction via the example auth instance", async () => {
        const data = {
            user: [],
            session: [],
            verification: [],
            account: [],
            subscription: [],
        };
        const memory = memoryAdapter(data);

        const paystackSdk = {
            transaction_initialize: vi.fn().mockResolvedValue({
                data: {
                    status: true,
                    message: "ok",
                    data: {
                        authorization_url: "https://paystack/checkout",
                        reference: "ref_123",
                        access_code: "acc_123",
                    },
                },
            }),
            transaction_verify: vi.fn().mockResolvedValue({
                data: {
                    status: true,
                    message: "ok",
                    data: {
                        status: "success",
                        reference: "ref_123",
                    },
                },
            }),
        };

        const auth = betterAuth({
            baseURL: "http://localhost:3000",
            trustedOrigins: ["http://localhost:3000"],
            database: memory,
            emailAndPassword: { enabled: true },
            plugins: [
                paystack<any>({
                    paystackClient: paystackSdk,
                    paystackWebhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET!,
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

        const ctx = await (auth as any).$context;

        const cookieHeaders = new Headers();

        const authClient = createAuthClient({
            baseURL: "http://localhost:3000",
            plugins: [bearer(), paystackClient({ subscription: true })],
            fetchOptions: {
                customFetchImpl: async (url, init) => {
                    const merged = new Headers(cookieHeaders);
                    const initHeaders = new Headers((init as any)?.headers ?? {});
                    for (const [k, v] of initHeaders.entries()) merged.set(k, v);
                    if (!merged.has("origin")) merged.set("origin", "http://localhost:3000");
                    return auth.handler(new Request(url, { ...(init ?? {}), headers: merged }));
                },
            },
        });

        // create user and sign in
        const user = { email: "user@example.com", password: "password", name: "Test" };
        const signUp = await authClient.signUp.email(user, { throw: true });
        expect(signUp.user.id).toBeDefined();

        await authClient.signIn.email(user, {
            throw: true,
            onSuccess: setCookieToHeader(cookieHeaders),
        });

        const init = await authClient.paystack.transaction.initialize(
            { plan: "starter" },
            { throw: true },
        );
        expect(init.url).toBe("https://paystack/checkout");
        const reference = init.reference;
        expect(reference).toBe("ref_123");

        const verify = await authClient.paystack.transaction.verify(
            { reference },
            { throw: true },
        );
        expect(verify.status).toBe("success");

        // check DB subscription updated to active
        const subscriptions = await ctx.adapter.findMany({ model: "subscription" });
        expect(subscriptions?.length).toBeGreaterThan(0);
        const sub = subscriptions?.find((s: any) => s.paystackTransactionReference === reference);
        expect(sub).toBeDefined();
        expect(sub.status).toBe("active");

        expect(paystackSdk.transaction_initialize).toHaveBeenCalledTimes(1);
        expect(paystackSdk.transaction_verify).toHaveBeenCalledTimes(1);
    });
});
