import { describe, expect, it } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

import { paystack } from "../src/index.ts";

describe("Route Inspection", () => {
  it("registers only end-user billing routes on the auth API", () => {
    const auth = betterAuth({
      baseURL: "http://localhost:3000",
      database: memoryAdapter({}),
      plugins: [paystack({ secretKey: "test", paystackClient: {} as never })],
    });

    expect(auth.api.initializeTransaction).toBeDefined();
    expect(auth.api.verifyTransaction).toBeDefined();
    expect(auth.api.listTransactions).toBeDefined();
    expect(auth.api.listSubscriptions).toBeDefined();
    expect(auth.api.getSubscriptionManageLink).toBeDefined();
    expect(auth.api.listProducts).toBeDefined();
    expect(auth.api.listPlans).toBeDefined();

    expect((auth.api as Record<string, unknown>).chargeRecurringSubscription).toBeUndefined();
    expect((auth.api as Record<string, unknown>).syncProducts).toBeUndefined();
    expect((auth.api as Record<string, unknown>).syncPlans).toBeUndefined();
  });
});
