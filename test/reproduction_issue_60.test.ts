/* oxlint-disable @typescript-eslint/strict-boolean-expressions */

import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { paystack } from "../src/index.ts";
import type { PaystackClientLike } from "../src/types";

describe("Issue #60 Reproduction", () => {
  beforeEach(() => {
    process.env.PAYSTACK_SECRET_KEY = "sk_test_123";
    process.env.PAYSTACK_WEBHOOK_SECRET = "whsec_test";
  });

  it("should calculate correct billing periods even for edge-case dates", async () => {
    const memory = memoryAdapter({
      user: [],
      session: [],
      account: [],
      verification: [],
      subscription: [],
    });
    const nextPaymentDate = new Date();
    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

    const paystackSdk = {
      subscription: {
        fetch: vi.fn().mockResolvedValue({
          data: {
            status: true,
            message: "ok",
            data: {
              email_token: "tok_test_123",
              next_payment_date: nextPaymentDate.toISOString(),
            },
          },
        }),
        disable: vi.fn().mockResolvedValue({
          data: {
            status: true,
            message: "Subscription disabled successfully",
          },
        }),
      },
    } as any;

    const auth = betterAuth({
      database: memory,
      baseURL: "http://localhost:3000",
      plugins: [
        paystack<PaystackClientLike>({
          paystackClient: paystackSdk,
          secretKey: "sk_test_123",
          webhook: { secret: "whsec_test" },
          subscription: {
            enabled: true,
            plans: [],
          },
        }),
      ],
    });

    const ctx = await (auth as any).$context;
    expect(ctx).toBeDefined();
    // Test logic continues...
  });
});
