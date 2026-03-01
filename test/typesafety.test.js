import { describe, expectTypeOf, it } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { paystack } from "../src";
describe("Paystack Deep Typesafety", () => {
    it("should propagate custom metadata and limits types", () => {
        const options = {
            paystackClient: {},
            paystackWebhookSecret: "test_secret",
            subscription: {
                enabled: true,
                plans: [
                    {
                        name: "Pro",
                        limits: {
                            maxProjects: 10,
                            canExport: true
                        }
                    }
                ],
                onSubscriptionComplete: async (_data, _ctx) => {
                    await Promise.resolve();
                    // Verify event metadata generic
                    expectTypeOf(_data.event).toMatchTypeOf();
                    // Verify plan limits generic
                    expectTypeOf(_data.plan.limits).toMatchTypeOf();
                }
            },
            onCustomerCreate: async (_data, _ctx) => {
                await Promise.resolve();
                // Verify data.paystackCustomer is PaystackCustomerResponse
                expectTypeOf(_data.paystackCustomer).toMatchTypeOf();
            },
        };
        const auth = betterAuth({
            baseURL: "http://localhost:3000",
            database: memoryAdapter({}),
            plugins: [paystack(options)],
        });
        // Verify the plugin inference
        expectTypeOf(auth.api.paystackWebhook).toBeFunction();
    });
    it("should handle specialized response types in unwrapSdkResult", () => {
        // This is more of a compile-time check that our interfaces match the expected structure
        const customer = {
            customer_code: "CUS_123",
            email: "test@example.com",
            id: 123
        };
        expectTypeOf(customer.customer_code).toBeString();
    });
});
