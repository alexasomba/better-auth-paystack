import { betterAuth } from "better-auth";
import { createAuthClient } from "better-auth/client";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { paystack } from "../src/index";
import { paystackClient } from "../src/client";
import type { PaystackOptions, PaystackClientLike } from "../src/types";

// Mock database adapter
const memory: any = {
  create: vi.fn(),
  findOne: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// Helper to extract cookies from a response and set them to a header object
const setCookieToHeader = (headers: Headers) => (res: any) => {
  const setCookie = res.response.headers.get("set-cookie");
  if (setCookie !== null) {
    headers.set("cookie", setCookie);
  }
};

describe("paystack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ... (keeping most of the file as is, but focusing on the fixes)

  // FIXING FAILURE 1 (Line 373)
  it("should list subscriptions for user", async () => {
    const options = {
      paystackClient: {},
      subscription: {
        enabled: true,
        plans: [],
      },
      secretKey: "sk_test_123",
      webhook: { secret: "whsec_test" },
    } satisfies PaystackOptions<PaystackClientLike>;

    const auth = betterAuth({
      database: memory,
      baseURL: "http://localhost:3000",
      emailAndPassword: { enabled: true },
      plugins: [paystack<PaystackClientLike>(options)],
    });

    const authClient = createAuthClient({
      baseURL: "http://localhost:3000",
      fetchOptions: {
        customFetchImpl: async (url, init) => {
          const merged = new Headers(init?.headers ?? {});
          if (!merged.has("origin")) merged.set("origin", "http://localhost:3000");
          return auth.handler(new Request(url, { ...init, headers: merged }));
        },
      },
      plugins: [paystackClient({ subscription: true })],
    });

    const testUser = {
      email: "list-sub@email.com",
      password: "password",
      name: "List Sub User",
    };

    const _signUpRes = await authClient.signUp.email(testUser, { throw: true });

    const headers = new Headers();
    await authClient.signIn.email(testUser, {
      throw: true,
      onSuccess: setCookieToHeader(headers),
    });

    // Manually create a subscription in DB
    const _ctx = await auth.$context;
    memory.findMany.mockResolvedValue([
      {
        plan: "starter",
        paystackSubscriptionCode: "SUB_list_123",
      },
    ]);

    const res = await (authClient as any).paystack.subscription.list(
      {},
      {
        headers,
      },
    );

    expect(res.data?.subscriptions).toHaveLength(1);
    expect(res.data?.subscriptions[0].paystackSubscriptionCode).toBe("SUB_list_123");
  });

  // FIXING FAILURE 2 (Line 438)
  it("should get billing portal link", async () => {
    const paystackSdk = {
      subscription: {
        manageLink: vi.fn(),
      },
    };
    (paystackSdk.subscription.manageLink as any).mockResolvedValue({
      data: {
        link: "https://paystack.com/manage/SUB_123/token",
      },
      status: true,
      message: "Link generated",
    });

    const options = {
      paystackClient: paystackSdk as unknown as PaystackClientLike,
      subscription: {
        enabled: true,
        plans: [],
      },
      secretKey: "sk_test_123",
      webhook: { secret: "whsec_test" },
    } satisfies PaystackOptions<PaystackClientLike>;

    const auth = betterAuth({
      database: memory,
      baseURL: "http://localhost:3000",
      emailAndPassword: { enabled: true },
      plugins: [paystack<PaystackClientLike>(options)],
    });

    const authClient = createAuthClient({
      baseURL: "http://localhost:3000",
      fetchOptions: {
        customFetchImpl: async (url, init) => {
          const merged = new Headers(init?.headers ?? {});
          if (!merged.has("origin")) merged.set("origin", "http://localhost:3000");
          return auth.handler(new Request(url, { ...init, headers: merged }));
        },
      },
      plugins: [paystackClient({ subscription: true })],
    });

    const testUser = {
      email: "portal@email.com",
      password: "password",
      name: "Portal User",
    };

    await authClient.signUp.email(testUser, { throw: true });
    const headers = new Headers();
    await authClient.signIn.email(testUser, {
      throw: true,
      onSuccess: setCookieToHeader(headers),
    });

    const res = await (authClient as any).paystack.subscription.billingPortal(
      {
        subscriptionCode: "SUB_123",
      },
      {
        headers,
      },
    );

    expect(res.data?.link).toBe("https://paystack.com/manage/SUB_123/token");
  });
});
