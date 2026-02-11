import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuthClient } from "better-auth/client";
import { setCookieToHeader } from "better-auth/cookies";
import { bearer } from "better-auth/plugins";
import { describe, expect, it, vi } from "vitest";

import { paystackClient } from "./client";
import type { PaystackClientLike, PaystackOptions, Subscription } from "./types";

import { paystack } from "./index";

describe("Issue #60: Subscription Cancellation Logic", () => {
	it("should set cancelAtPeriodEnd and keep status active until period end", async () => {
		const nextPaymentDate = new Date();
		nextPaymentDate.setDate(nextPaymentDate.getDate() + 15); // 15 days from now

		const paystackSdk = {
			subscription_fetch: vi.fn().mockResolvedValue({
				data: {
					status: true,
					message: "ok",
					data: {
						email_token: "tok_test_123",
						next_payment_date: nextPaymentDate.toISOString(),
					},
				},
			}),
			subscription_disable: vi.fn().mockResolvedValue({
				data: {
					status: true,
					message: "Subscription disabled successfully",
				},
			}),
		};

		const options = {
			paystackClient: paystackSdk,
			paystackWebhookSecret: "whsec_test",
			subscription: {
				enabled: true,
				plans: [],
			},
		} satisfies PaystackOptions<PaystackClientLike>;

		const data = {
			user: [],
			session: [],
			subscription: [],
		};
		const memory = memoryAdapter(data);

		const auth = betterAuth({
			database: memory,
			baseURL: "http://localhost:3000",
			emailAndPassword: { enabled: true },
			plugins: [paystack<PaystackClientLike>(options)],
		});

		const authClient = createAuthClient({
			baseURL: "http://localhost:3000",
			plugins: [paystackClient({ subscription: true })],
			fetchOptions: {
				customFetchImpl: async (url, init) => auth.handler(new Request(url, init)),
			},
		});

		const testUser = {
			email: "sub-cancel@email.com",
			password: "password",
			name: "Sub Cancel User",
		};

		const signUpRes = await authClient.signUp.email(testUser, { throw: true });
		
		const headers = new Headers();
		await authClient.signIn.email(testUser, {
			throw: true,
			onSuccess: setCookieToHeader(headers),
		});

		// Manually create an active subscription
		const ctx = await auth.$context;
		await (ctx.adapter as any).create({
			model: "subscription",
			data: {
				plan: "starter",
				referenceId: signUpRes.user.id,
				status: "active",
				paystackSubscriptionCode: "SUB_cancel_test",
				createdAt: new Date(),
				updatedAt: new Date(),
			} as unknown as Subscription
		});

		await authClient.paystack.subscription.cancel({
			subscriptionCode: "SUB_cancel_test",
		}, {
			headers
		});

		const sub = (
			await (ctx.adapter as any).findMany({
				model: "subscription",
				where: [
					{ field: "paystackSubscriptionCode", value: "SUB_cancel_test" },
				],
			})
		)?.[0] as Subscription | undefined;

		expect(sub).toBeDefined();
		// FAILURE EXPECTED HERE with current code:
		expect(sub?.status).toBe("active"); 
		expect(sub?.cancelAtPeriodEnd).toBe(true);
		expect(sub?.periodEnd).toEqual(nextPaymentDate);
	});
});
