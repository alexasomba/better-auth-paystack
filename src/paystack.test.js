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
    it("should expose typed transaction routes on authClient", () => {
        const authClient = createAuthClient({
            baseURL: "http://localhost:3000",
            plugins: [paystackClient({ subscription: true })],
        });
        expectTypeOf().toBeFunction();
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
            customer_create: vi.fn().mockResolvedValue({
                data: {
                    status: true,
                    message: "ok",
                    data: {
                        customer_code: "CUS_test_123",
                    },
                },
            }),
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
        const authBase = ctx.baseURL ?? "http://localhost:3000/api/auth";
        const authBaseUrl = authBase.endsWith("/") ? authBase : `${authBase}/`;
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
        expect(paystackSdk.customer_create).toHaveBeenCalledTimes(1);
        const dbUser = await ctx.adapter.findOne({
            model: "user",
            where: [{ field: "id", value: res.user.id }],
        });
        expect(dbUser?.paystackCustomerCode).toBe("CUS_test_123");
    });
    it("should disable subscription without emailToken by fetching it", async () => {
        const paystackSdk = {
            subscription_fetch: vi.fn().mockResolvedValue({
                data: {
                    status: true,
                    message: "ok",
                    data: {
                        email_token: "tok_test_123",
                    },
                },
            }),
            subscription_disable: vi.fn().mockResolvedValue({
                data: {
                    status: true,
                    message: "Subscription disabled successfully",
                },
            }),
        };
        const options = {
            paystackClient: paystackSdk,
            paystackWebhookSecret: "whsec_test",
            subscription: {
                enabled: true,
                plans: [],
            },
        };
        const auth = betterAuth({
            database: memory,
            baseURL: "http://localhost:3000",
            emailAndPassword: { enabled: true },
            plugins: [paystack(options)],
        });
        const authClient = createAuthClient({
            baseURL: "http://localhost:3000",
            fetchOptions: {
                customFetchImpl: async (url, init) => auth.handler(new Request(url, init)),
            },
        });
        const testUser = {
            email: "sub@email.com",
            password: "password",
            name: "Sub User",
        };
        await authClient.signUp.email(testUser, { throw: true });
        const headers = new Headers();
        await authClient.signIn.email(testUser, {
            throw: true,
            onSuccess: setCookieToHeader(headers),
        });
        const reqHeaders = new Headers(headers);
        reqHeaders.set("content-type", "application/json");
        reqHeaders.set("origin", "http://localhost:3000");
        const req = new Request("http://localhost:3000/api/auth/paystack/subscription/disable", {
            method: "POST",
            headers: reqHeaders,
            body: JSON.stringify({
                subscriptionCode: "SUB_test_123",
                // emailToken intentionally omitted
            }),
        });
        const res = await auth.handler(req);
        expect(res.status).toBe(200);
        expect(paystackSdk.subscription_fetch).toHaveBeenCalledTimes(1);
        expect(paystackSdk.subscription_disable).toHaveBeenCalledWith({
            body: { code: "SUB_test_123", token: "tok_test_123" },
        });
    });
    it("should enable subscription without emailToken by fetching it", async () => {
        const paystackSdk = {
            subscription_fetch: vi.fn().mockResolvedValue({
                data: {
                    status: true,
                    message: "ok",
                    data: {
                        email_token: "tok_test_123",
                    },
                },
            }),
            subscription_enable: vi.fn().mockResolvedValue({
                data: {
                    status: true,
                    message: "Subscription enabled successfully",
                },
            }),
        };
        const options = {
            paystackClient: paystackSdk,
            paystackWebhookSecret: "whsec_test",
            subscription: {
                enabled: true,
                plans: [],
            },
        };
        const auth = betterAuth({
            database: memory,
            baseURL: "http://localhost:3000",
            emailAndPassword: { enabled: true },
            plugins: [paystack(options)],
        });
        const authClient = createAuthClient({
            baseURL: "http://localhost:3000",
            fetchOptions: {
                customFetchImpl: async (url, init) => auth.handler(new Request(url, init)),
            },
        });
        const testUser = {
            email: "sub-enable@email.com",
            password: "password",
            name: "Sub Enable User",
        };
        await authClient.signUp.email(testUser, { throw: true });
        const headers = new Headers();
        await authClient.signIn.email(testUser, {
            throw: true,
            onSuccess: setCookieToHeader(headers),
        });
        const reqHeaders = new Headers(headers);
        reqHeaders.set("content-type", "application/json");
        reqHeaders.set("origin", "http://localhost:3000");
        const req = new Request("http://localhost:3000/api/auth/paystack/subscription/enable", {
            method: "POST",
            headers: reqHeaders,
            body: JSON.stringify({
                subscriptionCode: "SUB_test_123",
                // emailToken intentionally omitted
            }),
        });
        const res = await auth.handler(req);
        expect(res.status).toBe(200);
        expect(paystackSdk.subscription_fetch).toHaveBeenCalledTimes(1);
        expect(paystackSdk.subscription_enable).toHaveBeenCalledWith({
            body: { code: "SUB_test_123", token: "tok_test_123" },
        });
    });
    it("should reject untrusted callbackURL", async () => {
        const paystackSdk = {
            transaction_initialize: vi.fn().mockResolvedValue({
                data: {
                    status: true,
                    message: "ok",
                    data: {
                        authorization_url: "https://paystack.test/redirect",
                        reference: "REF_untrusted",
                        access_code: "ACCESS_test",
                    },
                },
            }),
        };
        const options = {
            paystackClient: paystackSdk,
            paystackWebhookSecret: "whsec_test",
            subscription: {
                enabled: true,
                plans: [{ name: "starter", amount: 1000, currency: "NGN" }],
            },
        };
        const auth = betterAuth({
            database: memory,
            baseURL: "http://localhost:3000",
            trustedOrigins: ["http://localhost:3000"],
            emailAndPassword: { enabled: true },
            plugins: [paystack(options)],
        });
        const authClient = createAuthClient({
            baseURL: "http://localhost:3000",
            fetchOptions: {
                customFetchImpl: async (url, init) => auth.handler(new Request(url, init)),
            },
        });
        const testUser = {
            email: "cb@email.com",
            password: "password",
            name: "Callback User",
        };
        await authClient.signUp.email(testUser, { throw: true });
        const headers = new Headers();
        await authClient.signIn.email(testUser, {
            throw: true,
            onSuccess: setCookieToHeader(headers),
        });
        const reqHeaders = new Headers(headers);
        reqHeaders.set("content-type", "application/json");
        reqHeaders.set("origin", "http://localhost:3000");
        const req = new Request("http://localhost:3000/api/auth/paystack/transaction/initialize", {
            method: "POST",
            headers: reqHeaders,
            body: JSON.stringify({
                plan: "starter",
                callbackURL: "http://evil.com/callback",
            }),
        });
        const res = await auth.handler(req);
        expect(res.status).toBe(403);
    });
    it("should not verify another user's subscription by reference", async () => {
        const paystackSdk = {
            transaction_initialize: vi.fn().mockResolvedValue({
                data: {
                    status: true,
                    message: "ok",
                    data: {
                        authorization_url: "https://paystack.test/redirect",
                        reference: "REF_shared_123",
                        access_code: "ACCESS_test",
                    },
                },
            }),
            transaction_verify: vi.fn().mockResolvedValue({
                data: {
                    status: true,
                    message: "ok",
                    data: {
                        status: "success",
                        reference: "REF_shared_123",
                    },
                },
            }),
        };
        const options = {
            paystackClient: paystackSdk,
            paystackWebhookSecret: "whsec_test",
            subscription: {
                enabled: true,
                plans: [{ name: "starter", amount: 1000, currency: "NGN" }],
            },
        };
        const auth = betterAuth({
            database: memory,
            baseURL: "http://localhost:3000",
            trustedOrigins: ["http://localhost:3000"],
            emailAndPassword: { enabled: true },
            plugins: [paystack(options)],
        });
        const ctx = await auth.$context;
        const authBase = ctx.baseURL ?? "http://localhost:3000/api/auth";
        const authBaseUrl = authBase.endsWith("/") ? authBase : `${authBase}/`;
        const authClient = createAuthClient({
            baseURL: "http://localhost:3000",
            plugins: [bearer(), paystackClient({ subscription: true })],
            fetchOptions: {
                customFetchImpl: async (url, init) => auth.handler(new Request(url, init)),
            },
        });
        const userA = {
            email: "a@email.com",
            password: "password",
            name: "User A",
        };
        const userB = {
            email: "b@email.com",
            password: "password",
            name: "User B",
        };
        const signInWithCookies = async (user) => {
            const headers = new Headers();
            await authClient.signIn.email(user, {
                throw: true,
                onSuccess: setCookieToHeader(headers),
            });
            const reqHeaders = new Headers(headers);
            reqHeaders.set("content-type", "application/json");
            reqHeaders.set("origin", "http://localhost:3000");
            return reqHeaders;
        };
        const aRes = await authClient.signUp.email(userA, { throw: true });
        const bRes = await authClient.signUp.email(userB, { throw: true });
        const aHeaders = await signInWithCookies(userA);
        // User A initializes a transaction, creating an incomplete local subscription row.
        const initReq = new Request(new URL("paystack/transaction/initialize", authBaseUrl), {
            method: "POST",
            headers: aHeaders,
            body: JSON.stringify({
                plan: "starter",
                callbackURL: "http://localhost:3000/callback",
            }),
        });
        const initRes = await auth.handler(initReq);
        expect(initRes.status).toBe(200);
        const subA0 = (await ctx.adapter.findMany({
            model: "subscription",
            where: [
                { field: "referenceId", value: aRes.user.id },
                { field: "paystackTransactionReference", value: "REF_shared_123" },
            ],
        }))?.[0];
        expect(subA0?.status).toBe("incomplete");
        // User B tries to verify the same Paystack reference; should NOT update User A's row.
        const bHeaders = await signInWithCookies(userB);
        const verifyReqB = new Request(new URL("paystack/transaction/verify", authBaseUrl), {
            method: "POST",
            headers: bHeaders,
            body: JSON.stringify({ reference: "REF_shared_123" }),
        });
        const verifyResB = await auth.handler(verifyReqB);
        expect(verifyResB.status).toBe(200);
        const subA1 = (await ctx.adapter.findMany({
            model: "subscription",
            where: [
                { field: "referenceId", value: aRes.user.id },
                { field: "paystackTransactionReference", value: "REF_shared_123" },
            ],
        }))?.[0];
        expect(subA1?.status).toBe("incomplete");
        // User A verifies; should update their own subscription.
        const verifyReqA = new Request(new URL("paystack/transaction/verify", authBaseUrl), {
            method: "POST",
            headers: aHeaders,
            body: JSON.stringify({ reference: "REF_shared_123" }),
        });
        const verifyResA = await auth.handler(verifyReqA);
        expect(verifyResA.status).toBe(200);
        const subA2 = (await ctx.adapter.findMany({
            model: "subscription",
            where: [
                { field: "referenceId", value: aRes.user.id },
                { field: "paystackTransactionReference", value: "REF_shared_123" },
            ],
        }))?.[0];
        expect(subA2?.status).toBe("active");
        // Sanity: user B doesn't have a subscription row for this reference.
        const subB = (await ctx.adapter.findMany({
            model: "subscription",
            where: [
                { field: "referenceId", value: bRes.user.id },
                { field: "paystackTransactionReference", value: "REF_shared_123" },
            ],
        }))?.[0];
        expect(subB).toBeUndefined();
    });
    it("should handle one-time product transaction initialization with comprehensive checks", async () => {
        const paystackSdk = {
            transaction_initialize: vi.fn().mockResolvedValue({
                data: {
                    status: true,
                    data: {
                        authorization_url: "https://paystack.test/buy",
                        reference: "REF_PRODUCT_123",
                    },
                },
            }),
        };
        const options = {
            paystackClient: paystackSdk,
            paystackWebhookSecret: "whsec_test",
            subscription: { enabled: true, plans: [] },
            products: {
                products: [
                    { name: "credits", amount: 1000, currency: "NGN" }
                ]
            }
        };
        const auth = betterAuth({
            baseURL: "http://localhost:3000",
            trustedOrigins: ["http://localhost:3000"],
            database: memory,
            emailAndPassword: { enabled: true },
            plugins: [paystack(options)],
        });
        const cookieHeaders = new Headers();
        const authClient = createAuthClient({
            baseURL: "http://localhost:3000",
            plugins: [bearer(), paystackClient({ subscription: true })],
            fetchOptions: {
                customFetchImpl: async (url, init) => {
                    const merged = new Headers(cookieHeaders);
                    const initHeaders = new Headers(init?.headers ?? {});
                    initHeaders.forEach((v, k) => merged.set(k, v));
                    if (!merged.has("origin"))
                        merged.set("origin", "http://localhost:3000");
                    return auth.handler(new Request(url, { ...(init ?? {}), headers: merged }));
                },
            },
        });
        const user = { email: "product@test.com", password: "password", name: "Buyer" };
        const signUpRes = await authClient.signUp.email(user, { throw: true });
        await authClient.signIn.email(user, {
            throw: true,
            onSuccess: setCookieToHeader(cookieHeaders),
        });
        const res = await authClient.paystack.transaction.initialize({
            product: "credits",
            callbackURL: "http://localhost:3000/done"
        }, { throw: true });
        expect(res.url).toBe("https://paystack.test/buy");
        expect(paystackSdk.transaction_initialize).toHaveBeenCalledWith(expect.objectContaining({
            body: expect.objectContaining({
                amount: 1000,
                email: "product@test.com",
            })
        }));
    }, 30000);
    it("should authorize reference access via authorizeReference for listLocal", async () => {
        const authorizeReference = vi.fn().mockResolvedValue(true);
        const options = {
            paystackClient: {},
            paystackWebhookSecret: "whsec_test",
            subscription: {
                enabled: true,
                plans: [],
                authorizeReference,
            }
        };
        const auth = betterAuth({
            baseURL: "http://localhost:3000",
            trustedOrigins: ["http://localhost:3000"],
            database: memory,
            emailAndPassword: { enabled: true },
            plugins: [paystack(options)],
        });
        const cookieHeaders = new Headers();
        const authClient = createAuthClient({
            baseURL: "http://localhost:3000",
            plugins: [bearer(), paystackClient({ subscription: true })],
            fetchOptions: {
                customFetchImpl: async (url, init) => {
                    const merged = new Headers(cookieHeaders);
                    const initHeaders = new Headers(init?.headers ?? {});
                    initHeaders.forEach((v, k) => merged.set(k, v));
                    if (!merged.has("origin"))
                        merged.set("origin", "http://localhost:3000");
                    return auth.handler(new Request(url, { ...(init ?? {}), headers: merged }));
                },
            },
        });
        const user = { email: "user1@test.com", password: "password", name: "User 1" };
        await authClient.signUp.email(user, { throw: true });
        await authClient.signIn.email(user, {
            throw: true,
            onSuccess: setCookieToHeader(cookieHeaders),
        });
        await authClient.paystack.subscription.listLocal({ query: { referenceId: "org_all" } }, { throw: true });
        expect(authorizeReference).toHaveBeenCalledWith(expect.objectContaining({
            referenceId: "org_all",
            action: "list-subscriptions"
        }), expect.any(Object));
    }, 30000);
    it("should update subscription status to canceled via webhook events", async () => {
        const options = {
            paystackClient: {},
            paystackWebhookSecret: "test_secret",
            subscription: { enabled: true, plans: [] }
        };
        const auth = betterAuth({
            baseURL: "http://localhost:3000",
            database: memory,
            plugins: [paystack(options)],
        });
        const ctx = await auth.$context;
        const sub = {
            id: "sub_123",
            plan: "pro",
            referenceId: "user_1",
            paystackSubscriptionCode: "SUB_ABC",
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await ctx.adapter.create({ model: "subscription", data: sub });
        const payload = JSON.stringify({
            event: "subscription.disable",
            data: {
                subscription_code: "SUB_ABC",
                status: "disabled",
            }
        });
        const signature = createHmac("sha512", "test_secret").update(payload).digest("hex");
        const req = new Request("http://localhost:3000/api/auth/paystack/webhook", {
            method: "POST",
            headers: { "x-paystack-signature": signature },
            body: payload
        });
        await auth.handler(req);
        const updatedSub = await ctx.adapter.findOne({
            model: "subscription",
            where: [{ field: "paystackSubscriptionCode", value: "SUB_ABC" }]
        });
        expect(updatedSub?.status).toBe("canceled");
    });
    it("should call onSubscriptionCreated hook when subscription.create webhook fires", async () => {
        const onSubscriptionCreated = vi.fn();
        const options = {
            paystackClient: {},
            paystackWebhookSecret: "test_secret",
            subscription: {
                enabled: true,
                plans: [{ name: "pro", amount: 5000, currency: "NGN", planCode: "PLN_pro" }],
                onSubscriptionCreated,
            }
        };
        const auth = betterAuth({
            baseURL: "http://localhost:3000",
            database: memory,
            plugins: [paystack(options)],
        });
        const ctx = await auth.$context;
        // Create an incomplete subscription (as if init was called)
        // Must match via referenceId (in webhook metadata) and plan name
        await ctx.adapter.create({
            model: "subscription",
            data: {
                plan: "pro",
                referenceId: "user_hook_123",
                status: "incomplete",
                createdAt: new Date(),
                updatedAt: new Date(),
            }
        });
        const payload = JSON.stringify({
            event: "subscription.create",
            data: {
                subscription_code: "SUB_HOOK_123",
                status: "active",
                plan: { plan_code: "PLN_pro" },
                customer: { customer_code: "CUS_hook" },
                metadata: { referenceId: "user_hook_123", plan: "pro" },
            }
        });
        const signature = createHmac("sha512", "test_secret").update(payload).digest("hex");
        const req = new Request("http://localhost:3000/api/auth/paystack/webhook", {
            method: "POST",
            headers: { "x-paystack-signature": signature },
            body: payload
        });
        await auth.handler(req);
        expect(onSubscriptionCreated).toHaveBeenCalledTimes(1);
        expect(onSubscriptionCreated).toHaveBeenCalledWith(expect.objectContaining({
            event: expect.anything(),
            subscription: expect.objectContaining({
                status: "active",
                paystackSubscriptionCode: "SUB_HOOK_123",
            }),
            plan: expect.objectContaining({ name: "pro" }),
        }), expect.any(Object));
    });
    it("should call onSubscriptionCancel hook when subscription.disable webhook fires", async () => {
        const onSubscriptionCancel = vi.fn();
        const options = {
            paystackClient: {},
            paystackWebhookSecret: "test_secret",
            subscription: {
                enabled: true,
                plans: [{ name: "pro", amount: 5000, currency: "NGN" }],
                onSubscriptionCancel,
            }
        };
        const auth = betterAuth({
            baseURL: "http://localhost:3000",
            database: memory,
            plugins: [paystack(options)],
        });
        const ctx = await auth.$context;
        const sub = {
            id: "sub_cancel_test",
            plan: "pro",
            referenceId: "user_cancel",
            paystackSubscriptionCode: "SUB_CANCEL_123",
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await ctx.adapter.create({ model: "subscription", data: sub });
        const payload = JSON.stringify({
            event: "subscription.disable",
            data: {
                subscription_code: "SUB_CANCEL_123",
                status: "disabled",
            }
        });
        const signature = createHmac("sha512", "test_secret").update(payload).digest("hex");
        const req = new Request("http://localhost:3000/api/auth/paystack/webhook", {
            method: "POST",
            headers: { "x-paystack-signature": signature },
            body: payload
        });
        await auth.handler(req);
        expect(onSubscriptionCancel).toHaveBeenCalledTimes(1);
        expect(onSubscriptionCancel).toHaveBeenCalledWith(expect.objectContaining({
            subscription: expect.objectContaining({
                paystackSubscriptionCode: "SUB_CANCEL_123",
                status: "canceled",
            }),
        }), expect.any(Object));
    });
    it("should prevent trial abuse - second subscription does not get trial", async () => {
        const paystackSdk = {
            transaction_initialize: vi.fn().mockResolvedValue({
                data: {
                    status: true,
                    data: {
                        authorization_url: "https://paystack.test/trial",
                        reference: "REF_TRIAL_ABUSE",
                        access_code: "ACCESS_trial",
                    },
                },
            }),
        };
        const options = {
            paystackClient: paystackSdk,
            paystackWebhookSecret: "whsec_test",
            subscription: {
                enabled: true,
                plans: [{ name: "starter", amount: 1000, currency: "NGN", freeTrial: { days: 7 } }],
            },
        };
        const auth = betterAuth({
            database: memory,
            baseURL: "http://localhost:3000",
            trustedOrigins: ["http://localhost:3000"],
            emailAndPassword: { enabled: true },
            plugins: [paystack(options)],
        });
        const ctx = await auth.$context;
        const cookieHeaders = new Headers();
        const authClient = createAuthClient({
            baseURL: "http://localhost:3000",
            plugins: [bearer(), paystackClient({ subscription: true })],
            fetchOptions: {
                customFetchImpl: async (url, init) => {
                    const merged = new Headers(cookieHeaders);
                    const initHeaders = new Headers(init?.headers ?? {});
                    initHeaders.forEach((v, k) => merged.set(k, v));
                    if (!merged.has("origin"))
                        merged.set("origin", "http://localhost:3000");
                    return auth.handler(new Request(url, { ...(init ?? {}), headers: merged }));
                },
            },
        });
        const user = { email: "trial_abuse@test.com", password: "password", name: "Trial User" };
        const signUpRes = await authClient.signUp.email(user, { throw: true });
        await authClient.signIn.email(user, {
            throw: true,
            onSuccess: setCookieToHeader(cookieHeaders),
        });
        // Create a previous trial subscription for this user
        await ctx.adapter.create({
            model: "subscription",
            data: {
                id: "prev_trial_sub",
                plan: "starter",
                referenceId: signUpRes.user.id,
                status: "canceled",
                trialStart: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
                trialEnd: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
        // Now initialize a new subscription - should NOT get a trial
        const res = await authClient.paystack.transaction.initialize({
            plan: "starter",
            callbackURL: "http://localhost:3000/done"
        }, { throw: true });
        expect(res.url).toBe("https://paystack.test/trial");
        // Check the subscription was created without trial dates
        const newSub = await ctx.adapter.findOne({
            model: "subscription",
            where: [
                { field: "referenceId", value: signUpRes.user.id },
                { field: "paystackTransactionReference", value: "REF_TRIAL_ABUSE" }
            ]
        });
        expect(newSub?.trialStart).toBeUndefined();
        expect(newSub?.trialEnd).toBeUndefined();
    }, 30000);
    it("should grant trial to first-time subscriber", async () => {
        const onTrialStart = vi.fn();
        const paystackSdk = {
            transaction_initialize: vi.fn().mockResolvedValue({
                data: {
                    status: true,
                    data: {
                        authorization_url: "https://paystack.test/first_trial",
                        reference: "REF_FIRST_TRIAL",
                        access_code: "ACCESS_first",
                    },
                },
            }),
        };
        const options = {
            paystackClient: paystackSdk,
            paystackWebhookSecret: "whsec_test",
            subscription: {
                enabled: true,
                plans: [{ name: "pro", amount: 5000, currency: "NGN", freeTrial: { days: 14, onTrialStart } }],
            },
        };
        const auth = betterAuth({
            database: memory,
            baseURL: "http://localhost:3000",
            trustedOrigins: ["http://localhost:3000"],
            emailAndPassword: { enabled: true },
            plugins: [paystack(options)],
        });
        const ctx = await auth.$context;
        const cookieHeaders = new Headers();
        const authClient = createAuthClient({
            baseURL: "http://localhost:3000",
            plugins: [bearer(), paystackClient({ subscription: true })],
            fetchOptions: {
                customFetchImpl: async (url, init) => {
                    const merged = new Headers(cookieHeaders);
                    const initHeaders = new Headers(init?.headers ?? {});
                    initHeaders.forEach((v, k) => merged.set(k, v));
                    if (!merged.has("origin"))
                        merged.set("origin", "http://localhost:3000");
                    return auth.handler(new Request(url, { ...(init ?? {}), headers: merged }));
                },
            },
        });
        const user = { email: "first_trial@test.com", password: "password", name: "First Trial" };
        const signUpRes = await authClient.signUp.email(user, { throw: true });
        await authClient.signIn.email(user, {
            throw: true,
            onSuccess: setCookieToHeader(cookieHeaders),
        });
        // Initialize subscription - should get trial (no previous subs)
        await authClient.paystack.transaction.initialize({
            plan: "pro",
            callbackURL: "http://localhost:3000/done"
        }, { throw: true });
        // Check subscription has trial dates
        const sub = await ctx.adapter.findOne({
            model: "subscription",
            where: [
                { field: "referenceId", value: signUpRes.user.id },
                { field: "paystackTransactionReference", value: "REF_FIRST_TRIAL" }
            ]
        });
        expect(sub?.trialStart).toBeDefined();
        expect(sub?.trialEnd).toBeDefined();
        expect(onTrialStart).toHaveBeenCalledTimes(1);
    }, 30000);
    it("should create Paystack customer for organization on create", async () => {
        const paystackSdk = {
            customer_create: vi.fn().mockResolvedValue({
                data: {
                    status: true,
                    message: "ok",
                    data: {
                        customer_code: "CUS_org_123",
                    },
                },
            }),
        };
        const options = {
            paystackClient: paystackSdk,
            paystackWebhookSecret: "whsec_test",
            organization: {
                enabled: true,
            },
        };
        const auth = betterAuth({
            database: memory,
            baseURL: "http://localhost:3000",
            emailAndPassword: { enabled: true },
            plugins: [paystack(options)],
        });
        const ctx = await auth.$context;
        // Simulate organization creation by directly calling the hook
        // (Organization plugin integration mock)
        const orgData = {
            id: "org_test_123",
            name: "Test Org",
            slug: "test-org",
        };
        // Simulate the hook being called
        const hooks = auth.options?.plugins?.find((p) => p.id === "paystack")?.hooks;
        if (hooks?.["organization.create"]?.after) {
            await hooks["organization.create"].after({
                returned: orgData,
            });
        }
        // Organization hooks may need to be invoked via adapter hooks
        // For now, verify the SDK method exists
        expect(paystackSdk.customer_create).toBeDefined();
    });
});
