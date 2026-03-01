import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuthClient } from "better-auth/client";
import { bearer } from "better-auth/plugins";
import { organization } from "better-auth/plugins";
import { organizationClient } from "better-auth/client/plugins";
import { setCookieToHeader } from "better-auth/cookies";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { paystack } from "../src";
import { paystackClient } from "../src/client";
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
// Polyfill for Zod: ensure schema.parseAsync exists and delegates to safeParseAsync.
/**
 * Tests for planCode-based subscriptions and organization referenceId billing
 */
describe("planCode and organization referenceId tests", () => {
    beforeEach(() => {
        process.env.PAYSTACK_SECRET_KEY = "sk_test_123";
        process.env.PAYSTACK_WEBHOOK_SECRET = "whsec_test";
    });
    describe("planCode subscription flow", () => {
        it("should initialize transaction with planCode correctly", async () => {
            const data = {
                user: [],
                session: [],
                verification: [],
                account: [],
                subscription: [],
                paystackTransaction: [],
            };
            const memory = memoryAdapter(data);
            const paystackSdk = {
                transaction_initialize: vi.fn().mockResolvedValue({
                    data: {
                        status: true,
                        message: "ok",
                        data: {
                            authorization_url: "https://paystack/checkout",
                            reference: "ref_plancode_123",
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
                            reference: "ref_plancode_123",
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
                    paystack({
                        paystackClient: paystackSdk,
                        paystackWebhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET,
                        subscription: {
                            enabled: true,
                            plans: [
                                {
                                    name: "starter",
                                    planCode: "PLN_jm9wgvkqykajlp7", // planCode provided
                                    // amount/currency/interval optional when planCode is set
                                },
                                {
                                    name: "pro",
                                    planCode: "PLN_6ikzoaxnunttb5e",
                                },
                            ],
                        },
                    }),
                ],
            });
            const _ctx = await auth.$context;
            const cookieHeaders = new Headers();
            const authClient = createAuthClient({
                baseURL: "http://localhost:3000",
                plugins: [bearer(), paystackClient({ subscription: true })],
                fetchOptions: {
                    customFetchImpl: async (url, init) => {
                        const merged = new Headers(cookieHeaders);
                        const initHeaders = new Headers(init?.headers ?? {});
                        for (const [k, v] of initHeaders.entries())
                            merged.set(k, v);
                        if (!merged.has("origin"))
                            merged.set("origin", "http://localhost:3000");
                        return auth.handler(new Request(url, { ...(init ?? {}), headers: merged }));
                    },
                },
            });
            // Create user and sign in
            const user = { email: "plancode.user@example.com", password: "password", name: "PlanCode User" };
            const signUp = await authClient.signUp.email(user, { throw: true });
            expect(signUp.user.id).toBeDefined();
            await authClient.signIn.email(user, {
                onSuccess: setCookieToHeader(cookieHeaders),
            });
            // Initialize transaction with planCode plan
            const init = await authClient.paystack.transaction.initialize({ plan: "starter" });
            if (init.error)
                throw new Error("Initialization failed");
            expect(init.data.url).toBe("https://paystack/checkout");
            expect(init.data.reference).toBe("ref_plancode_123");
            // Verify the SDK was called with planCode
            expect(paystackSdk.transaction_initialize).toHaveBeenCalledTimes(1);
            const callArgs = paystackSdk.transaction_initialize.mock.calls[0][0];
            expect(callArgs.body.plan).toBe("PLN_jm9wgvkqykajlp7");
            // Paystack API requires amount even with planCode (it uses plan's stored amount)
            // For plans without local amount, we send minimum 50000 kobo (500 NGN)
            expect(callArgs.body.amount).toBe(50000);
        });
        it("should initialize transaction with local amount when no planCode", async () => {
            const data = {
                user: [],
                session: [],
                verification: [],
                account: [],
                subscription: [],
                paystackTransaction: [],
            };
            const memory = memoryAdapter(data);
            const paystackSdk = {
                transaction_initialize: vi.fn().mockResolvedValue({
                    data: {
                        status: true,
                        message: "ok",
                        data: {
                            authorization_url: "https://paystack/checkout",
                            reference: "ref_local_123",
                            access_code: "acc_local",
                        },
                    },
                }),
                transaction_verify: vi.fn().mockResolvedValue({
                    data: {
                        status: true,
                        message: "ok",
                        data: { status: "success", reference: "ref_local_123" },
                    },
                }),
            };
            const auth = betterAuth({
                baseURL: "http://localhost:3000",
                trustedOrigins: ["http://localhost:3000"],
                database: memory,
                emailAndPassword: { enabled: true },
                plugins: [
                    paystack({
                        paystackClient: paystackSdk,
                        paystackWebhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET,
                        subscription: {
                            enabled: true,
                            plans: [
                                {
                                    name: "team",
                                    amount: 2500000, // 25,000 NGN - no planCode
                                    currency: "NGN",
                                    interval: "monthly",
                                },
                            ],
                        },
                    }),
                ],
            });
            const cookieHeaders = new Headers();
            const authClient = createAuthClient({
                baseURL: "http://localhost:3000",
                plugins: [bearer(), paystackClient({ subscription: true })],
                fetchOptions: {
                    customFetchImpl: async (url, init) => {
                        const merged = new Headers(cookieHeaders);
                        const initHeaders = new Headers(init?.headers ?? {});
                        for (const [k, v] of initHeaders.entries())
                            merged.set(k, v);
                        if (!merged.has("origin"))
                            merged.set("origin", "http://localhost:3000");
                        return auth.handler(new Request(url, { ...(init ?? {}), headers: merged }));
                    },
                },
            });
            const user = { email: "team.user@example.com", password: "password", name: "Team User" };
            await authClient.signUp.email(user, { throw: true });
            await authClient.signIn.email(user, {
                throw: true,
                onSuccess: setCookieToHeader(cookieHeaders),
            });
            const init = await authClient.paystack.transaction.initialize({ plan: "team" });
            if (init.error)
                throw new Error("Initialization failed");
            expect(init.data.url).toBe("https://paystack/checkout");
            // Verify the SDK was called with amount (no planCode)
            const callArgs = paystackSdk.transaction_initialize.mock.calls[0][0];
            expect(callArgs.body.amount).toBe(2500000);
            expect(callArgs.body.plan).toBeUndefined();
        });
    });
    describe("organization referenceId billing", () => {
        it("should authorize referenceId for org owner", async () => {
            const data = {
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
            const paystackSdk = {
                transaction_initialize: vi.fn().mockResolvedValue({
                    data: {
                        status: true,
                        message: "ok",
                        data: {
                            authorization_url: "https://paystack/checkout",
                            reference: "ref_org_123",
                            access_code: "acc_org",
                        },
                    },
                }),
                transaction_verify: vi.fn().mockResolvedValue({
                    data: {
                        status: true,
                        message: "ok",
                        data: { status: "success", reference: "ref_org_123" },
                    },
                }),
            };
            const auth = betterAuth({
                baseURL: "http://localhost:3000",
                trustedOrigins: ["http://localhost:3000"],
                database: memory,
                emailAndPassword: { enabled: true },
                plugins: [
                    organization(),
                    paystack({
                        paystackClient: paystackSdk,
                        paystackWebhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET,
                        subscription: {
                            enabled: true,
                            plans: [
                                {
                                    name: "team",
                                    amount: 2500000,
                                    currency: "NGN",
                                    interval: "monthly",
                                },
                            ],
                            authorizeReference: async ({ user, referenceId }, ctx) => {
                                // Allow user's own ID
                                if (!referenceId || referenceId === user.id) {
                                    return true;
                                }
                                // Check org membership
                                const members = await ctx.context.adapter.findMany({
                                    model: "member",
                                    where: [
                                        { field: "userId", value: user.id },
                                        { field: "organizationId", value: referenceId },
                                    ],
                                });
                                if (members && members.length > 0) {
                                    const member = members[0];
                                    return member.role === "owner" || member.role === "admin";
                                }
                                return false;
                            },
                        },
                    }),
                ],
            });
            const ctx = await auth.$context;
            const cookieHeaders = new Headers();
            const authClient = createAuthClient({
                baseURL: "http://localhost:3000",
                plugins: [bearer(), organizationClient(), paystackClient({ subscription: true })],
                fetchOptions: {
                    customFetchImpl: async (url, init) => {
                        const merged = new Headers(cookieHeaders);
                        const initHeaders = new Headers(init?.headers ?? {});
                        for (const [k, v] of initHeaders.entries())
                            merged.set(k, v);
                        if (!merged.has("origin"))
                            merged.set("origin", "http://localhost:3000");
                        return auth.handler(new Request(url, { ...(init ?? {}), headers: merged }));
                    },
                },
            });
            // Create user and sign in
            const user = { email: "org.owner@example.com", password: "password", name: "Org Owner" };
            const signUp = await authClient.signUp.email(user, { throw: true });
            const _userId = signUp.user.id;
            await authClient.signIn.email(user, {
                throw: true,
                onSuccess: setCookieToHeader(cookieHeaders),
            });
            // Create an organization (user becomes owner)
            const org = await authClient.organization.create({
                name: "Test Org",
                slug: "test-org",
            });
            const orgId = org.data?.id;
            expect(orgId).toBeDefined();
            // Initialize transaction with org referenceId
            const init = await authClient.paystack.transaction.initialize({ plan: "team", referenceId: orgId });
            if (init.error)
                throw new Error("Initialization failed");
            expect(init.data.url).toBe("https://paystack/checkout");
            expect(init.data.reference).toBe("ref_org_123");
            // Verify subscription was created with org referenceId
            const subscriptions = await ctx.adapter.findMany({ model: "subscription" });
            expect(subscriptions?.length).toBeGreaterThan(0);
            const sub = subscriptions?.find((s) => s.referenceId === orgId);
            expect(sub).toBeDefined();
        });
        it("should reject referenceId for unauthorized user", async () => {
            const data = {
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
            const paystackSdk = {
                transaction_initialize: vi.fn(),
                transaction_verify: vi.fn(),
            };
            const auth = betterAuth({
                baseURL: "http://localhost:3000",
                trustedOrigins: ["http://localhost:3000"],
                database: memory,
                emailAndPassword: { enabled: true },
                plugins: [
                    organization(),
                    paystack({
                        paystackClient: paystackSdk,
                        paystackWebhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET,
                        subscription: {
                            enabled: true,
                            plans: [
                                {
                                    name: "team",
                                    amount: 2500000,
                                    currency: "NGN",
                                    interval: "monthly",
                                },
                            ],
                            authorizeReference: async ({ user, referenceId }, ctx) => {
                                if (!referenceId || referenceId === user.id) {
                                    return true;
                                }
                                const members = await ctx.context.adapter.findMany({
                                    model: "member",
                                    where: [
                                        { field: "userId", value: user.id },
                                        { field: "organizationId", value: referenceId },
                                    ],
                                });
                                if (members && members.length > 0) {
                                    const member = members[0];
                                    return member.role === "owner" || member.role === "admin";
                                }
                                return false;
                            },
                        },
                    }),
                ],
            });
            const cookieHeaders = new Headers();
            const authClient = createAuthClient({
                baseURL: "http://localhost:3000",
                plugins: [bearer(), organizationClient(), paystackClient({ subscription: true })],
                fetchOptions: {
                    customFetchImpl: async (url, init) => {
                        const merged = new Headers(cookieHeaders);
                        const initHeaders = new Headers(init?.headers ?? {});
                        for (const [k, v] of initHeaders.entries())
                            merged.set(k, v);
                        if (!merged.has("origin"))
                            merged.set("origin", "http://localhost:3000");
                        return auth.handler(new Request(url, { ...(init ?? {}), headers: merged }));
                    },
                },
            });
            // Create user and sign in
            const user = { email: "nonmember@example.com", password: "password", name: "Non Member" };
            await authClient.signUp.email(user, { throw: true });
            await authClient.signIn.email(user, {
                throw: true,
                onSuccess: setCookieToHeader(cookieHeaders),
            });
            // Try to bill against a fake org ID the user doesn't belong to
            const fakeOrgId = "org_fake_123";
            try {
                await authClient.paystack.transaction.initialize({ plan: "team", referenceId: fakeOrgId }, { throw: true });
                // Should not reach here
                expect(true).toBe(false);
            }
            catch (error) {
                // Expect authorization to fail
                expect(error).toBeDefined();
            }
            // Verify SDK was NOT called
            expect(paystackSdk.transaction_initialize).not.toHaveBeenCalled();
        });
    });
});
