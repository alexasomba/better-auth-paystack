import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuthClient } from "better-auth/client";
import { setCookieToHeader } from "better-auth/cookies";

import { paystack } from "../src/index.ts";
import { paystackClient } from "../src/client.ts";
import type { PaystackClientLike, PaystackOptions } from "../src/types";

describe("paystack regressions", () => {
  const data: Record<string, unknown[]> = {
    user: [],
    session: [],
    verification: [],
    account: [],
    subscription: [],
    paystackTransaction: [],
  };
  const memory = memoryAdapter(data);

  beforeEach(() => {
    data.user = [];
    data.session = [];
    data.verification = [];
    data.account = [];
    data.subscription = [];
    data.paystackTransaction = [];
    vi.clearAllMocks();
  });

  it("lists subscriptions for the signed-in user", async () => {
    const options = {
      paystackClient: {} as PaystackClientLike,
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
          const headers = new Headers(init?.headers ?? {});
          if (!headers.has("origin")) headers.set("origin", "http://localhost:3000");
          return auth.handler(new Request(url, { ...init, headers }));
        },
      },
      plugins: [paystackClient({ subscription: true })],
    });

    const testUser = {
      email: "list-sub@email.com",
      password: "password",
      name: "List Sub User",
    };

    const signUp = await authClient.signUp.email(testUser, { throw: true });
    const headers = new Headers();
    await authClient.signIn.email(testUser, {
      throw: true,
      onSuccess: setCookieToHeader(headers),
    });
    headers.set("origin", "http://localhost:3000");

    const ctx = await auth.$context;
    await (ctx.adapter as any).create({
      model: "subscription",
      data: {
        userId: signUp.user.id,
        referenceId: signUp.user.id,
        plan: "starter",
        status: "active",
        paystackSubscriptionCode: "SUB_list_123",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/paystack/list-subscriptions", {
        method: "GET",
        headers,
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.subscriptions).toHaveLength(1);
    expect(payload.subscriptions[0].paystackSubscriptionCode).toBe("SUB_list_123");
  });

  it("gets the billing portal link for a subscription", async () => {
    const paystackSdk = {
      subscription: {
        manageLink: vi.fn().mockResolvedValue({
          data: {
            status: true,
            message: "Link generated",
            data: {
              link: "https://paystack.com/manage/SUB_123/token",
            },
          },
        }),
      },
    } as unknown as PaystackClientLike;

    const options = {
      paystackClient: paystackSdk,
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
          const headers = new Headers(init?.headers ?? {});
          if (!headers.has("origin")) headers.set("origin", "http://localhost:3000");
          return auth.handler(new Request(url, { ...init, headers }));
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
    headers.set("origin", "http://localhost:3000");

    const response = await auth.handler(
      new Request(
        "http://localhost:3000/api/auth/paystack/subscription-manage-link?subscriptionCode=SUB_123",
        {
          method: "GET",
          headers,
        },
      ),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.link).toBe("https://paystack.com/manage/SUB_123/token");
  });
});
