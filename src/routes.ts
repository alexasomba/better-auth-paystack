import { createAuthEndpoint } from "@better-auth/core/api";
import { defineErrorCodes } from "@better-auth/core/utils/error-codes";
import { HIDE_METADATA } from "better-auth";
import {
	APIError,
	getSessionFromCtx,
	originCheck,
	sessionMiddleware,
} from "better-auth/api";
import * as z from "zod/v4";
import type { GenericEndpointContext } from "better-auth";

import type {
	InputPaystackProduct,
	PaystackTransaction,
	AnyPaystackOptions,
	PaystackClientLike,
	PaystackProduct,
	Subscription,
	PaystackProductResponse,
	PaystackWebhookPayload,
	PaystackPlan,
	PaystackSubscriptionResponse,
	PaystackTransactionResponse,
	PaystackCustomerResponse,
	User,
	Member,
} from "./types";
import {
	syncProductQuantityFromPaystack,
	getPlanByName,
	getPlans,
	getProductByName,
	getProducts,
	validateMinAmount,
	getNextPeriodEnd,
} from "./utils";
import { referenceMiddleware } from "./middleware";
import { getPaystackOps, unwrapSdkResult } from "./paystack-sdk";
import { getOrganizationSubscription } from "./limits";

const PAYSTACK_ERROR_CODES = defineErrorCodes({
	SUBSCRIPTION_NOT_FOUND: "Subscription not found",
	SUBSCRIPTION_PLAN_NOT_FOUND: "Subscription plan not found",
	UNABLE_TO_CREATE_CUSTOMER: "Unable to create customer",
	FAILED_TO_INITIALIZE_TRANSACTION: "Failed to initialize transaction",
	FAILED_TO_VERIFY_TRANSACTION: "Failed to verify transaction",
	FAILED_TO_DISABLE_SUBSCRIPTION: "Failed to disable subscription",
	FAILED_TO_ENABLE_SUBSCRIPTION: "Failed to enable subscription",
	EMAIL_VERIFICATION_REQUIRED:
		"Email verification is required before you can subscribe to a plan",
});

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
	const encoder = new TextEncoder();
	const keyData = encoder.encode(secret);
	const msgData = encoder.encode(message);

	const crypto = globalThis.crypto;
	if (crypto !== undefined && crypto !== null && "subtle" in crypto) {
		const subtle = crypto.subtle;
		const key = await subtle.importKey(
			"raw",
			keyData,
			{ name: "HMAC", hash: "SHA-512" },
			false,
			["sign"],
		);
		const signature = await subtle.sign("HMAC", key, msgData);
		return Array.from(new Uint8Array(signature))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
	}

	const { createHmac } = await import("node:crypto");
	return createHmac("sha512", secret).update(message).digest("hex");
}

export const paystackWebhook = (options: AnyPaystackOptions) => {
	return createAuthEndpoint(
		"/paystack/webhook",
		{
			method: "POST",
			metadata: {
				...HIDE_METADATA,
				openapi: {
					operationId: "handlePaystackWebhook",
				},
			},
			cloneRequest: true,
			disableBody: true,
		},
		async (ctx) => {
			const request = (ctx as unknown as { requestClone?: Request }).requestClone ?? (ctx as { request: Request }).request;
			if (!request) {
				throw new APIError("BAD_REQUEST", {
					message: "Request object is missing from context",
				});
			}
			const payload = await request.text();
			const headers = (ctx as GenericEndpointContext & { headers?: Headers }).headers ?? (ctx.request as unknown as { headers: Headers })?.headers;
			const signature = headers?.get("x-paystack-signature") as
				| string
				| null
				| undefined;

			if (signature === undefined || signature === null || signature === "") {
				throw new APIError("UNAUTHORIZED", {
					message: "Missing x-paystack-signature header",
					status: 401,
				});
			}

			const expected = await hmacSha512Hex(options.paystackWebhookSecret, payload);
			if (expected !== signature) {
				throw new APIError("UNAUTHORIZED", {
					message: "Invalid Paystack webhook signature",
					status: 401,
				});
			}

			const event = JSON.parse(payload) as PaystackWebhookPayload;
			const eventName = event.event;
			const data = event.data;

			// Core Transaction Status Sync (Applies to both one-time and recurring)
			if (eventName === "charge.success") {
				const reference = (data as Record<string, unknown> | undefined)?.reference as string | undefined;
				const paystackId = (data as Record<string, unknown> | undefined)?.id !== undefined && (data as Record<string, unknown> | undefined)?.id !== null ? String((data).id) : undefined;
				if (reference !== undefined && reference !== null && reference !== "") {
					try {
						await ctx.context.adapter.update({
							model: "paystackTransaction",
							update: {
								status: "success",
								paystackId,
								updatedAt: new Date(),
							},
							where: [{ field: "reference", value: reference }],
						});
					} catch (e) {
						// Transaction record might not exist yet (e.g. webhook arrives before local record)
						ctx.context.logger.warn("Failed to update transaction status for charge.success", e);
					}

					// Sync product quantity from Paystack after successful charge
					try {
						const transaction = await ctx.context.adapter.findOne<PaystackTransaction>({
							model: "paystackTransaction",
							where: [{ field: "reference", value: reference }],
						});
						if (transaction?.product) {
							await syncProductQuantityFromPaystack(ctx, transaction.product, options.paystackClient);
						}
					} catch (e) {
						ctx.context.logger.warn("Failed to sync product quantity", e);
					}
				}
			}

			if (eventName === "charge.failure") {
				const reference = (data as Record<string, unknown> | undefined)?.reference as string | undefined;
				if (reference !== undefined && reference !== null && reference !== "") {
					try {
						await ctx.context.adapter.update({
							model: "paystackTransaction",
							update: {
								status: "failed",
								updatedAt: new Date(),
							},
							where: [{ field: "reference", value: reference }],
						});
					} catch (e) {
						ctx.context.logger.warn("Failed to update transaction status for charge.failure", e);
					}
				}
			}

			// Best-effort local state sync for subscription lifecycle.
			if (options.subscription?.enabled === true) {
				try {

					if (eventName === "subscription.create") {
						const payloadData = data as PaystackSubscriptionResponse | undefined;
						const subscriptionCode =
							payloadData?.subscription_code ??
							(payloadData as any)?.subscription?.subscription_code ??
							(payloadData as any)?.code;
						const customerCode =
							payloadData?.customer?.customer_code ??
							(payloadData as any)?.customer_code ??
							(payloadData as any)?.customer?.code;
						const planCode =
							payloadData?.plan?.plan_code ?? (payloadData as any)?.plan_code ?? (payloadData as any)?.plan;

						let metadata: unknown = payloadData?.metadata;
						if (typeof metadata === "string") {
							try {
								metadata = JSON.parse(metadata);
							} catch {
								// ignore
							}
						}

						const referenceIdFromMetadata =
							typeof metadata === "object" && metadata !== null
								? ((metadata as Record<string, unknown>).referenceId as string | undefined)
								: undefined;

						let planNameFromMetadata =
							typeof metadata === "object" && metadata !== null
								? ((metadata as Record<string, unknown>).plan as string | undefined)
								: undefined;
						if (typeof planNameFromMetadata === "string") {
							planNameFromMetadata = planNameFromMetadata.toLowerCase();
						}

						const plans = await getPlans(options.subscription);
						const planFromCode = (planCode !== undefined && planCode !== null && planCode !== "")
							? plans.find((p) => p.planCode !== undefined && p.planCode !== null && p.planCode === planCode)
							: undefined;
						const planPart = planFromCode?.name ?? planNameFromMetadata;
						const planName = planPart !== undefined && planPart !== null && planPart !== "" ? planPart.toLowerCase() : undefined;

						if (subscriptionCode !== undefined && subscriptionCode !== null && subscriptionCode !== "") {
							const where: { field: string; value: string | number | boolean | null }[] = [];
							if (referenceIdFromMetadata !== undefined && referenceIdFromMetadata !== null && referenceIdFromMetadata !== "") {
								where.push({ field: "referenceId", value: referenceIdFromMetadata });
							} else if (customerCode !== undefined && customerCode !== null && customerCode !== "") {
								where.push({ field: "paystackCustomerCode", value: customerCode });
							}
							if (planName !== undefined && planName !== null && planName !== "") {
								where.push({ field: "plan", value: planName });
							}

							if (where.length > 0) {
								const matches = await ctx.context.adapter.findMany<Subscription>({
									model: "subscription",
									where: where as { field: string; value: string | number | boolean | null }[],
								});
								const subscription = matches?.[0];
								if (subscription) {
									await ctx.context.adapter.update({
										model: "subscription",
										update: {
											paystackSubscriptionCode: subscriptionCode,
											status: "active",
											updatedAt: new Date(),
											periodEnd: (payloadData?.next_payment_date) ? new Date(payloadData.next_payment_date) : undefined,
										},
										where: [{ field: "id", value: subscription.id }],
									});

									const plan = planFromCode ?? (planName !== undefined && planName !== null && planName !== "" ? await getPlanByName(options, planName) : undefined);
									if (plan !== undefined && plan !== null) {
										await options.subscription.onSubscriptionComplete?.(
											{ event, subscription: { ...subscription, paystackSubscriptionCode: subscriptionCode, status: "active" }, plan },
											ctx as GenericEndpointContext,
										);
										// Also call onSubscriptionCreated for subscriptions created outside of checkout
										await options.subscription.onSubscriptionCreated?.(
											{ event, subscription: { ...subscription, paystackSubscriptionCode: subscriptionCode, status: "active" }, plan },
											ctx as GenericEndpointContext,
										);
									}
								}
							}
						}
					}

					if (eventName === "subscription.disable" || eventName === "subscription.not_renew") {
						const payloadData = data as PaystackSubscriptionResponse | undefined;
						const subscriptionCode =
							payloadData?.subscription_code ??
							(payloadData as any)?.subscription?.subscription_code ??
							(payloadData as any)?.code;
						if (subscriptionCode) {
							// Find the subscription first to get full data for the hook
							const existing = await ctx.context.adapter.findOne<Subscription>({
								model: "subscription",
								where: [{ field: "paystackSubscriptionCode", value: subscriptionCode }],
							});

							let newStatus = "canceled";
							const nextPaymentDate = (data)?.next_payment_date as string | undefined;
							const periodEnd = nextPaymentDate ? new Date(nextPaymentDate) : (existing?.periodEnd ? new Date(existing.periodEnd) : undefined);

							if (periodEnd && periodEnd > new Date()) {
								newStatus = "active";
							}

							await ctx.context.adapter.update({
								model: "subscription",
								update: {
									status: newStatus,
									cancelAtPeriodEnd: true,
									...(periodEnd ? { periodEnd } : {}),
									updatedAt: new Date(),
								},
								where: [
									{ field: "paystackSubscriptionCode", value: subscriptionCode },
								],
							});

							if (existing) {
								await options.subscription.onSubscriptionCancel?.(
									{ event, subscription: { ...existing, status: "canceled" } },
									ctx as GenericEndpointContext,
								);
							}
						}
					}

					// Handle plan changes on renewal
					if (eventName === "charge.success" || eventName === "invoice.update") {
						const payloadData = data as PaystackSubscriptionResponse | undefined;
						const subscriptionCode = (payloadData as any)?.subscription?.subscription_code ?? payloadData?.subscription_code;

						if (subscriptionCode) {
							const existingSub = await ctx.context.adapter.findOne<Subscription>({
								model: "subscription",
								where: [{ field: "paystackSubscriptionCode", value: subscriptionCode }],
							});

							if (existingSub?.pendingPlan) {
								await ctx.context.adapter.update({
									model: "subscription",
									update: {
										plan: existingSub.pendingPlan,
										pendingPlan: null,
										updatedAt: new Date(),
									},
									where: [{ field: "id", value: existingSub.id }],
								});
							}
						}
					}
				} catch (_e: unknown) {
					ctx.context.logger.error("Failed to sync Paystack webhook event", _e);
				}
			}

			await options.onEvent?.(event);
			return ctx.json({ received: true });
		},
	);
};

const initializeTransactionBodySchema = z.object({
	plan: z.string().optional(),
	product: z.string().optional(),
	amount: z.number().int().positive().optional(),
	currency: z.string().optional(),
	email: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	referenceId: z.string().optional(),
	callbackURL: z.string().optional(),
	quantity: z.number().int().positive().optional(),
	scheduleAtPeriodEnd: z.boolean().optional(),
	cancelAtPeriodEnd: z.boolean().optional(),
	prorateAndCharge: z.boolean().optional(),
});

export const initializeTransaction = <P extends string = "/paystack/initialize-transaction">(options: AnyPaystackOptions, path: P = "/paystack/initialize-transaction" as P) => {
	const subscriptionOptions = options.subscription;
	// However, for one-time payments, we might not strictly need subscription middleware
	// checking for existing subs, but let's keep it consistent for now.
	const useMiddlewares = subscriptionOptions?.enabled === true
		? [sessionMiddleware, originCheck, referenceMiddleware(options, "initialize-transaction")]
		: [sessionMiddleware, originCheck];

	return createAuthEndpoint(
		path,
		{
			method: "POST",
			body: initializeTransactionBodySchema,
			use: useMiddlewares,
		},
		async (ctx) => {
			const paystack = getPaystackOps(options.paystackClient);
			const { plan: planName, product: productName, amount: bodyAmount, currency, email, metadata: extraMetadata, callbackURL, quantity, scheduleAtPeriodEnd, cancelAtPeriodEnd, prorateAndCharge } = ctx.body;

			// 1. Validate Callback URL validation (same as before)
			if (callbackURL !== undefined && callbackURL !== null && callbackURL !== "") {
				const checkTrusted = () => {
					try {
						if (!callbackURL) return false;
						if (callbackURL.startsWith("/")) return true;
						const baseUrl =
							((ctx.context as Record<string, unknown>)?.baseURL as string | undefined) ??
							((ctx.request as unknown as { url?: string })?.url) ??
							"";
						if (!baseUrl) return false;
						const baseOrigin = new URL(baseUrl).origin;
						return new URL(callbackURL).origin === baseOrigin;
					} catch {
						return false;
					}
				};
				if (!checkTrusted()) {
					throw new APIError("FORBIDDEN", {
						message: "callbackURL is not a trusted origin.",
						status: 403,
					});
				}
			}

			// 2. Get User & Session
			const session = await getSessionFromCtx(ctx);
			if (!session) throw new APIError("UNAUTHORIZED");
			const user = session.user;

			// 3. Email Verification Check (only if subscription options enforce it)
			if (subscriptionOptions?.enabled === true && subscriptionOptions.requireEmailVerification === true && !user.emailVerified) {
				throw new APIError("BAD_REQUEST", {
					code: "EMAIL_VERIFICATION_REQUIRED",
					message: PAYSTACK_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED.message,
				});
			}

			// 4. Determine Payment Mode: Subscription (Plan) vs Product vs One-Time (Amount)
			let plan: PaystackPlan | null | undefined;
			let product: PaystackProduct | InputPaystackProduct | undefined;

			if (planName !== undefined && planName !== null && planName !== "") {
				if (subscriptionOptions?.enabled !== true) {
					throw new APIError("BAD_REQUEST", { message: "Subscriptions are not enabled." });
				}
				plan = await getPlanByName(options, planName) ?? undefined;
				if (!plan) {
					// Fallback: Check database for synced plans
					const nativePlan = await ctx.context.adapter.findOne<PaystackPlan>({
						model: "paystackPlan",
						where: [{ field: "name", value: planName }],
					});
					if (nativePlan) {
						plan = nativePlan;
					} else {
						// Try checking by planCode as well
						const nativePlanByCode = await ctx.context.adapter.findOne<PaystackPlan>({
							model: "paystackPlan",
							where: [{ field: "planCode", value: planName }],
						});
						plan = nativePlanByCode ?? undefined;
					}
				}
				if (!plan) {
					throw new APIError("BAD_REQUEST", {
						code: "SUBSCRIPTION_PLAN_NOT_FOUND",
						message: PAYSTACK_ERROR_CODES.SUBSCRIPTION_PLAN_NOT_FOUND.message,
						status: 400
					});
				}
			} else if (productName !== undefined && productName !== null && productName !== "") {
				if (typeof productName === 'string') {
					product ??= await getProductByName(options, productName) ?? undefined;
					// Fallback: Check database for synced products
					product ??= (await ctx.context.adapter.findOne<PaystackProduct>({
						model: "paystackProduct",
						where: [{ field: "name", value: productName }],
					})) ?? undefined;
				}
				if (!product) {
					throw new APIError("BAD_REQUEST", {
						message: `Product '${productName}' not found.`,
						status: 400
					});
				}
			} else if (bodyAmount === undefined || bodyAmount === null || bodyAmount === 0) {
				throw new APIError("BAD_REQUEST", {
					message: "Either 'plan', 'product', or 'amount' is required to initialize a transaction.",
					status: 400
				});
			}

			let amount = bodyAmount ?? (product as PaystackProduct | undefined)?.price;
			const finalCurrency = currency ?? (product as PaystackProduct | undefined)?.currency ?? plan?.currency ?? "NGN";

			const referenceIdFromCtx = (ctx.context as Record<string, unknown>).referenceId as string | undefined;
			const referenceId = (ctx.body.referenceId !== undefined && ctx.body.referenceId !== null && ctx.body.referenceId !== "")
				? ctx.body.referenceId
				: (referenceIdFromCtx !== undefined && referenceIdFromCtx !== null && referenceIdFromCtx !== "")
					? referenceIdFromCtx
					: (session.user as unknown as { id: string }).id;

			// Handle scheduleAtPeriodEnd for existing subscriptions
			if (plan && scheduleAtPeriodEnd === true) {
				const existingSub = await getOrganizationSubscription(ctx, referenceId);
				if (existingSub?.status === "active") {
					await ctx.context.adapter.update({
						model: "subscription",
						where: [{ field: "id", value: existingSub.id }],
						update: {
							pendingPlan: plan.name,
							updatedAt: new Date(),
						},
					});
					return ctx.json({
						status: "success",
						message: "Plan change scheduled at period end.",
						scheduled: true,
					});
				}
			}

			// Handle cancelAtPeriodEnd for existing subscriptions
			if (cancelAtPeriodEnd === true) {
				const existingSub = await getOrganizationSubscription(ctx, referenceId);
				if (existingSub?.status === "active") {
					await ctx.context.adapter.update({
						model: "subscription",
						where: [{ field: "id", value: existingSub.id }],
						update: {
							cancelAtPeriodEnd: true,
							updatedAt: new Date(),
						},
					});

					return ctx.json({
						status: "success",
						message: "Subscription cancellation scheduled at period end.",
						scheduled: true,
					});
				}
			}

			// Calculate final amount considering seats if applicable
			// Calculate final amount considering seats if applicable
			if (plan && (plan.seatAmount !== undefined || 'seatPriceId' in plan)) {
				 
				const members = await ctx.context.adapter.findMany<Member>({
					model: "member",
					where: [{ field: "organizationId", value: referenceId }],
				});
				const seatCount = members.length > 0 ? members.length : 1;
				const quantityToUse = quantity ?? seatCount;
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				amount = (plan.amount ?? 0) + (quantityToUse * (plan.seatAmount ?? (plan as any).seatPriceId ?? 0));
			}

			let url: string | undefined;
			let reference: string | undefined;
			let accessCode: string | undefined;

			// Check trial eligibility - prevent trial abuse
			let trialStart: Date | undefined;
			let trialEnd: Date | undefined;
			if (plan?.freeTrial?.days !== undefined && plan.freeTrial.days !== null && plan.freeTrial.days > 0) {
				// Check if user/referenceId has ever had a trial
				const previousTrials = await ctx.context.adapter.findMany<Subscription>({
					model: "subscription",
					where: [{ field: "referenceId", value: referenceId }],
				});
				const hadTrial = previousTrials?.some(
					(sub: Subscription) => (sub.trialStart !== undefined && sub.trialStart !== null) || (sub.trialEnd !== undefined && sub.trialEnd !== null) || sub.status === "trialing"
				);

				if (!hadTrial) {
					trialStart = new Date();
					trialEnd = new Date();
					trialEnd.setDate(trialEnd.getDate() + plan.freeTrial.days);
				}
			}

			try {
				// Determine Customer Email & Code (Organization support)
				let targetEmail = (email !== undefined && email !== null && email !== "") ? email : user.email;
				let paystackCustomerCode = (user as unknown as { paystackCustomerCode?: string }).paystackCustomerCode;

				if (options.organization?.enabled === true && referenceId !== undefined && referenceId !== null && referenceId !== "" && referenceId !== user.id) {
					const org = await ctx.context.adapter.findOne({
						model: "organization",
						where: [{ field: "id", value: referenceId }],
					});
					if (org !== undefined && org !== null) {
						// Prefer organization's existing Paystack customer code
						if (org.paystackCustomerCode !== undefined && org.paystackCustomerCode !== null && org.paystackCustomerCode !== "") {
							paystackCustomerCode = org.paystackCustomerCode;
						}
						if (org.email !== undefined && org.email !== null && org.email !== "") {
							targetEmail = org.email;
						} else {
							// Fallback: Use Organization Owner Email
							const ownerMember = await ctx.context.adapter.findOne<Member>({
								model: "member",
								where: [
									{ field: "organizationId", value: referenceId },
									{ field: "role", value: "owner" }
								]
							});

							if (ownerMember) {
								const ownerUser = await ctx.context.adapter.findOne<User>({
									model: "user",
									where: [{ field: "id", value: ownerMember.userId }]
								});

								if (ownerUser?.email !== undefined && ownerUser?.email !== null && ownerUser?.email !== "") {
									targetEmail = ownerUser.email;
								}
							}
						}
					}
				}

				// Construct Metadata
				const metadata = JSON.stringify({
					referenceId,
					userId: user.id,
					plan: plan?.name.toLowerCase(), // Undefined for one-time
					product: product?.name.toLowerCase(),
					isTrial: !!trialStart,
					trialEnd: trialEnd?.toISOString(),
					...extraMetadata,
				});

				const initBody: Record<string, unknown> & { email?: string; amount?: number; plan?: string; invoice_limit?: number } = {
					email: targetEmail,
					callback_url: callbackURL,
					metadata,
					// If plan/product exists, use its currency; otherwise fallback to provided or default
					currency: finalCurrency,
					quantity,
				};

				// Sync/Update Customer: ensure email matches if code exists
				if (paystackCustomerCode !== undefined && paystackCustomerCode !== null && paystackCustomerCode !== "") {
					try {
						const ops = getPaystackOps(options.paystackClient);
						// Only update if email is present
						if (initBody.email !== undefined && initBody.email !== null && initBody.email !== "") {
							await ops.customerUpdate(paystackCustomerCode, { email: initBody.email });
						}
					} catch (_e: unknown) {
						// Ignore sync errors
					}
				}

				// Handle prorateAndCharge for existing active subscriptions
				if (plan && prorateAndCharge === true) {
					const existingSub = await getOrganizationSubscription(ctx, referenceId);
					if (existingSub?.status === "active" && existingSub.paystackAuthorizationCode !== null && existingSub.paystackAuthorizationCode !== undefined && existingSub.paystackSubscriptionCode !== null && existingSub.paystackSubscriptionCode !== undefined) {
						// 1. Calculate remaining days
						const now = new Date();
						const periodEndLocal = existingSub.periodEnd ? new Date(existingSub.periodEnd) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // fallback 30 days
						const periodStartLocal = existingSub.periodStart ? new Date(existingSub.periodStart) : now;

						const totalDays = Math.max(1, Math.ceil((periodEndLocal.getTime() - periodStartLocal.getTime()) / (1000 * 60 * 60 * 24)));
						const remainingDays = Math.max(0, Math.ceil((periodEndLocal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

						// 2. Fetch old plan/amount
						let oldAmount = 0;
						if (existingSub.plan) {
							const oldPlan = (await getPlanByName(options, existingSub.plan)) ?? (await ctx.context.adapter.findOne<PaystackPlan>({ model: "paystackPlan", where: [{ field: "name", value: existingSub.plan }] }));
							if (oldPlan) {
								const oldSeatCount = existingSub.seats ?? 1;
								oldAmount = (oldPlan.amount ?? 0) + (oldSeatCount * (oldPlan.seatAmount ?? (oldPlan as any).seatPriceId ?? 0));
							}
						}

						// 3. Calculate new total amount
						let membersCount = 1;
						if (plan.seatAmount !== undefined || (plan as any).seatPriceId !== undefined) {
							const members = await ctx.context.adapter.findMany<Member>({
								model: "member",
								where: [{ field: "organizationId", value: referenceId }],
							});
							membersCount = members.length > 0 ? members.length : 1;
						}
						const newSeatCount = quantity ?? existingSub.seats ?? membersCount;
						const newAmount = (plan.amount ?? 0) + (newSeatCount * (plan.seatAmount ?? (plan as any).seatPriceId ?? 0));

						// 4. Calculate Difference & Charge
						const costDifference = newAmount - oldAmount;
						if (costDifference > 0 && remainingDays > 0) {
							const proratedAmount = Math.round((costDifference / totalDays) * remainingDays);
							// Ensure minimum Paystack charge limit is met (50 NGN -> 5000)
							if (proratedAmount >= 5000) {
								const ops = getPaystackOps(options.paystackClient);
								const chargeResRaw = await ops.transactionChargeAuthorization({
									email: targetEmail,
									amount: proratedAmount,
									authorization_code: existingSub.paystackAuthorizationCode,
									reference: `prorate_${Date.now()}_${Math.random().toString(36).substring(7)}`,
									metadata: {
										type: "proration",
										referenceId,
										newPlan: plan.name,
										oldPlan: existingSub.plan,
										remainingDays,
									} as Record<string, unknown>,
								});
								const sdkRes = unwrapSdkResult<PaystackTransactionResponse>(chargeResRaw);

								const actualStatus = sdkRes?.status;

								if (actualStatus !== "success") {
									throw new APIError("BAD_REQUEST", { message: "Failed to process prorated charge via saved authorization." });
								}
							}
						}

						// 5. Update Subscription Future Cycle in Paystack
						const ops = getPaystackOps(options.paystackClient);
						await ops.subscriptionUpdate({
							code: existingSub.paystackSubscriptionCode,
							amount: newAmount,
							plan: plan.planCode,
						});

						// 6. Update Local DB
						await ctx.context.adapter.update({
							model: "subscription",
							where: [{ field: "id", value: existingSub.id }],
							update: {
								plan: plan.name,
								seats: newSeatCount,
								updatedAt: new Date(),
							},
						});

						return ctx.json({
							status: "success",
							message: "Subscription successfully upgraded with prorated charge.",
							prorated: true,
						});
					}
				}

				if (plan) {
					// Subscription Flow
					if (trialStart) {
						// Trial Flow: Authorize card with minimum amount, don't start sub yet
						initBody.amount = 5000; // 50 NGN (minimum allowed)
						// Do NOT set initBody.plan
					} else {
						// Standard Flow
						initBody.plan = plan.planCode;
						initBody.invoice_limit = plan.invoiceLimit;
						// Paystack requires amount even with planCode (it uses plan's stored amount)
						// For local plans without planCode, use finalAmount; for planCode plans, use plan.amount or override
						let finalAmount: number;
						if (amount !== undefined && amount !== null) {
							// amount was calculated via seat-based logic or provided as override
							finalAmount = amount;
							// We force quantity to 1 in the Paystack call because our amount already includes the quantity multiplier
							initBody.quantity = 1;
						} else {
							// Standard Flow: Plan Price * Quantity
							finalAmount = (plan.amount ?? 50000) * (quantity ?? 1);
						}
						initBody.amount = Math.max(Math.round(finalAmount), 50000);
					}
				} else {
					// One-Time Payment Flow
					if (amount === undefined || amount === null || amount === 0) throw new APIError("BAD_REQUEST", { message: "Amount is required for one-time payments" });
					initBody.amount = Math.round(amount);
				}

				const initRaw = await paystack.transactionInitialize(initBody as unknown as Parameters<typeof paystack.transactionInitialize>[0]);
				const sdkRes = unwrapSdkResult<PaystackTransactionResponse>(initRaw);
				
				url = (sdkRes as any)?.authorization_url ?? (sdkRes?.data as any)?.authorization_url;
				reference = (sdkRes as any)?.reference ?? (sdkRes?.data as any)?.reference;
				accessCode = (sdkRes as any)?.access_code ?? (sdkRes?.data as any)?.access_code;
			} catch (error: unknown) {
				(ctx as unknown as { context: { logger: { error: (msg: string, err: unknown) => void } } }).context.logger.error("Failed to initialize Paystack transaction", error);
				throw new APIError("BAD_REQUEST", {
					code: "FAILED_TO_INITIALIZE_TRANSACTION",
					message: (error as Error)?.message ?? PAYSTACK_ERROR_CODES.FAILED_TO_INITIALIZE_TRANSACTION.message,
				});
			}

			// 6. Record Transaction & Subscription
			await ctx.context.adapter.create({
				model: "paystackTransaction",
				data: {
					reference: reference!,
					referenceId,
					userId: user.id,
					amount: amount ?? 0,
					currency: plan?.currency ?? currency ?? "NGN",
					status: "pending",
					plan: plan?.name.toLowerCase(),
					product: product?.name.toLowerCase(),
					metadata: extraMetadata ? JSON.stringify(extraMetadata) : undefined,
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			});

			if (plan !== undefined && plan !== null) {
				// Re-fetch customer code if it wasn't available before (though we didn't force-create it here)
				// For now, use what we have (user's or org's)
				let storedCustomerCode = (user as unknown as { paystackCustomerCode?: string }).paystackCustomerCode;
				if (options.organization?.enabled === true && referenceId !== user.id) {
					const org = await ctx.context.adapter.findOne({
						model: "organization",
						where: [{ field: "id", value: referenceId }],
					});
					if (org?.paystackCustomerCode) {
						storedCustomerCode = org.paystackCustomerCode;
					}
				}

				const newSubscription = await ctx.context.adapter.create<Subscription>({
					model: "subscription",
					data: {
						plan: plan.name.toLowerCase(),
						referenceId,
						paystackCustomerCode: storedCustomerCode,
						paystackTransactionReference: reference,
						status: trialStart ? "trialing" : "incomplete",
						seats: quantity,
						trialStart,
						trialEnd,
					},
				});

				// Call trial start hook if trial was granted
				if ((trialStart !== undefined && trialStart !== null) && newSubscription !== null && plan.freeTrial?.onTrialStart !== undefined && plan.freeTrial?.onTrialStart !== null) {
					await plan.freeTrial.onTrialStart(newSubscription);
				}
			}

			return ctx.json({
				url,
				reference,
				accessCode,
				redirect: true,
			});
		},
	);
};

// Aliases for Client DX Parity
export const createSubscription = (options: AnyPaystackOptions) =>
	initializeTransaction(options, "/paystack/create-subscription");
export const upgradeSubscription = (options: AnyPaystackOptions) =>
	initializeTransaction(options, "/paystack/upgrade-subscription");
export const restoreSubscription = (options: AnyPaystackOptions) => {
	// Alias for enable
	return enablePaystackSubscription(options, "/paystack/restore-subscription");
};
export const cancelSubscription = (options: AnyPaystackOptions) => {
	// Alias for disable
	return disablePaystackSubscription(options, "/paystack/cancel-subscription");
};


export const verifyTransaction = <P extends string = "/paystack/verify-transaction">(options: AnyPaystackOptions, path: P = "/paystack/verify-transaction" as P) => {
	const verifyBodySchema = z.object({
		reference: z.string(),
	});

	const subscriptionOptions = options.subscription;
	const useMiddlewares = subscriptionOptions?.enabled === true
		? [sessionMiddleware, originCheck, referenceMiddleware(options, "verify-transaction")]
		: [sessionMiddleware, originCheck];

	return createAuthEndpoint(
		path,
		{
			method: "POST",
			body: verifyBodySchema,
			use: useMiddlewares,
		},
		async (ctx) => {
			const paystack = getPaystackOps(options.paystackClient);
			let verifyRes: unknown;
			try {
				const verifyRaw = await paystack.transactionVerify(ctx.body.reference);
				verifyRes = unwrapSdkResult<Record<string, unknown>>(verifyRaw);
			} catch (error: unknown) {
				ctx.context.logger.error("Failed to verify Paystack transaction", error);
				throw new APIError("BAD_REQUEST", {
					code: "FAILED_TO_VERIFY_TRANSACTION",
					message:
						(error as Error)?.message ?? PAYSTACK_ERROR_CODES.FAILED_TO_VERIFY_TRANSACTION.message,
				});
			}
			const dataRaw = unwrapSdkResult<PaystackTransactionResponse>(verifyRes);
			const data = (dataRaw as any)?.data ?? dataRaw;
			const status = (data)?.status as string | undefined;
			const reference = (data)?.reference as string | undefined ?? ctx.body.reference;
			const paystackId = (data)?.id !== undefined && (data)?.id !== null ? String((data as { id: string | number }).id) : undefined;
			const authorizationCode = ((data)?.authorization as Record<string, unknown>)?.authorization_code as string | undefined;

			if (status === "success") {
				const session = await getSessionFromCtx(ctx);

				// Get the local transaction record to know the intended referenceId (Org or User)
				const txRecord = await ctx.context.adapter.findOne<PaystackTransaction & { referenceId?: string }>({
					model: "paystackTransaction",
					where: [{ field: "reference", value: reference }],
				});

				// Trust the referenceId from the record, fallback to session user if missing
				const referenceId = txRecord?.referenceId ?? (session?.user as unknown as { id: string })?.id;

				// Authorization check: ensure the current user has access to this referenceId
				if (session !== null && session !== undefined && referenceId !== session.user.id) {
					const authRef = (subscriptionOptions as unknown as { authorizeReference: (data: unknown, ctx: unknown) => Promise<boolean> })?.authorizeReference;
					let authorized = false;
					if (authRef !== undefined && authRef !== null) {
						authorized = await authRef({
							user: session.user,
							session,
							referenceId,
							action: "verify-transaction"
						}, ctx);
					} else if (options.organization?.enabled === true) {
						const member = await ctx.context.adapter.findOne<Member>({
							model: "member",
							where: [
								{ field: "userId", value: session.user.id },
								{ field: "organizationId", value: referenceId }
							]
						});
						if (member) authorized = true;
					}

					if (!authorized) {
						throw new APIError("UNAUTHORIZED");
					}
				}

				try {
					await ctx.context.adapter.update({
						model: "paystackTransaction",
						update: {
							status: "success",
							paystackId,
							// Update with actual amount/currency from Paystack (for planCode subscriptions)
							...((data)?.amount ? { amount: (data).amount } : {}),
							...((data)?.currency ? { currency: (data).currency } : {}),
							updatedAt: new Date(),
						},
						where: [{ field: "reference", value: reference }],
					});


					const customer = (data)?.customer;
					const paystackCustomerCodeFromPaystack = (customer && typeof customer === "object")
						? (customer as Record<string, unknown>).customer_code as string | undefined
						: undefined;
					if (paystackCustomerCodeFromPaystack && referenceId) {
						let isOrg = options.organization?.enabled === true && referenceId.startsWith("org_");
						if (!isOrg && options.organization?.enabled === true) {
							isOrg = (await ctx.context.adapter.findOne({
								model: "organization",
								where: [{ field: "id", value: referenceId }],
							})) !== null;
						}

						if (isOrg) {
							await ctx.context.adapter.update({
								model: "organization",
								update: { paystackCustomerCode: paystackCustomerCodeFromPaystack },
								where: [{ field: "id", value: referenceId }],
							});
						} else {
							await ctx.context.adapter.update({
								model: "user",
								update: { paystackCustomerCode: paystackCustomerCodeFromPaystack },
								where: [{ field: "id", value: referenceId }],
							});
						}
					}

					// Decrement product quantity if applicable
					const transaction = await ctx.context.adapter.findOne<PaystackTransaction>({
						model: "paystackTransaction",
						where: [{ field: "reference", value: reference }],
					});
					if (transaction?.product) {
						await syncProductQuantityFromPaystack(ctx, transaction.product, options.paystackClient);
					}

					// Check for trial activation
					let isTrial = false;
					let trialEnd: string | undefined;
					let targetPlan: string | undefined;

					if ((data)?.metadata) {
						const metaRaw = (data).metadata;
						const meta = typeof metaRaw === "string" ? JSON.parse(metaRaw) : metaRaw as Record<string, unknown>;
						isTrial = meta.isTrial === true || meta.isTrial === "true";

						trialEnd = meta.trialEnd as string | undefined;

						targetPlan = meta.plan as string | undefined;
					}

					let paystackSubscriptionCode: string | undefined;

					if (isTrial === true && targetPlan && trialEnd) {
					// Trial Flow: Create subscription with future start date using auth code
						const email = ((data)?.customer as Record<string, unknown>)?.email as string | undefined;

						// We need the planCode. We have the plan NAME in metadata (lowercased).
						const plans = await getPlans(subscriptionOptions);
						const planConfig = plans.find(p => p.name.toLowerCase() === targetPlan?.toLowerCase());

						// For local plans (no planCode), generate a local subscription code
						if (planConfig && !planConfig.planCode) {
							paystackSubscriptionCode = `LOC_${reference}`;
						}

						if (authorizationCode && email && planConfig?.planCode) {
							const subResRaw = await paystack.subscriptionCreate({
								customer: email,
								plan: planConfig.planCode,
								authorization: authorizationCode,
								start_date: trialEnd
							});
							const subRes = unwrapSdkResult<PaystackSubscriptionResponse>(subResRaw);
							const cleanSubData = (subRes as any)?.data ?? subRes;

							paystackSubscriptionCode = (cleanSubData)?.subscription_code;
						}
					} else if (!isTrial) {
						const planFromPaystack = (data)?.plan;
						const planCodeFromPaystack = planFromPaystack?.plan_code;

						if (!planCodeFromPaystack) {
						// Local Plan
							paystackSubscriptionCode = `LOC_${reference}`;
						} else {
						// Native Paystack subscription (if created during charge)
							paystackSubscriptionCode = ((data)?.subscription as Record<string, unknown> | undefined)?.subscription_code as string | undefined;
						}
					}


					const existingSubs = await ctx.context.adapter.findMany<Subscription>({
						model: "subscription",
						where: [{ field: "paystackTransactionReference", value: reference }],
					});
					let targetSub: Subscription | undefined;
					if (existingSubs && existingSubs.length > 0) {
						targetSub = existingSubs.find((s: Subscription) =>
							!referenceId || s.referenceId === referenceId
						);
					}

					let updatedSubscription: Subscription | null = null;
					if (targetSub) {
						updatedSubscription = await ctx.context.adapter.update<Subscription>({
							model: "subscription",
							update: {
								status: isTrial ? "trialing" : "active",
								periodStart: new Date(),
								updatedAt: new Date(),
								...(isTrial && trialEnd ? {
									trialStart: new Date(),
									trialEnd: new Date(trialEnd),
									periodEnd: new Date(trialEnd),
								} : {}),
								...(paystackSubscriptionCode ? { paystackSubscriptionCode } : {}),
								...(authorizationCode ? { paystackAuthorizationCode: authorizationCode } : {}),
							},
							where: [{ field: "id", value: targetSub.id }],
						});
					}

					if (updatedSubscription && subscriptionOptions?.enabled === true && "onSubscriptionComplete" in subscriptionOptions && typeof (subscriptionOptions as unknown as Record<string, unknown>).onSubscriptionComplete === "function") {
						const subOpts = subscriptionOptions;
						const plans = await getPlans(subOpts);
						const plan = plans.find(p => p.name.toLowerCase() === updatedSubscription.plan.toLowerCase());
						if (plan) {
							await (subscriptionOptions as unknown as { onSubscriptionComplete: (data: unknown, ctx: unknown) => Promise<void> }).onSubscriptionComplete({
								event: data,
								subscription: updatedSubscription,
								plan
							}, ctx);
						}
					}
				} catch (e: unknown) {
					ctx.context.logger.error(
						"Failed to update transaction/subscription after verification",
						e,
					);
				}
			}

			return ctx.json({
				status,
				reference,
				data,
			});
		},
	);
};

export const listSubscriptions = (options: AnyPaystackOptions) => {
	const listQuerySchema = z.object({
		referenceId: z.string().optional(),
	});

	const subscriptionOptions = options.subscription;
	const useMiddlewares = subscriptionOptions?.enabled === true
		? [sessionMiddleware, originCheck, referenceMiddleware(options, "list-subscriptions")]
		: [sessionMiddleware, originCheck];

	return createAuthEndpoint(
		"/paystack/list-subscriptions",
		{
			method: "GET",
			query: listQuerySchema,
			use: useMiddlewares,
		},
		async (ctx) => {
			if (subscriptionOptions?.enabled !== true) {
				throw new APIError("BAD_REQUEST", {
					message: "Subscriptions are not enabled in the Paystack options.",
				});
			}
			const session = await getSessionFromCtx(ctx);
			if (!session) throw new APIError("UNAUTHORIZED");
			const referenceIdPart = (ctx.context as Record<string, unknown>).referenceId as string | undefined;
			const queryRefId = ctx.query?.referenceId;
			const referenceId = referenceIdPart ?? queryRefId ?? (session.user as { id: string }).id;
			const res = await ctx.context.adapter.findMany<Subscription>({
				model: "subscription",
				where: [{ field: "referenceId", value: referenceId }],
			});
			return ctx.json({ subscriptions: res });
		},
	);
};

export const listTransactions = <P extends string = "/paystack/list-transactions">(options: AnyPaystackOptions, path: P = "/paystack/list-transactions" as P) => {
	const listQuerySchema = z.object({
		referenceId: z.string().optional(),
	});

	const subscriptionOptions = options.subscription;
	const useMiddlewares = subscriptionOptions?.enabled === true
		? [sessionMiddleware, originCheck, referenceMiddleware(options, "list-transactions")]
		: [sessionMiddleware, originCheck];

	return createAuthEndpoint(
		path,
		{
			method: "GET",
			query: listQuerySchema,
			use: useMiddlewares,
		},
		async (ctx) => {
			const session = await getSessionFromCtx(ctx);
			if (!session) throw new APIError("UNAUTHORIZED");
			const referenceId =
				((ctx.context as Record<string, unknown>).referenceId as string | undefined) ??
				(ctx.query?.referenceId) ??
				(session.user as { id: string }).id;
			const res = await ctx.context.adapter.findMany<PaystackTransaction>({
				model: "paystackTransaction",
				where: [{ field: "referenceId", value: referenceId }],
			});
			// Sort by createdAt desc locally if adapter doesn't support it well, 
			// but Better Auth adapters usually return in insertion order.
			// Let's sort to be sure.
			const sorted = res.sort((a: PaystackTransaction, b: PaystackTransaction) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
			return ctx.json({ transactions: sorted });
		},
	);
};

const enableDisableBodySchema = z.object({
	referenceId: z.string().optional(),
	subscriptionCode: z.string(),
	emailToken: z.string().optional(),
	atPeriodEnd: z.boolean().optional(),
});

function decodeBase64UrlToString(value: string): string {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized + "===".slice((normalized.length + 3) % 4);
	if (typeof (globalThis as unknown as { atob: unknown }).atob === "function") {
		return ((globalThis as unknown as { atob: (v: string) => string }).atob)(padded);
	}
	// eslint-disable-next-line no-restricted-globals
	return Buffer.from(padded, "base64").toString("utf8");
}

function tryGetEmailTokenFromSubscriptionManageLink(link: string): string | undefined {
	try {
		const url = new URL(link);
		const subscriptionToken = url.searchParams.get("subscription_token");
		if (subscriptionToken === undefined || subscriptionToken === null || subscriptionToken === "") return undefined;
		const parts = subscriptionToken.split(".");
		if (parts.length < 2) return undefined;
		const payloadJson = decodeBase64UrlToString(parts[1]);
		const payload = JSON.parse(payloadJson);
		return typeof payload?.email_token === "string" ? payload.email_token : undefined;
	} catch {
		return undefined;
	}
}

export const disablePaystackSubscription = <P extends string = "/paystack/disable-subscription">(options: AnyPaystackOptions, path: P = "/paystack/disable-subscription" as P) => {
	const subscriptionOptions = options.subscription;
	const useMiddlewares = subscriptionOptions?.enabled === true
		? [sessionMiddleware, originCheck, referenceMiddleware(options, "disable-subscription")]
		: [sessionMiddleware, originCheck];

	return createAuthEndpoint(
		path,
		{ method: "POST", body: enableDisableBodySchema, use: useMiddlewares },
		async (ctx) => {
			const { subscriptionCode, atPeriodEnd } = ctx.body;
			const paystack = getPaystackOps(options.paystackClient);
			try {
				if (subscriptionCode.startsWith("LOC_")) {
					const sub = await ctx.context.adapter.findOne<Subscription>({
						model: "subscription",
						where: [{ field: "paystackSubscriptionCode", value: subscriptionCode }],
					});

					if (sub) {
						await ctx.context.adapter.update({
							model: "subscription",
							update: {
								status: atPeriodEnd === false ? "canceled" : "active",
								cancelAtPeriodEnd: atPeriodEnd !== false,
								updatedAt: new Date(),
							},
							where: [{ field: "id", value: sub.id }],
						});
						return ctx.json({ status: "success" });
					}
					throw new APIError("BAD_REQUEST", { message: "Subscription not found" });
				}

				let emailToken = ctx.body.emailToken;
				let nextPaymentDate: string | undefined;

				// Always fetch subscription to get next_payment_date even if we have emailToken (unless passed? no, next_payment_date comes from paystack)
				// We need next_payment_date for cancelAtPeriodEnd logic
				try {
					const raw = await paystack.subscriptionFetch(subscriptionCode);
					const fetchRes = unwrapSdkResult<PaystackSubscriptionResponse>(raw);
					const data = (fetchRes as any)?.data ?? fetchRes;

					if (emailToken === undefined || emailToken === null || emailToken === "") {
						emailToken = (data as Record<string, unknown>)?.email_token as string | undefined;
					}
					nextPaymentDate = (data as Record<string, unknown>)?.next_payment_date as string | undefined;
				} catch {
					// ignore fetch failure? If we can't fetch, we might miss next_payment_date.
				}

				if (!emailToken) {
					try {
						const raw = await paystack.subscriptionManageLink(subscriptionCode);
						const linkRes = unwrapSdkResult<Record<string, unknown>>(raw);
						const data = (linkRes as any)?.data ?? linkRes;
						const link = typeof data === "string" ? data : (data)?.link;

						if (link !== undefined && link !== null && link !== "") {
							emailToken = tryGetEmailTokenFromSubscriptionManageLink(link);
						}
					} catch {
						// ignore
					}
				}

				if (!emailToken) {
					throw new Error("Could not retrieve email_token for subscription disable.");
				}

				await paystack.subscriptionDisable({ code: subscriptionCode, token: emailToken });

				// Implement Cancel at Period End logic
				// Paystack "disable" stops future charges.
				// We keep status as "active" but set cancelAtPeriodEnd = true

				// Duplicate removed

				const periodEnd = nextPaymentDate ? new Date(nextPaymentDate) : undefined;

				const sub = await ctx.context.adapter.findOne<Subscription>({
					model: "subscription",
					where: [{ field: "paystackSubscriptionCode", value: subscriptionCode }],
				});

				if (sub) {
					await ctx.context.adapter.update({
						model: "subscription",
						update: {
							status: atPeriodEnd === false ? "canceled" : "active",
							cancelAtPeriodEnd: atPeriodEnd !== false,
							periodEnd,
							updatedAt: new Date(),
						},
						where: [{ field: "id", value: sub.id }],
					});
				} else {
					// This is unexpected if we are disabling a subscription that should exist
					ctx.context.logger.warn(`Could not find subscription with code ${subscriptionCode} to disable`);
				}

				return ctx.json({ status: "success" });
			} catch (error: unknown) {
				ctx.context.logger.error("Failed to disable subscription", error);
				throw new APIError("BAD_REQUEST", {
					code: "FAILED_TO_DISABLE_SUBSCRIPTION",
					message:
						(error as Error)?.message ?? PAYSTACK_ERROR_CODES.FAILED_TO_DISABLE_SUBSCRIPTION.message,
				});
			}
		},
	);
};

export const enablePaystackSubscription = <P extends string = "/paystack/enable-subscription">(options: AnyPaystackOptions, path: P = "/paystack/enable-subscription" as P) => {
	const subscriptionOptions = options.subscription;
	const useMiddlewares = subscriptionOptions?.enabled === true
		? [sessionMiddleware, originCheck, referenceMiddleware(options, "enable-subscription")]
		: [sessionMiddleware, originCheck];

	return createAuthEndpoint(
		path,
		{ method: "POST", body: enableDisableBodySchema, use: useMiddlewares },
		async (ctx) => {
			const { subscriptionCode } = ctx.body;
			const paystack = getPaystackOps(options.paystackClient);
			try {
				let emailToken = ctx.body.emailToken;
				if (!emailToken) {
					try {
						const raw = await paystack.subscriptionFetch(subscriptionCode);
						const fetchRes = unwrapSdkResult<PaystackSubscriptionResponse>(raw);
						const data = (fetchRes as any)?.data ?? fetchRes;
						emailToken = (data)?.email_token;
					} catch {
						// ignore; try manage-link fallback below
					}
				}

				if (!emailToken) {
					try {
						const raw = await paystack.subscriptionManageLink(subscriptionCode);
						const linkRes = unwrapSdkResult<Record<string, unknown>>(raw);
						const data = (linkRes as any)?.data ?? linkRes;
						const link = typeof data === "string" ? data : (data)?.link;

						if (link) {
							emailToken = tryGetEmailTokenFromSubscriptionManageLink(link);
						}
					} catch {
						// ignore
					}
				}

				if (!emailToken) {
					throw new APIError("BAD_REQUEST", { message: "Could not retrieve email_token for subscription enable." });
				}

				await paystack.subscriptionEnable({ code: subscriptionCode, token: emailToken });

				// Update local status immediately
				await ctx.context.adapter.update({
					model: "subscription",
					update: {
						status: "active",
						updatedAt: new Date(),
					},
					where: [{ field: "paystackSubscriptionCode", value: subscriptionCode }],
				});

				return ctx.json({ status: "success" });
			} catch (error: unknown) {
				ctx.context.logger.error("Failed to enable subscription", error);
				throw new APIError("BAD_REQUEST", {
					code: "FAILED_TO_ENABLE_SUBSCRIPTION",
					message:
						(error as Error)?.message ?? PAYSTACK_ERROR_CODES.FAILED_TO_ENABLE_SUBSCRIPTION.message,
				});
			}
		},
	);
};

export const getSubscriptionManageLink = <P extends string = "/paystack/get-subscription-manage-link">(options: AnyPaystackOptions, path: P = "/paystack/get-subscription-manage-link" as P) => {
	const manageLinkQuerySchema = z.object({
		subscriptionCode: z.string(),
	});
	const subscriptionOptions = options.subscription;
	const useMiddlewares = subscriptionOptions?.enabled === true
		? [sessionMiddleware, originCheck, referenceMiddleware(options, "get-subscription-manage-link")]
		: [sessionMiddleware, originCheck];

	const handler = async (ctx: GenericEndpointContext) => {
		const { subscriptionCode } = ctx.query;

		// If it's a local mock subscription, return null link instead of error
		if (subscriptionCode.startsWith("LOC_") || subscriptionCode.startsWith("sub_local_")) {
			return ctx.json({ link: null, message: "Local subscriptions cannot be managed on Paystack" });
		}

		const paystack = getPaystackOps(options.paystackClient);
		try {
			const raw = await paystack.subscriptionManageLink(subscriptionCode);
			const res = unwrapSdkResult<Record<string, unknown>>(raw);
			const data = (res as any)?.data ?? res;

			const link = typeof data === "string" ? data : (data)?.link;

			return ctx.json({ link });
		} catch (error: unknown) {
			ctx.context.logger.error("Failed to get subscription manage link", error);
			throw new APIError("BAD_REQUEST", {
				message: (error as Error)?.message ?? "Failed to get subscription manage link",
			});
		}
	};

	return createAuthEndpoint(
		path,
		{
			method: "GET",
			query: manageLinkQuerySchema,
			use: useMiddlewares,
		},
		handler,
	);
};

export const syncProducts = (options: AnyPaystackOptions) => {
	return createAuthEndpoint(
		"/paystack/sync-products",
		{
			method: "POST",
			metadata: {
				...HIDE_METADATA,
			},
			disableBody: true,
			use: [sessionMiddleware],
		},
		async (ctx) => {
			const paystack = getPaystackOps(options.paystackClient);
			try {
				const raw = await paystack.productList();
				const res = unwrapSdkResult<PaystackProductResponse[]>(raw);
				const productsData = (res as any)?.data ?? res;

				if (!Array.isArray(productsData)) {
					return ctx.json({ status: "success", count: 0 });
				}

				for (const product of productsData) {
					const paystackId = String(product.id);
					const existing = await ctx.context.adapter.findOne<PaystackProduct>({
						model: "paystackProduct",
						where: [{ field: "paystackId", value: paystackId }],
					});

					const productData = {
						name: product.name,
						description: product.description,
						price: product.price,
						currency: product.currency,
						quantity: product.quantity,
						unlimited: product.unlimited,
						paystackId,
						slug: product.slug ?? product.name.toLowerCase().replace(/\s+/g, "-"),
						metadata: product.metadata ? JSON.stringify(product.metadata) : undefined,
						updatedAt: new Date(),
					};

					if (existing) {
						await ctx.context.adapter.update({
							model: "paystackProduct",
							update: productData,
							where: [{ field: "id", value: existing.id }],
						});
					} else {
						await ctx.context.adapter.create({
							model: "paystackProduct",
							data: {
								...productData,
								createdAt: new Date(),
							},
						});
					}
				}

				return ctx.json({ status: "success", count: productsData.length });
			} catch (error: unknown) {
				ctx.context.logger.error("Failed to sync products", error);
				throw new APIError("BAD_REQUEST", {
					message: (error as Error)?.message ?? "Failed to sync products",
				});
			}
		},
	);
};

export const listProducts = (_options: AnyPaystackOptions) => {
	return createAuthEndpoint(
		"/paystack/list-products",
		{
			method: "GET",
			metadata: {
				openapi: {
					operationId: "listPaystackProducts",
				},
			},
		},
		async (ctx) => {
			const res = await ctx.context.adapter.findMany<PaystackProduct>({
				model: "paystackProduct",
			});
			const sorted = res.sort((a: PaystackProduct, b: PaystackProduct) => a.name.localeCompare(b.name));
			return ctx.json({ products: sorted });
		}
	);
};

export const syncPlans = (options: AnyPaystackOptions) => {
	return createAuthEndpoint(
		"/paystack/sync-plans",
		{
			method: "POST",
			metadata: {
				...HIDE_METADATA,
			},
			disableBody: true,
			use: [sessionMiddleware],
		},
		async (ctx) => {
			const paystack = getPaystackOps(options.paystackClient);
			try {
				const raw = await paystack.planList();
				const res = unwrapSdkResult<Record<string, unknown>>(raw);
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const plansData = (res as any)?.data ?? res;

				if (!Array.isArray(plansData)) {
					return ctx.json({ status: "success", count: 0 });
				}

				for (const plan of plansData) {
					const paystackId = String(plan.id);
					const existing = await ctx.context.adapter.findOne<PaystackPlan>({
						model: "paystackPlan",
						where: [{ field: "paystackId", value: paystackId }],
					});

					const planData = {
						name: plan.name,
						description: plan.description,
						amount: plan.amount,
						currency: plan.currency,
						interval: plan.interval,
						planCode: plan.plan_code,
						paystackId,
						metadata: plan.metadata ? JSON.stringify(plan.metadata) : undefined,
						updatedAt: new Date(),
					};

					if (existing) {
						await ctx.context.adapter.update({
							model: "paystackPlan",
							update: planData,
							where: [{ field: "id", value: existing.id }],
						});
					} else {
						await ctx.context.adapter.create({
							model: "paystackPlan",
							data: {
								...planData,
								createdAt: new Date(),
							},
						});
					}
				}

				return ctx.json({ status: "success", count: plansData.length });
			} catch (error: unknown) {
				ctx.context.logger.error("Failed to sync plans", error);
				throw new APIError("BAD_REQUEST", {
					message: (error as Error)?.message ?? "Failed to sync plans",
				});
			}
		},
	);
};

export const listPlans = (_options: AnyPaystackOptions) => {
	return createAuthEndpoint(
		"/paystack/list-plans",
		{
			method: "GET",
			metadata: {
				...HIDE_METADATA,
			},
			use: [sessionMiddleware],
		},
		async (ctx) => {
			try {
				const plans = await ctx.context.adapter.findMany<PaystackPlan>({
					model: "paystackPlan",
				});
				return ctx.json({ plans });
			} catch (error: unknown) {
				ctx.context.logger.error("Failed to list plans", error);
				throw new APIError("BAD_REQUEST", {
					message: (error as Error)?.message ?? "Failed to list plans",
				});
			}
		},
	);
};

export const getConfig = (options: AnyPaystackOptions) => {
	return createAuthEndpoint(
		"/paystack/get-config",
		{
			method: "GET",
			metadata: {
				openapi: {
					operationId: "getPaystackConfig",
				},
			},
		},
		async (ctx: any) => {
			const plans = options.subscription?.enabled === true
				? await getPlans(options.subscription)
				: [];
			const products = await getProducts(options.products);
			return ctx.json({
				plans,
				products,
			});
		}
	);
};

export { PAYSTACK_ERROR_CODES };
export const chargeRecurringSubscription = (options: AnyPaystackOptions) => {
	return createAuthEndpoint(
		"/paystack/charge-recurring",
		{
			method: "POST",
			body: z.object({
				subscriptionId: z.string(),
				amount: z.number().optional(),
			}),
		},
		async (ctx) => {
			const { subscriptionId, amount: bodyAmount } = ctx.body;
			const subscription = await ctx.context.adapter.findOne<Subscription>({
				model: "subscription",
				where: [{ field: "id", value: subscriptionId }],
			});

			if (!subscription) {
				throw new APIError("NOT_FOUND", { message: "Subscription not found" });
			}

			if (!subscription.paystackAuthorizationCode) {
				throw new APIError("BAD_REQUEST", { message: "No authorization code found for this subscription" });
			}

			const plans = await getPlans(options.subscription);
			const plan = plans.find((p) => p.name.toLowerCase() === subscription.plan.toLowerCase());

			if (!plan) {
				throw new APIError("NOT_FOUND", { message: "Plan not found" });
			}

			const amount = bodyAmount ?? plan.amount;
			if (amount === undefined || amount === null) {
				throw new APIError("BAD_REQUEST", { message: "Plan amount is not defined" });
			}

			let email: string | null | undefined;
			if (subscription.referenceId) {
				// Try to find user or org
				const user = await ctx.context.adapter.findOne<User>({
					model: "user",
					where: [{ field: "id", value: subscription.referenceId }],
				});
				if (user) {
					email = user.email;
				} else if (options.organization?.enabled === true) {
					// Check org owner email if referenceId is organizationId
					const ownerMember = await ctx.context.adapter.findOne<Member>({
						model: "member",
						where: [
							{ field: "organizationId", value: subscription.referenceId },
							{ field: "role", value: "owner" },
						],
					});
					if (ownerMember) {
						const ownerUser = await ctx.context.adapter.findOne<User>({
							model: "user",
							where: [{ field: "id", value: ownerMember.userId }],
						});
						email = ownerUser?.email;
					}
				}
			}

			// No fallback needed since referenceId is required and handled above
			if (email === undefined || email === null || email === "") {
				throw new APIError("NOT_FOUND", { message: "User email not found" });
			}

			const finalCurrency = plan.currency ?? "NGN";
			if (!validateMinAmount(amount, finalCurrency)) {
				throw new APIError("BAD_REQUEST", {
					message: `Amount ${amount} is less than the minimum required for ${finalCurrency}.`,
					status: 400
				});
			}

			const paystack = getPaystackOps(options.paystackClient);
			const chargeResRaw = await paystack.transactionChargeAuthorization({
				email,
				amount,
				authorization_code: subscription.paystackAuthorizationCode,
				currency: plan.currency as any,
				metadata: {
					subscriptionId,
					referenceId: subscription.referenceId,
					plan: plan.name,
				},
			});

			const dataRaw = unwrapSdkResult<PaystackTransactionResponse>(chargeResRaw);
			const chargeData = (dataRaw as any)?.data ?? dataRaw;

			if (chargeData?.status === "success" || (dataRaw as any)?.status === "success") {
				const now = new Date();
				const nextPeriodEnd = getNextPeriodEnd(now, plan.interval ?? "monthly");

				await ctx.context.adapter.update({
					model: "subscription",
					update: {
						periodStart: now,
						periodEnd: nextPeriodEnd,
						updatedAt: now,
						// Record the last transaction reference if available
						paystackTransactionReference: chargeData.reference ?? (dataRaw as any)?.reference,
					},
					where: [{ field: "id", value: subscription.id }],
				});

				return ctx.json({ status: "success", data: chargeData });
			}

			return ctx.json({ status: "failed", data: chargeData }, { status: 400 });
		},
	);
};
