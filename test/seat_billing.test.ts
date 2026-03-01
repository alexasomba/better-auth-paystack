import { describe, expect, it, vi, beforeEach } from "vitest";
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuthClient } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";
import { setCookieToHeader } from "better-auth/cookies";

import { paystack } from "../src/index";
import { paystackClient } from "../src/client";
import type { PaystackClientLike, PaystackOptions } from "../src/types";

describe("Seat-Based Billing & Scheduled Changes", () => {
	const paystackSdk = {
		transaction_initialize: vi.fn(),
		transaction_verify: vi.fn(),
		subscription_update: vi.fn(),
		subscription_fetch: vi.fn(),
		customer_update: vi.fn(),
	} as unknown as PaystackClientLike;

	const options = {
		paystackClient: paystackSdk,
		paystackWebhookSecret: "whsec_test",
		subscription: {
			enabled: true,
			plans: [
				{
					name: "team-plan",
					amount: 100000, // 1000 NGN base
					interval: "monthly",
					seatAmount: 50000, // 500 NGN per seat
				}
			],
		},
		organization: {
			enabled: true,
		}
	} satisfies PaystackOptions<PaystackClientLike>;

	const data = {
		user: [],
		session: [],
		subscription: [],
		paystackTransaction: [],
		organization: [],
		member: [],
		invitation: [],
	};
	const adapter = memoryAdapter(data);

	const auth = betterAuth({
		database: adapter,
		baseURL: "http://localhost:3000",
		emailAndPassword: { enabled: true },
		plugins: [
			organization(),
			paystack<PaystackClientLike>(options)
		],
	});

	const authClient = createAuthClient({
		baseURL: "http://localhost:3000",
		plugins: [
			organizationClient(),
			paystackClient({ subscription: true })
		],
		fetchOptions: {
			customFetchImpl: async (url, init) => auth.handler(new Request(url, init)),
		},
	});

	beforeEach(() => {
		data.user = [];
		data.session = [];
		data.subscription = [];
		data.paystackTransaction = [];
		data.organization = [];
		data.member = [];
		data.invitation = [];
		vi.clearAllMocks();
	});

	it("should calculate correct amount with seats in initializeTransaction", async () => {
		const testUser = { email: "owner@test.com", password: "password", name: "Owner" };
		await authClient.signUp.email(testUser, { throw: true });
		const headers = new Headers();
		await authClient.signIn.email(testUser, { throw: true, onSuccess: setCookieToHeader(headers) });

		const orgRes = await authClient.organization.create({
			name: "Test Org",
			slug: "test-org",
		}, { headers });
		const orgId = orgRes.data?.id ?? "";

		// Add another member
		const ctx = await auth.$context;
		await (ctx.adapter as any).create({
			model: "member",
			data: {
				userId: "user-2",
				organizationId: orgId,
				role: "member",
				createdAt: new Date(),
			}
		});

		(paystackSdk.transaction_initialize as any).mockResolvedValue({
			data: {
				status: true,
				data: {
					authorization_url: "https://paystack.com/auth",
					reference: "ref_123",
				},
			},
		});

		// 2 members total (owner should be auto-added + 1 added manually)
		await authClient.paystack.initializeTransaction({
			plan: "team-plan",
			referenceId: orgId,
		}, { headers });

		expect(paystackSdk.transaction_initialize).toHaveBeenCalledWith(expect.objectContaining({
			body: expect.objectContaining({
				amount: 200000,
			})
		}));
	});

	it("should store pendingPlan when scheduleAtPeriodEnd is true", async () => {
		const testUser = { email: "schedule@test.com", password: "password", name: "User" };
		const signUp = await authClient.signUp.email(testUser, { throw: true });
		const headers = new Headers();
		await authClient.signIn.email(testUser, { throw: true, onSuccess: setCookieToHeader(headers) });

		const ctx = await auth.$context;
		await (ctx.adapter as any).create({
			model: "subscription",
			data: {
				plan: "old-plan",
				referenceId: signUp.user.id,
				status: "active",
				createdAt: new Date(),
				updatedAt: new Date(),
			}
		});

		// Initialize with scheduleAtPeriodEnd
		const res = await auth.handler(new Request("http://localhost:3000/api/auth/paystack/initialize-transaction", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": headers.get("Authorization") ?? "",
				"Cookie": headers.get("Cookie") ?? "",
			},
			body: JSON.stringify({
				plan: "team-plan",
				referenceId: signUp.user.id,
				scheduleAtPeriodEnd: true,
			}),
		}));

		const json = await res.json();

		expect(res.status).toBe(200);
		expect(json.status).toBe("success");
		expect(json.scheduled).toBe(true);

		const subs = await (ctx.adapter as any).findMany({ model: "subscription" });
		const sub = subs[0];
		expect(sub.pendingPlan).toBe("team-plan");
	});

	it("should transition pendingPlan in webhook charge.success", async () => {
		const ctx = await auth.$context;
		const sub = await (ctx.adapter as any).create({
			model: "subscription",
			data: {
				plan: "old-plan",
				referenceId: "user-id",
				paystackSubscriptionCode: "SUB_123",
				status: "active",
				pendingPlan: "team-plan",
				createdAt: new Date(),
				updatedAt: new Date(),
			}
		});

		// Mock webhook payload
		const payload = {
			event: "charge.success",
			data: {
				status: "success",
				subscription: {
					subscription_code: "SUB_123",
				}
			}
		};

		const signature = await (async () => {
			const encoder = new TextEncoder();
			const key = await crypto.subtle.importKey("raw", encoder.encode("whsec_test"), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
			const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(JSON.stringify(payload)));
			return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
		})();

		const res = await auth.handler(new Request("http://localhost:3000/api/auth/paystack/webhook", {
			method: "POST",
			headers: {
				"x-paystack-signature": signature,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		}));

		expect(res.status).toBe(200);

		const updatedSub = await (ctx.adapter as any).findOne({
			model: "subscription",
			where: [{ field: "id", value: (sub).id }],
		});
		expect(updatedSub.plan).toBe("team-plan");
		expect(updatedSub.pendingPlan).toBeNull();
	});
});
