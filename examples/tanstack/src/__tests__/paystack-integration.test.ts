import { beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { anonymous, organization } from "better-auth/plugins";
import { paystack } from "@alexasomba/better-auth-paystack";
import { createPaystack } from "@alexasomba/paystack-node";

describe("TanStack Example - Paystack Integration", () => {
  let auth: any;
  const data: any = {
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
          paystackWebhookSecret: "whsec_test_mock",
          products: {
            products: [
              {
                name: "Test Product",
                price: 1000,
                currency: "NGN",
              },
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
    expect(endpoints.syncProducts).toBeDefined();
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
    const req = new Request("http://localhost:8787/api/auth/paystack/get-config", {
      method: "GET",
    });
    const res = await auth.handler(req);
    expect(res.status).toBe(200);

    const config = await res.json();
    expect(config.products).toBeDefined();
    expect(config.products.length).toBeGreaterThanOrEqual(1);
  });

  it("should successfully handle protected sync-products (mocking unauthorized)", async () => {
    const req = new Request("http://localhost:8787/api/auth/paystack/sync-products", {
      method: "POST",
    });
    const res = await auth.handler(req);

    // Should be 401 as it's protected and we have no session
    expect(res.status).toBe(401);
  });
});
