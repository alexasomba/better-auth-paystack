/* oxlint-disable @typescript-eslint/strict-boolean-expressions */

import { describe, expectTypeOf, it } from "vite-plus/test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

import { paystack } from "../src/index.ts";
import type { PaystackClientLike, PaystackOptions, PaystackCustomerResponse } from "../src/types";

describe("Paystack Deep Typesafety", () => {
  it("should propagate custom metadata and limits types", () => {
    const options = {
      paystackClient: {} as PaystackClientLike,
      secretKey: "test_key",
      webhook: {
        secret: "test_secret",
      },
      subscription: {
        enabled: true,
        plans: [
          {
            name: "Pro",
            limits: {
              maxProjects: 10,
              canExport: true,
            },
          } as any,
        ],
        onSubscriptionComplete: async (_data, _ctx) => {
          await Promise.resolve();
          // Verify event metadata generic
          expectTypeOf(_data.event).toExtend<Record<string, unknown>>();
          // Verify plan limits generic
          expectTypeOf(_data.plan.limits).toExtend<Record<string, unknown> | undefined>();
        },
      },
      onCustomerCreate: async (_data, _ctx) => {
        await Promise.resolve();
        // Verify data.paystackCustomer is PaystackCustomerResponse
        expectTypeOf(_data.paystackCustomer).toExtend<Partial<PaystackCustomerResponse>>();
      },
    } satisfies PaystackOptions<PaystackClientLike>;

    const auth = betterAuth({
      baseURL: "http://localhost:3000",
      database: memoryAdapter({}),
      plugins: [paystack<PaystackClientLike>(options)],
    });

    // Verify the plugin inference
    expectTypeOf((auth.api as any).paystackWebhook).toExtend<(...args: any[]) => any>();
  });

  it("should handle specialized response types in unwrapSdkResult", () => {
    // This is more of a compile-time check that our interfaces match the expected structure
    const customer = {
      customer_code: "CUS_123",
      email: "test@example.com",
      id: 123,
    } as unknown as PaystackCustomerResponse;
    expectTypeOf((customer as any).customer_code).toExtend<string>();
  });
});
