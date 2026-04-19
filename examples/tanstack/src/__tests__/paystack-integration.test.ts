import { beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { betterAuth } from "better-auth";
import { createAuthClient } from "better-auth/react";
import { memoryAdapter } from "better-auth/adapters/memory";
import { anonymous, organization } from "better-auth/plugins";
import { paystack } from "@alexasomba/better-auth-paystack";
import { paystackClient } from "@alexasomba/better-auth-paystack/client";
import { createPaystack } from "@alexasomba/paystack-node";

vi.mock("@alexasomba/paystack-node", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    createPaystack: vi.fn(() => ({
      transaction: {
        verify: vi.fn(() =>
          Promise.resolve({
            status: true,
            data: {
              id: 123,
              status: "success",
              reference: "ref_123",
              amount: 1000,
              customer: { email: "test@example.com" },
            },
          }),
        ),
        list: vi.fn(() =>
          Promise.resolve({
            status: true,
            data: [],
          }),
        ),
      },
      subscription: {
        manageLink: vi.fn(() =>
          Promise.resolve({
            status: true,
            data: { link: "https://paystack.com/manage/123" },
          }),
        ),
      },
    })),
  };
});

describe("TanStack Example - Paystack Integration", () => {
  let auth: any;
  let requestLog: string[];
  const data: Record<string, unknown[]> = {
    user: [],
    session: [],
    verification: [],
    account: [],
    subscription: [],
    paystackTransaction: [],
    paystackProduct: [],
    organization: [],
    member: [],
    invitation: [],
  };

  beforeEach(() => {
    requestLog = [];
  });

  beforeAll(() => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_mock");
    vi.stubEnv("PAYSTACK_WEBHOOK_SECRET", "whsec_test_mock");

    // Seed products into memory database
    data.paystackProduct = [
      {
        id: "prod_1",
        name: "Test Product",
        price: 1000,
        currency: "NGN",
        slug: "test-product",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const paystackClient = createPaystack({
      secretKey: "sk_test_mock",
    });

    auth = betterAuth({
      baseURL: "http://localhost:8787",
      database: memoryAdapter(data),
      emailAndPassword: { enabled: true },
      plugins: [
        anonymous(),
        organization(),
        paystack({
          paystackClient,
          secretKey: "sk_test_mock",
          webhook: { secret: "whsec_test_mock" },
          subscription: {
            enabled: true,
            plans: [],
          },
          products: {
            products: [
              {
                name: "Test Product",
                price: 1000,
                currency: "NGN",
              } as any,
            ],
          },
        }),
      ],
    });
  });

  it("should have paystack plugin endpoints registered", () => {
    const endpoints = auth.api;
    expect(endpoints.initializeTransaction).toBeDefined();
    expect(endpoints.listProducts).toBeDefined();
    expect(endpoints.verifyTransaction).toBeDefined();
    expect(endpoints.paystackWebhook).toBeDefined();
    expect(endpoints.listTransactions).toBeDefined();
    expect(endpoints.listSubscriptions).toBeDefined();
    expect((endpoints as Record<string, unknown>).syncProducts).toBeUndefined();
  });

  it("should successfully call list-products", async () => {
    const req = new Request("http://localhost:8787/api/auth/paystack/list-products", {
      method: "GET",
    });
    const res = await auth.handler(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.products).toBeDefined();
    expect(Array.isArray(json.products)).toBe(true);
    // It should contain the products we seeded
    expect(json.products.length).toBeGreaterThanOrEqual(1);
  });

  it("should have products and plans configured in the plugin", async () => {
    const req = new Request("http://localhost:8787/api/auth/paystack/config", {
      method: "GET",
    });
    const res = await auth.handler(req);
    expect(res.status).toBe(200);

    const config = await res.json();
    expect(config.products).toBeDefined();
    expect(config.products.length).toBeGreaterThanOrEqual(1);
  });

  it("uses the stable auth client endpoints for config and subscription listing", async () => {
    const cookieHeaders = new Headers();
    const authClient = createAuthClient({
      baseURL: "http://localhost:8787",
      plugins: [paystackClient({ subscription: true })],
      fetchOptions: {
        customFetchImpl: async (url, init) => {
          const nextUrl =
            typeof url === "string" ? url : "href" in url ? url.href : (url as any).url;
          requestLog.push(nextUrl);

          const mergedHeaders = new Headers(init?.headers ?? {});
          cookieHeaders.forEach((value, key) => {
            mergedHeaders.set(key, value);
          });

          if (!mergedHeaders.has("origin")) {
            mergedHeaders.set("origin", "http://localhost:8787");
          }

          const response = await auth.handler(
            new Request(nextUrl, { ...init, headers: mergedHeaders }),
          );
          const setCookie = response.headers.get("set-cookie");
          if (setCookie !== null) {
            cookieHeaders.set("cookie", setCookie);
          }
          return response;
        },
      },
    });

    expect(typeof (authClient as any).paystack.config).toBe("function");
    expect(typeof (authClient as any).subscription.list).toBe("function");

    const user = {
      email: "tanstack-client@example.com",
      password: "password123",
      name: "TanStack Client User",
    };

    await authClient.signUp.email(user, { throw: true });
    await authClient.signIn.email(user, { throw: true });
    requestLog = [];

    const configRes = await (authClient as any).paystack.config();
    expect(configRes.error).toBeNull();
    expect(configRes.data?.products).toBeDefined();

    const listRes = await authClient.subscription.list({});
    expect(listRes.error).toBeNull();
    expect(Array.isArray(listRes.data?.subscriptions)).toBe(true);

    expect(requestLog.some((url) => url.includes("/api/auth/paystack/config"))).toBe(true);
    expect(requestLog.some((url) => url.includes("/api/auth/paystack/list-subscriptions"))).toBe(
      true,
    );
    expect(requestLog.some((url) => url.includes("/api/auth/paystack/get-config"))).toBe(false);
    expect(
      requestLog.some((url) => url.includes("/api/auth/paystack/subscription/list-local")),
    ).toBe(false);
  });

  it("uses the stable auth client endpoints for verify, transactions, and manage-link flows", async () => {
    const cookieHeaders = new Headers();
    const authClient = createAuthClient({
      baseURL: "http://localhost:8787",
      plugins: [paystackClient({ subscription: true })],
      fetchOptions: {
        customFetchImpl: async (url, init) => {
          const nextUrl =
            typeof url === "string" ? url : "href" in url ? url.href : (url as any).url;
          requestLog.push(nextUrl);

          const mergedHeaders = new Headers(init?.headers ?? {});
          cookieHeaders.forEach((value, key) => {
            mergedHeaders.set(key, value);
          });

          if (!mergedHeaders.has("origin")) {
            mergedHeaders.set("origin", "http://localhost:8787");
          }

          const response = await auth.handler(
            new Request(nextUrl, { ...init, headers: mergedHeaders }),
          );
          const setCookie = response.headers.get("set-cookie");
          if (setCookie !== null) {
            cookieHeaders.set("cookie", setCookie);
          }
          return response;
        },
      },
    });

    const user = {
      email: "tanstack-stable-routes@example.com",
      password: "password123",
      name: "TanStack Stable Routes",
    };

    await authClient.signUp.email(user, { throw: true });
    await authClient.signIn.email(user, { throw: true });
    requestLog = [];

    await Promise.allSettled([
      (authClient as any).paystack.verifyTransaction({ reference: "ref_123" }),
      (authClient as any).paystack.listTransactions({ query: {} }),
      authClient.subscription.billingPortal({
        subscriptionCode: "SUB_123",
      }),
    ]);

    expect(requestLog.some((url) => url.includes("/api/auth/paystack/verify-transaction"))).toBe(
      true,
    );
    expect(requestLog.some((url) => url.includes("/api/auth/paystack/list-transactions"))).toBe(
      true,
    );
    expect(
      requestLog.some((url) => url.includes("/api/auth/paystack/subscription-manage-link")),
    ).toBe(true);

    expect(requestLog.some((url) => url.includes("/api/auth/paystack/transaction/verify"))).toBe(
      false,
    );
    expect(requestLog.some((url) => url.includes("/api/auth/paystack/transaction/list"))).toBe(
      false,
    );
    expect(
      requestLog.some((url) => url.includes("/api/auth/paystack/subscription/manage-link")),
    ).toBe(false);
  });
});
