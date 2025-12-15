import { runWithEndpointContext } from "@better-auth/core/context";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuthClient } from "better-auth/client";
import { setCookieToHeader } from "better-auth/cookies";
import { bearer } from "better-auth/plugins";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { paystack } from ".";
import { paystackClient } from "./client";
import { createHmac } from "node:crypto";
describe("paystack type", () => {
    it("should api endpoint exist", () => {
        expectTypeOf().toBeFunction();
    });
});
describe("paystack", () => {
    const data = {
        user: [],
        session: [],
        verification: [],
        account: [],
        subscription: [],
    };
    const memory = memoryAdapter(data);
    beforeEach(() => {
        data.user = [];
        data.session = [];
        data.verification = [];
        data.account = [];
        data.subscription = [];
        vi.clearAllMocks();
    });
    it("should reject invalid webhook signature", async () => {
        const options = {
            paystackClient: {},
            paystackWebhookSecret: "whsec_test",
        };
        const auth = betterAuth({
            baseURL: "http://localhost:3000",
            database: memory,
            emailAndPassword: { enabled: true },
            plugins: [paystack(options)],
        });
        const payload = JSON.stringify({ event: "charge.success", data: {} });
        const req = new Request("http://localhost:3000/api/auth/paystack/webhook", {
            method: "POST",
            headers: {
                "x-paystack-signature": "bad",
            },
            body: payload,
        });
        const res = await auth.handler(req);
        expect(res.status).toBe(401);
    });
    it("should accept valid webhook signature", async () => {
        const options = {
            paystackClient: {},
            paystackWebhookSecret: "whsec_test",
        };
        const auth = betterAuth({
            baseURL: "http://localhost:3000",
            database: memory,
            emailAndPassword: { enabled: true },
            plugins: [paystack(options)],
        });
        const payload = JSON.stringify({ event: "charge.success", data: {} });
        const signature = createHmac("sha512", options.paystackWebhookSecret)
            .update(payload)
            .digest("hex");
        const req = new Request("http://localhost:3000/api/auth/paystack/webhook", {
            method: "POST",
            headers: {
                "x-paystack-signature": signature,
            },
            body: payload,
        });
        const res = await auth.handler(req);
        expect(res.status).toBe(200);
    });
    it("should create Paystack customer on sign up", async () => {
        const paystackSdk = {
            customer: {
                create: vi.fn().mockResolvedValue({
                    data: {
                        customer_code: "CUS_test_123",
                    },
                }),
            },
        };
        const options = {
            paystackClient: paystackSdk,
            paystackWebhookSecret: "whsec_test",
            createCustomerOnSignUp: true,
        };
        const auth = betterAuth({
            database: memory,
            baseURL: "http://localhost:3000",
            emailAndPassword: { enabled: true },
            plugins: [paystack(options)],
        });
        const ctx = await auth.$context;
        const authClient = createAuthClient({
            baseURL: "http://localhost:3000",
            plugins: [bearer(), paystackClient({ subscription: false })],
            fetchOptions: {
                customFetchImpl: async (url, init) => auth.handler(new Request(url, init)),
            },
        });
        const testUser = {
            email: "test@email.com",
            password: "password",
            name: "Test User",
        };
        const res = await authClient.signUp.email(testUser, { throw: true });
        expect(res.user.id).toBeDefined();
        expect(paystackSdk.customer.create).toHaveBeenCalledTimes(1);
        const dbUser = await ctx.adapter.findOne({
            model: "user",
            where: [{ field: "id", value: res.user.id }],
        });
        expect(dbUser?.paystackCustomerCode).toBe("CUS_test_123");
    });
});
