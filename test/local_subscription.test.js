import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuthClient } from "better-auth/client";
import { setCookieToHeader } from "better-auth/cookies";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { paystack } from "../src/index";
import { paystackClient } from "../src/client";
describe("Local Custom Subscriptions", () => {
    const paystackSdk = {
        transaction_verify: vi.fn(),
        transaction_chargeAuthorization: vi.fn(),
        subscription_fetch: vi.fn(),
        subscription_disable: vi.fn(),
    };
    const options = {
        paystackClient: paystackSdk,
        paystackWebhookSecret: "whsec_test",
        subscription: {
            enabled: true,
            plans: [
                {
                    name: "local-starter",
                    amount: 500000, // 5000 NGN
                    interval: "monthly",
                    // No planCode makes it a local plan
                },
                {
                    name: "native-starter",
                    amount: 500000,
                    interval: "monthly",
                    planCode: "PLN_native_123"
                }
            ],
        },
    };
    const data = {
        user: [],
        session: [],
        subscription: [],
        paystackTransaction: [],
        verification: [],
        account: [],
    };
    const memory = memoryAdapter(data);
    const auth = betterAuth({
        database: memory,
        baseURL: "http://localhost:3000",
        emailAndPassword: { enabled: true },
        plugins: [paystack(options)],
    });
    const authClient = createAuthClient({
        baseURL: "http://localhost:3000",
        plugins: [paystackClient({ subscription: true })],
        fetchOptions: {
            customFetchImpl: async (url, init) => auth.handler(new Request(url, init)),
        },
    });
    beforeEach(() => {
        data.user = [];
        data.session = [];
        data.subscription = [];
        data.paystackTransaction = [];
        vi.clearAllMocks();
    });
    it("should capture authorization_code and generate LOC_ code for local plans in verifyTransaction", async () => {
        const testUser = { email: "local@test.com", password: "password", name: "Local User" };
        const signUp = await authClient.signUp.email(testUser, { throw: true });
        const headers = new Headers();
        await authClient.signIn.email(testUser, { throw: true, onSuccess: setCookieToHeader(headers) });
        // Mock transaction verify response
        paystackSdk.transaction_verify.mockResolvedValue({
            data: {
                status: true,
                data: {
                    status: "success",
                    reference: "ref_local_123",
                    amount: 500000,
                    authorization: {
                        authorization_code: "AUTH_local_token_123",
                        email: "local@test.com",
                    },
                    customer: { email: "local@test.com" },
                    metadata: {
                        plan: "local-starter",
                        referenceId: signUp.user.id,
                    },
                },
            },
        });
        // Create a pending transaction record
        const ctx = await auth.$context;
        await ctx.adapter.create({
            model: "paystackTransaction",
            data: {
                reference: "ref_local_123",
                userId: signUp.user.id,
                referenceId: signUp.user.id,
                amount: 500000,
                currency: "NGN",
                status: "pending",
                plan: "local-starter",
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
        // Also create an incomplete subscription record
        const subRecord = await ctx.adapter.create({
            model: "subscription",
            data: {
                plan: "local-starter",
                referenceId: signUp.user.id,
                status: "incomplete",
                paystackTransactionReference: "ref_local_123",
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
        await authClient.paystack.verifyTransaction({ reference: "ref_local_123" }, { headers });
        const sub = data.subscription.find(s => s.id === subRecord.id);
        expect(sub.status).toBe("active");
        expect(sub.paystackAuthorizationCode).toBe("AUTH_local_token_123");
        expect(sub.paystackSubscriptionCode).toBe("LOC_ref_local_123");
    });
    it("should process recurring charge successfully", async () => {
        const testUser = { email: "recurring@test.com", password: "password", name: "Recurring User" };
        const signUp = await authClient.signUp.email(testUser, { throw: true });
        const userId = signUp.user.id;
        const ctx = await auth.$context;
        const sub = await ctx.adapter.create({
            model: "subscription",
            data: {
                plan: "local-starter",
                referenceId: userId,
                status: "active",
                paystackAuthorizationCode: "AUTH_stored_123",
                periodEnd: new Date(Date.now() - 1000), // expired
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
        paystackSdk.transaction_chargeAuthorization.mockResolvedValue({
            data: {
                status: true,
                data: {
                    status: "success",
                    reference: "ref_recurring_456",
                },
            },
        });
        const res = await auth.handler(new Request("http://localhost:3000/api/auth/paystack/charge-recurring", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscriptionId: sub.id }),
        }));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.status).toBe("success");
        const updatedSub = data.subscription.find(s => s.id === sub.id);
        expect(updatedSub.paystackTransactionReference).toBe("ref_recurring_456");
        expect(new Date(updatedSub.periodEnd).getTime()).toBeGreaterThan(Date.now());
    });
    it("should reject recurring charge if amount is below minimum", async () => {
        const testUser = { email: "below-min@test.com", password: "password", name: "Min User" };
        const signUp = await authClient.signUp.email(testUser, { throw: true });
        const ctx = await auth.$context;
        const sub = await ctx.adapter.create({
            model: "subscription",
            data: {
                plan: "local-starter",
                referenceId: signUp.user.id,
                status: "active",
                paystackAuthorizationCode: "AUTH_min_123",
                periodEnd: new Date(Date.now() - 1000),
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
        // Local starter is 500000 kobo (5000 NGN). 
        // Let's try to charge 1000 kobo (10 NGN) which is below 5000 kobo (50 NGN) minimum.
        // Note: The plan defined in options has amount: 500000.
        // Our charge-recurring uses the plan's amount.
        // To test this effectively, we'd need a plan with a very low amount in its definition.
        const res = await auth.handler(new Request("http://localhost:3000/api/auth/paystack/charge-recurring", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscriptionId: sub.id, amount: 1000 }), // Override amount to be below min
        }));
        expect(res.status).toBe(400); // BAD_REQUEST
        const json = await res.json();
        expect(json.message).toContain("below minimum");
    });
    it("should handle trials for local subscriptions", async () => {
        const testUser = { email: "local-trial@test.com", password: "password", name: "Trial User" };
        const signUp = await authClient.signUp.email(testUser, { throw: true });
        const headers = new Headers();
        await authClient.signIn.email(testUser, { throw: true, onSuccess: setCookieToHeader(headers) });
        const trialEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        paystackSdk.transaction_verify.mockResolvedValue({
            data: {
                status: true,
                data: {
                    status: "success",
                    reference: "ref_local_trial_123",
                    amount: 0, // 0 for trial initialization in some flows
                    customer: { email: "local-trial@test.com" },
                    metadata: {
                        plan: "local-starter",
                        referenceId: signUp.user.id,
                        isTrial: true,
                        trialEnd: trialEndDate,
                    },
                },
            },
        });
        const ctx = await auth.$context;
        await ctx.adapter.create({
            model: "paystackTransaction",
            data: {
                reference: "ref_local_trial_123",
                userId: signUp.user.id,
                referenceId: signUp.user.id,
                amount: 0,
                currency: "NGN",
                status: "pending",
                plan: "local-starter",
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
        const subRecord = await ctx.adapter.create({
            model: "subscription",
            data: {
                plan: "local-starter",
                referenceId: signUp.user.id,
                status: "incomplete",
                paystackTransactionReference: "ref_local_trial_123",
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
        await authClient.paystack.verifyTransaction({ reference: "ref_local_trial_123" }, { headers });
        const sub = data.subscription.find(s => s.id === subRecord.id);
        expect(sub.status).toBe("trialing");
        expect(sub.paystackSubscriptionCode).toBe("LOC_ref_local_trial_123");
        expect(sub.trialStart).toBeDefined();
        expect(new Date(sub.trialEnd).toISOString()).toBe(trialEndDate);
        expect(new Date(sub.periodEnd).toISOString()).toBe(trialEndDate);
    });
    it("should handle local subscription cancellation without calling Paystack", async () => {
        const testUser = { email: "cancel-local@test.com", password: "password", name: "Cancel User" };
        const signUp = await authClient.signUp.email(testUser, { throw: true });
        const userId = signUp.user.id;
        const headers = new Headers();
        await authClient.signIn.email(testUser, {
            throw: true,
            onSuccess: setCookieToHeader(headers),
        });
        const ctx = await auth.$context;
        const subRecord = await ctx.adapter.create({
            model: "subscription",
            data: {
                plan: "local-starter",
                referenceId: userId,
                status: "active",
                paystackSubscriptionCode: "LOC_ref_999",
                paystackAuthorizationCode: "AUTH_cancel_999",
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
        await authClient.paystack.subscription.cancel({
            subscriptionCode: "LOC_ref_999",
        }, { headers });
        expect(paystackSdk.subscription_disable).not.toHaveBeenCalled();
        const updatedSub = data.subscription.find(s => s.id === subRecord.id);
        expect(updatedSub.status).toBe("active");
        expect(updatedSub.cancelAtPeriodEnd).toBe(true);
    });
});
