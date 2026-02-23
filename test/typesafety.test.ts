import { describe, expectTypeOf, it } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

import { paystack } from "../src";
import type { 
	PaystackClientLike, 
	PaystackOptions, 
	PaystackPlan, 
	PaystackWebhookPayload,
	PaystackCustomerResponse
} from "../src/types";

describe("Paystack Deep Typesafety", () => {
	it("should propagate custom metadata and limits types", () => {
        interface CustomMetadata {
            planId: string;
            referredBy?: string;
        }

        interface CustomLimits {
            maxProjects: number;
            canExport: boolean;
        }

        const options = {
        	paystackClient: {} as PaystackClientLike,
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
                    } as PaystackPlan<CustomLimits>
        		],
        		onSubscriptionComplete: async (_data, _ctx) => {
        			await Promise.resolve();
        			// Verify event metadata generic
        			expectTypeOf(_data.event).toMatchTypeOf<PaystackWebhookPayload<any, CustomMetadata>>();
        			// Verify plan limits generic
        			expectTypeOf(_data.plan.limits).toMatchTypeOf<CustomLimits | undefined>();
        		}
        	},
        	onCustomerCreate: async (_data, _ctx) => {
        		await Promise.resolve();
        		// Verify data.paystackCustomer is PaystackCustomerResponse
        		expectTypeOf(_data.paystackCustomer).toMatchTypeOf<PaystackCustomerResponse>();
        	},
        } satisfies PaystackOptions<PaystackClientLike, CustomMetadata, CustomLimits>;

        const auth = betterAuth({
        	baseURL: "http://localhost:3000",
        	database: memoryAdapter({}),
        	plugins: [paystack<PaystackClientLike, CustomMetadata, CustomLimits>(options)],
        });

        // Verify the plugin inference
        expectTypeOf(auth.api.paystackWebhook).toBeFunction();
	});

	it("should handle specialized response types in unwrapSdkResult", () => {
		// This is more of a compile-time check that our interfaces match the expected structure
		const customer: PaystackCustomerResponse = {
			customer_code: "CUS_123",
			email: "test@example.com",
			id: 123
		};
		expectTypeOf(customer.customer_code).toBeString();
	});
});
