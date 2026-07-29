/* oxlint-disable @typescript-eslint/strict-boolean-expressions */

import { describe, expectTypeOf, it } from "vite-plus/test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createPaystack } from "@alexasomba/paystack-node";

import { paystack } from "../src/index.ts";
import type { PaystackClientLike, PaystackOptions, PaystackCustomerResponse } from "../src/types";

describe("Paystack Deep Typesafety", () => {
  it("should propagate custom metadata and limits types", () => {
    const options = {
      paystackClient: {} as PaystackClientLike,
      secretKey: "test_key",
      webhook: {
        verifyIP: true,
      },
      subscription: {
        enabled: true,
        plans: [
          {
            name: "Pro",
            group: "workspace",
            freeTrial: {
              days: 14,
              onTrialEnd: async (_subscription) => Promise.resolve(),
              onTrialExpired: async (_subscription) => Promise.resolve(),
            },
            limits: {
              maxProjects: 10,
              canExport: true,
            },
          },
        ],
        onSubscriptionComplete: async (_data, _ctx) => {
          await Promise.resolve();
          // Verify event metadata generic
          expectTypeOf(_data.event).toExtend<Record<string, unknown>>();
          // Verify plan limits generic
          expectTypeOf(_data.plan.limits).toExtend<Record<string, unknown> | undefined>();
        },
        onSubscriptionUpdate: async (_data, _ctx) => {
          await Promise.resolve();
          expectTypeOf(_data.subscription.billingInterval).toEqualTypeOf<
            string | null | undefined
          >();
          expectTypeOf(_data.plan.group).toEqualTypeOf<string | undefined>();
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

  it("should accept createPaystack clients and preserve concrete response data types", () => {
    const sdkClient = createPaystack({
      secretKey: "sk_test_123",
    });

    const options = {
      paystackClient: sdkClient,
      secretKey: "sk_test_123",
    } satisfies PaystackOptions<typeof sdkClient>;

    expectTypeOf(options.paystackClient).toEqualTypeOf<typeof sdkClient>();
    expectTypeOf(options.paystackClient?.transaction?.initialize).toEqualTypeOf(
      sdkClient.transaction.initialize,
    );
  });
});
