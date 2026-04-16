/* oxlint-disable @typescript-eslint/strict-boolean-expressions */

import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuthClient } from "better-auth/client";
import { bearer } from "better-auth/plugins";
import { organization } from "better-auth/plugins";
import { organizationClient } from "better-auth/client/plugins";
import { setCookieToHeader } from "better-auth/cookies";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { paystack } from "../src";
import { paystackClient } from "../src/client";
import type { Member, Subscription } from "../src/types";

/* oxlint-disable @typescript-eslint/strict-boolean-expressions */

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
      const data: Record<string, any[]> = {
        user: [],
        session: [],
        verification: [],
        account: [],
        subscription: [],
        paystackTransaction: [],
      };
      const memory = memoryAdapter(data);

      const paystackSdk = {
        transaction: {
          initialize: vi.fn().mockResolvedValue({
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
          verify: vi.fn().mockResolvedValue({
            data: {
              status: true,
              message: "ok",
              data: {
                status: "success",
                reference: "ref_plancode_123",
              },
            },
          }),
        },
      } as any;

      const auth = betterAuth({
        baseURL: "http://localhost:3000",
        trustedOrigins: ["http://localhost:3000"],
        database: memory,
        emailAndPassword: { enabled: true },
        plugins: [
          paystack<any>({
            paystackClient: paystackSdk,
            secretKey: "sk_test_123",
            webhook: { secret: "whsec_test" },
            subscription: {
              enabled: true,
              plans: [
                {
                  name: "starter",
                  amount: 50000,
                  currency: "NGN",
                  interval: "monthly",
                  planCode: "PLN_jm9wgvkqykajlp7",
                  paystackId: "ID_starter",
                },
                {
                  name: "pro",
                  amount: 100000,
                  currency: "NGN",
                  interval: "monthly",
                  planCode: "PLN_6ikzoaxnunttb5e",
                  paystackId: "ID_pro",
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
            const initHeaders = new Headers((init as any)?.headers ?? {});
            for (const [k, v] of (initHeaders as any).entries()) merged.set(k, v);
            if (!merged.has("origin")) merged.set("origin", "http://localhost:3000");
            return auth.handler(new Request(url, { ...init, headers: merged }));
          },
        },
      });

      const user = {
        email: "plancode.user@example.com",
        password: "password",
        name: "PlanCode User",
      };
      await authClient.signUp.email(user, { throw: true });
      await authClient.signIn.email(user, {
        onSuccess: setCookieToHeader(cookieHeaders),
      });

      const init = await (authClient as any).paystack.transaction.initialize({ plan: "starter" });
      if (init.error) throw new Error("Initialization failed");
      expect(init.data.url).toBe("https://paystack/checkout");
      expect(init.data.reference).toBe("ref_plancode_123");

      expect(paystackSdk.transaction.initialize).toHaveBeenCalledTimes(1);
      const callArgs = paystackSdk.transaction.initialize.mock.calls[0][0];
      expect(callArgs.body.plan).toBe("PLN_jm9wgvkqykajlp7");
      expect(callArgs.body.amount).toBe(50000);
    });

    it("should initialize transaction with local amount when no planCode", async () => {
      const data: Record<string, any[]> = {
        user: [],
        session: [],
        verification: [],
        account: [],
        subscription: [],
        paystackTransaction: [],
      };
      const memory = memoryAdapter(data);

      const paystackSdk = {
        transaction: {
          initialize: vi.fn().mockResolvedValue({
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
          verify: vi.fn().mockResolvedValue({
            data: {
              status: true,
              message: "ok",
              data: { status: "success", reference: "ref_local_123" },
            },
          }),
        },
      } as any;

      const auth = betterAuth({
        baseURL: "http://localhost:3000",
        trustedOrigins: ["http://localhost:3000"],
        database: memory,
        emailAndPassword: { enabled: true },
        plugins: [
          paystack<any>({
            paystackClient: paystackSdk,
            secretKey: "sk_test_123",
            webhook: { secret: "whsec_test" },
            subscription: {
              enabled: true,
              plans: [
                {
                  name: "team",
                  amount: 2500000,
                  currency: "NGN",
                  interval: "monthly",
                  planCode: "PLN_team",
                  paystackId: "ID_team",
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
            const initHeaders = new Headers((init as any)?.headers ?? {});
            for (const [k, v] of (initHeaders as any).entries()) merged.set(k, v);
            if (!merged.has("origin")) merged.set("origin", "http://localhost:3000");
            return auth.handler(new Request(url, { ...init, headers: merged }));
          },
        },
      });

      const user = { email: "team.user@example.com", password: "password", name: "Team User" };
      await authClient.signUp.email(user, { throw: true });
      await authClient.signIn.email(user, {
        throw: true,
        onSuccess: setCookieToHeader(cookieHeaders),
      });

      const init = await (authClient as any).paystack.transaction.initialize({ plan: "team" });

      if (init.error) throw new Error("Initialization failed");
      expect(init.data.url).toBe("https://paystack/checkout");

      const callArgs = paystackSdk.transaction.initialize.mock.calls[0][0];
      expect(callArgs.body.amount).toBe(2500000);
      expect(callArgs.body.plan).toBeUndefined();
    });
  });

  describe("organization referenceId billing", () => {
    it("should authorize referenceId for org owner", async () => {
      const data: Record<string, any[]> = {
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
        transaction: {
          initialize: vi.fn().mockResolvedValue({
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
          verify: vi.fn().mockResolvedValue({
            data: {
              status: true,
              message: "ok",
              data: { status: "success", reference: "ref_org_123" },
            },
          }),
        },
      } as any;

      const auth = betterAuth({
        baseURL: "http://localhost:3000",
        trustedOrigins: ["http://localhost:3000"],
        database: memory,
        emailAndPassword: { enabled: true },
        plugins: [
          organization(),
          paystack<any>({
            paystackClient: paystackSdk,
            secretKey: "sk_test_123",
            webhook: { secret: "whsec_test" },
            subscription: {
              enabled: true,
              plans: [
                {
                  name: "team",
                  amount: 2500000,
                  currency: "NGN",
                  interval: "monthly",
                  planCode: "PLN_team_org",
                  paystackId: "ID_team_org",
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
                  const member = members[0] as Member;
                  return member.role === "owner" || member.role === "admin";
                }
                return false;
              },
            },
          }),
        ],
      });

      const ctx = await (auth as any).$context;
      const cookieHeaders = new Headers();

      const authClient = createAuthClient({
        baseURL: "http://localhost:3000",
        plugins: [bearer(), organizationClient(), paystackClient({ subscription: true })],
        fetchOptions: {
          customFetchImpl: async (url, init) => {
            const merged = new Headers(cookieHeaders);
            const initHeaders = new Headers((init as any)?.headers ?? {});
            for (const [k, v] of (initHeaders as any).entries()) merged.set(k, v);
            if (!merged.has("origin")) merged.set("origin", "http://localhost:3000");
            return auth.handler(new Request(url, { ...init, headers: merged }));
          },
        },
      });

      const user = { email: "org.owner@example.com", password: "password", name: "Org Owner" };
      await authClient.signUp.email(user, { throw: true });
      await authClient.signIn.email(user, {
        throw: true,
        onSuccess: setCookieToHeader(cookieHeaders),
      });

      const org = await (authClient as any).organization.create({
        name: "Test Org",
        slug: "test-org",
      });
      const orgId = org.data?.id;
      expect(orgId).toBeDefined();

      const init = await (authClient as any).paystack.transaction.initialize({
        plan: "team",
        referenceId: orgId,
      });
      if (init.error) throw new Error("Initialization failed");
      expect(init.data.url).toBe("https://paystack/checkout");
      expect(init.data.reference).toBe("ref_org_123");

      const subscriptions = await ctx.adapter.findMany({ model: "subscription" });
      expect(subscriptions?.length).toBeGreaterThan(0);
      const sub = subscriptions?.find((s: any) => s.referenceId === orgId);
      expect(sub).toBeDefined();
    });

    it("should reject referenceId for unauthorized user", async () => {
      const data: Record<string, any[]> = {
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
        transaction: {
          initialize: vi.fn(),
          verify: vi.fn(),
        },
      } as any;

      const auth = betterAuth({
        baseURL: "http://localhost:3000",
        trustedOrigins: ["http://localhost:3000"],
        database: memory,
        emailAndPassword: { enabled: true },
        plugins: [
          organization(),
          paystack<any>({
            paystackClient: paystackSdk,
            secretKey: "sk_test_123",
            webhook: { secret: "whsec_test" },
            subscription: {
              enabled: true,
              plans: [
                {
                  name: "team",
                  amount: 2500000,
                  currency: "NGN",
                  interval: "monthly",
                  planCode: "PLN_team_reject",
                  paystackId: "ID_team_reject",
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
                  const member = members[0] as Member;
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
            const initHeaders = new Headers((init as any)?.headers ?? {});
            for (const [k, v] of (initHeaders as any).entries()) merged.set(k, v);
            if (!merged.has("origin")) merged.set("origin", "http://localhost:3000");
            return auth.handler(new Request(url, { ...init, headers: merged }));
          },
        },
      });

      const user = { email: "nonmember@example.com", password: "password", name: "Non Member" };
      await authClient.signUp.email(user, { throw: true });
      await authClient.signIn.email(user, {
        throw: true,
        onSuccess: setCookieToHeader(cookieHeaders),
      });

      const fakeOrgId = "org_fake_123";

      try {
        await (authClient as any).paystack.transaction.initialize(
          { plan: "team", referenceId: fakeOrgId },
          { throw: true },
        );
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBeDefined();
      }

      expect(paystackSdk.transaction.initialize).not.toHaveBeenCalled();
    });
  });
});
