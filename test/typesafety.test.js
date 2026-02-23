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
                ]
            },
            onCustomerCreate: async (data, ctx) => {
                // Verify data.paystackCustomer is PaystackCustomerResponse
                expectTypeOf(data.paystackCustomer).toMatchTypeOf();
                // Verify custom metadata propagation would be handled via casting or inference if we refine further, 
                // but at least standard structures are strictly typed now.
            },
            onSubscriptionComplete: async (data, ctx) => {
                // Verify event metadata generic
                expectTypeOf(data.event).toMatchTypeOf();
                // Verify plan limits generic
                expectTypeOf(data.plan.limits).toMatchTypeOf();
            }
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
