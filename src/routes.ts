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

import type { InputPaystackTransaction, InputPaystackProduct, InputSubscription, PaystackOptions, PaystackTransaction, Subscription, Organization, Member, User, PaystackClientLike, PaystackWebhookPayload } from "./types";
import {
	syncProductQuantityFromPaystack,
	getPlanByName,
	getPlans,
	getProductByName,
	getProducts,
	validateMinAmount,
	getNextPeriodEnd,
} from "./utils";
import type { PaystackPlan, PaystackProduct } from "./types";
import { referenceMiddleware } from "./middleware";
import { getPaystackOps, unwrapSdkResult } from "./paystack-sdk";

type AnyPaystackOptions = PaystackOptions<PaystackClientLike>;

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
		async (ctx: any) => {
			const request = (ctx as GenericEndpointContext & { requestClone?: Request }).requestClone ?? ctx.request;
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
						await (ctx.context.adapter).update({
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
						const transaction = await (ctx.context.adapter).findOne({
							model: "paystackTransaction",
							where: [{ field: "reference", value: reference }],
						}) as PaystackTransaction | null;
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
						await (ctx.context.adapter).update({
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
						const payloadData = data as any;
						const subscriptionCode =
							payloadData?.subscription_code ??
							payloadData?.subscription?.subscription_code ??
							payloadData?.code;
						const customerCode =
							payloadData?.customer?.customer_code ??
							payloadData?.customer_code ??
							payloadData?.customer?.code;
						const planCode =
							payloadData?.plan?.plan_code ?? payloadData?.plan_code ?? payloadData?.plan;

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
								const matches = await (ctx.context.adapter).findMany({
									model: "subscription",
									where: where as { field: string; value: string | number | boolean | null }[],
								}) as Subscription[];
								const subscription = (matches !== undefined && matches !== null) ? matches[0] : undefined;
								if (subscription !== undefined && subscription !== null) {
									await (ctx.context.adapter).update({
										model: "subscription",
										update: {
											paystackSubscriptionCode: subscriptionCode,
											status: "active",
											updatedAt: new Date(),
											periodEnd: (payloadData?.next_payment_date !== undefined && payloadData?.next_payment_date !== null && payloadData?.next_payment_date !== "") ? new Date(payloadData.next_payment_date) : undefined,
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
						const payloadData = data as any;
						const subscriptionCode =
							payloadData?.subscription_code ??
							payloadData?.subscription?.subscription_code ??
							payloadData?.code;
						if (subscriptionCode !== undefined && subscriptionCode !== null && subscriptionCode !== "") {
							// Find the subscription first to get full data for the hook
							const existing = await (ctx.context.adapter).findOne({
								model: "subscription",
								where: [{ field: "paystackSubscriptionCode", value: subscriptionCode }],
							}) as Subscription | null;

							let newStatus = "canceled";
							const nextPaymentDate = (data)?.next_payment_date as string | undefined;
							const periodEnd = nextPaymentDate ? new Date(nextPaymentDate) : (existing?.periodEnd ? new Date(existing.periodEnd) : undefined);

							if (periodEnd && periodEnd > new Date()) {
								newStatus = "active";
							}

							await (ctx.context.adapter).update({
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
	amount: z.number().int().positive().optional(), // Amount in smallest currency unit (e.g., kobo)
	currency: z.string().optional(),
	email: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	referenceId: z.string().optional(),
	callbackURL: z.string().optional(),
	quantity: z.number().int().positive().optional(),
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
		async (ctx: any) => {
			const paystack = getPaystackOps(options.paystackClient);
			const { plan: planName, product: productName, amount: bodyAmount, currency, email, metadata: extraMetadata, callbackURL, quantity } = ctx.body;

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
					const nativePlan = await (ctx.context.adapter).findOne({
						model: "paystackPlan",
						where: [{ field: "name", value: planName }],
					}) as PaystackPlan | null;
					if (nativePlan) {
						plan = nativePlan;
					} else {
						// Try checking by planCode as well
						const nativePlanByCode = await (ctx.context.adapter).findOne({
							model: "paystackPlan",
							where: [{ field: "planCode", value: planName }],
						}) as PaystackPlan | null;
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
					product ??= (await (ctx.context.adapter).findOne({
						model: "paystackProduct",
						where: [{ field: "name", value: productName }],
					}) as PaystackProduct | null) ?? undefined;
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

			const amount = bodyAmount ?? product?.price;
			const finalCurrency = currency ?? product?.currency ?? plan?.currency ?? "NGN";

			let url: string | undefined;
			let reference: string | undefined;
			let accessCode: string | undefined;

			// 5. Prepare Payload

			const referenceIdFromCtx = (ctx.context as Record<string, unknown>).referenceId as string | undefined;
			const referenceId = (ctx.body.referenceId !== undefined && ctx.body.referenceId !== null && ctx.body.referenceId !== "")
				? ctx.body.referenceId
				: (referenceIdFromCtx !== undefined && referenceIdFromCtx !== null && referenceIdFromCtx !== "")
					? referenceIdFromCtx
					: (session.user as unknown as { id: string }).id;

			// Check trial eligibility - prevent trial abuse
			let trialStart: Date | undefined;
			let trialEnd: Date | undefined;
			if (plan?.freeTrial?.days !== undefined && plan.freeTrial.days !== null && plan.freeTrial.days > 0) {
				// Check if user/referenceId has ever had a trial
				const previousTrials = await (ctx.context.adapter).findMany({
					model: "subscription",
					where: [{ field: "referenceId", value: referenceId }],
				}) as Subscription[];
				const hadTrial = previousTrials?.some(
					(sub) => (sub.trialStart !== undefined && sub.trialStart !== null) || (sub.trialEnd !== undefined && sub.trialEnd !== null) || sub.status === "trialing"
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
					const org = await  (ctx.context.adapter).findOne({
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
							const ownerMember = await (ctx.context.adapter).findOne({
								model: "member",
								where: [
									{ field: "organizationId", value: referenceId },
									{ field: "role", value: "owner" }
								]
							}) as Member | null;

							if (ownerMember) {
								const ownerUser = await (ctx.context.adapter).findOne({
									model: "user",
									where: [{ field: "id", value: ownerMember.userId }]
								}) as User | null;

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
						// For local plans without planCode, use finalAmount; for planCode plans, use plan.amount or minimum
						const planAmount = amount ?? plan.amount ?? 50000; // 500 NGN minimum fallback
						initBody.amount = Math.max(Math.round(planAmount), 50000);
						if (quantity !== undefined && quantity !== null && quantity > 0) {
							initBody.amount = initBody.amount * quantity;
						}
					}
				} else {
					// One-Time Payment Flow
					if (amount === undefined || amount === null || amount === 0) throw new APIError("BAD_REQUEST", { message: "Amount is required for one-time payments" });
					initBody.amount = Math.round(amount);
				}

				const initRaw = await paystack.transactionInitialize(initBody as unknown as Parameters<typeof paystack.transactionInitialize>[0]);
				const initRes = unwrapSdkResult<Record<string, unknown>>(initRaw);
				let data =
					(initRes !== undefined && initRes !== null && typeof initRes === "object" && "status" in initRes && "data" in initRes)
						? (initRes).data
						: (initRes as Record<string, unknown> | undefined)?.data ?? initRes;

				if (data !== undefined && data !== null && typeof data === "object" && "status" in data && "data" in data) {
					data = (data as Record<string, unknown>).data;
				}
				url = (data as Record<string, unknown>)?.authorization_url as string | undefined;
				reference = (data as Record<string, unknown>)?.reference as string | undefined;
				accessCode = (data as Record<string, unknown>)?.access_code as string | undefined;
			} catch (error: unknown) {
				(ctx as unknown as { context: { logger: { error: (msg: string, err: unknown) => void } } }).context.logger.error("Failed to initialize Paystack transaction", error);
				throw new APIError("BAD_REQUEST", {
					code: "FAILED_TO_INITIALIZE_TRANSACTION",
					message: (error as Error)?.message ?? PAYSTACK_ERROR_CODES.FAILED_TO_INITIALIZE_TRANSACTION.message,
				});
			}

			// 6. Record Transaction & Subscription
			await (ctx.context.adapter).create({
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
					metadata: (extraMetadata !== undefined && extraMetadata !== null) ? JSON.stringify(extraMetadata) : undefined,
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			});

			if (plan !== undefined && plan !== null) {
				// Re-fetch customer code if it wasn't available before (though we didn't force-create it here)
				// For now, use what we have (user's or org's)
				let storedCustomerCode = (user as unknown as { paystackCustomerCode?: string }).paystackCustomerCode;
				if (options.organization?.enabled === true && referenceId !== user.id) {
					const org = await  (ctx.context.adapter).findOne({
						model: "organization",
						where: [{ field: "id", value: referenceId }],
					});
					if (org?.paystackCustomerCode !== undefined && org?.paystackCustomerCode !== null && org.paystackCustomerCode !== "") {
						storedCustomerCode = org.paystackCustomerCode;
					}
				}

				const newSubscription = await (ctx.context.adapter).create({
					model: "subscription",
					data: {
						plan: plan.name.toLowerCase(),
						referenceId,
						paystackCustomerCode: storedCustomerCode,
						paystackTransactionReference: reference,
						status: (trialStart !== undefined && trialStart !== null) ? "trialing" : "incomplete",
						seats: quantity,
						trialStart,
						trialEnd,
					},
				}) as Subscription | null;

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
		async (ctx: any) => {
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
			const data = unwrapSdkResult<Record<string, unknown>>(verifyRes);
			const status = (data)?.status as string | undefined;
			const reference = ((data)?.reference as string | undefined) ?? ctx.body.reference;
			const paystackId = (data)?.id !== undefined && (data)?.id !== null ? String((data as { id: string | number }).id) : undefined;
			const authorizationCode = ((data)?.authorization as Record<string, unknown>)?.authorization_code as string | undefined;

			if (status === "success") {
				const session = await getSessionFromCtx(ctx);

				// Get the local transaction record to know the intended referenceId (Org or User)
				const txRecord = await (ctx.context.adapter).findOne({
					model: "paystackTransaction",
					where: [{ field: "reference", value: reference }],
				}) as (Record<string, unknown> & { referenceId?: string }) | null;

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
						const member = await (ctx.context.adapter).findOne({
							model: "member",
							where: [
								{ field: "userId", value: session.user.id },
								{ field: "organizationId", value: referenceId }
							]
						}) as Member | null;
						if (member !== null && member !== undefined) authorized = true;
					}

					if (!authorized) {
						throw new APIError("UNAUTHORIZED");
					}
				}

				try {

					await (ctx.context.adapter).update({
						model: "paystackTransaction",
						update: {
							status: "success",
							paystackId,
							// Update with actual amount/currency from Paystack (for planCode subscriptions)
							...((data)?.amount !== undefined && (data)?.amount !== null ? { amount: (data).amount } : {}),
							...((data)?.currency !== undefined && (data)?.currency !== null ? { currency: (data).currency } : {}),
							updatedAt: new Date(),
						},
						where: [{ field: "reference", value: reference }],
					});

					const customer = (data)?.customer;
					const paystackCustomerCodeFromPaystack = (customer !== undefined && customer !== null && typeof customer === "object")
						? (customer as Record<string, unknown>).customer_code as string | undefined
						: undefined;
					if (paystackCustomerCodeFromPaystack !== undefined && paystackCustomerCodeFromPaystack !== null && paystackCustomerCodeFromPaystack !== "" && referenceId !== undefined && referenceId !== null && referenceId !== "") {
						const isOrg = options.organization?.enabled === true && ((referenceId.startsWith("org_")) || (await ctx.context.adapter.findOne({ model: "organization", where: [{ field: "id", value: referenceId }] }) !== null));

						if (isOrg === true) {
							await (ctx.context.adapter).update({
								model: "organization",
								update: { paystackCustomerCode: paystackCustomerCodeFromPaystack },
								where: [{ field: "id", value: referenceId }],
							});
						} else {
							await (ctx.context.adapter).update({
								model: "user",
								update: { paystackCustomerCode: paystackCustomerCodeFromPaystack },
								where: [{ field: "id", value: referenceId }],
							});
						}
					}

					// Decrement product quantity if applicable
					const transaction = await (ctx.context.adapter).findOne({
						model: "paystackTransaction",
						where: [{ field: "reference", value: reference }],
					}) as PaystackTransaction | null;
					if (transaction?.product) {
						await syncProductQuantityFromPaystack(ctx, transaction.product, options.paystackClient);
					}

					// Check for trial activation
					let isTrial = false;
					let trialEnd: string | undefined;
					let targetPlan: string | undefined;

					if ((data)?.metadata !== undefined && (data)?.metadata !== null) {
						const metaRaw = (data).metadata;
						const meta = typeof metaRaw === "string" ? JSON.parse(metaRaw) : metaRaw as Record<string, unknown>;
						isTrial = meta.isTrial === true || meta.isTrial === "true";

						trialEnd = meta.trialEnd as string | undefined;

						targetPlan = meta.plan as string | undefined;
					}

					let paystackSubscriptionCode: string | undefined;

					if (isTrial === true && (targetPlan !== undefined && targetPlan !== null && targetPlan !== "") && (trialEnd !== undefined && trialEnd !== null && trialEnd !== "")) {
						// Trial Flow: Create subscription with future start date using auth code
						const email = ((data)?.customer as Record<string, unknown>)?.email as string | undefined;

						// We need the planCode. We have the plan NAME in metadata (lowercased).
						const plans = await getPlans(subscriptionOptions);
						const planConfig = plans.find(p => p.name.toLowerCase() === targetPlan?.toLowerCase());

						// For local plans (no planCode), generate a local subscription code
						if (planConfig !== undefined && (planConfig.planCode === undefined || planConfig.planCode === null || planConfig.planCode === "")) {
							paystackSubscriptionCode = `LOC_${reference}`;
						}

						if ((authorizationCode !== undefined && authorizationCode !== null && authorizationCode !== "") && (email !== undefined && email !== null && email !== "") && (planConfig?.planCode !== undefined && planConfig?.planCode !== null && planConfig?.planCode !== "")) {
							const subRes = await paystack.subscriptionCreate({
								customer: email,
								plan: planConfig.planCode,
								authorization: authorizationCode,
								start_date: trialEnd
							});
							const subData = unwrapSdkResult<Record<string, unknown>>(subRes);
							const cleanSubData = (subData as { data?: Record<string, unknown> })?.data ?? subData;

							paystackSubscriptionCode = (cleanSubData)?.subscription_code as string | undefined;
						}
					} else if (isTrial !== true) {
						const planFromPaystack = (data)?.plan as Record<string, unknown> | undefined;
						const planCodeFromPaystack = planFromPaystack?.plan_code as string | undefined;

						if (planCodeFromPaystack === undefined || planCodeFromPaystack === null || planCodeFromPaystack === "") {
							// Local Plan
							paystackSubscriptionCode = `LOC_${reference}`;
						} else {
							// Native Paystack subscription (if created during charge)
							paystackSubscriptionCode = ((data)?.subscription as Record<string, unknown> | undefined)?.subscription_code as string | undefined;
						}
					}


					const existingSubs = await (ctx.context.adapter).findMany({
						model: "subscription",
						where: [{ field: "paystackTransactionReference", value: reference }],
					}) as Subscription[];
					let targetSub: Subscription | undefined;
					if (existingSubs && existingSubs.length > 0) {
						targetSub = existingSubs.find(s =>
							!(referenceId !== undefined && referenceId !== null && referenceId !== "") || s.referenceId === referenceId
						);
					}

					let updatedSubscription: Subscription | null = null;
					if (targetSub !== undefined && targetSub !== null) {
						updatedSubscription = await (ctx.context.adapter).update({
							model: "subscription",
							update: {
								status: isTrial === true ? "trialing" : "active",
								periodStart: new Date(),
								updatedAt: new Date(),
								...(isTrial === true && (trialEnd !== undefined && trialEnd !== null && trialEnd !== "") ? {
									trialStart: new Date(),
									trialEnd: new Date(trialEnd),
									periodEnd: new Date(trialEnd),
								} : {}),
								...(paystackSubscriptionCode !== undefined && paystackSubscriptionCode !== null && paystackSubscriptionCode !== "" ? { paystackSubscriptionCode } : {}),
								...(authorizationCode !== undefined && authorizationCode !== null && authorizationCode !== "" ? { paystackAuthorizationCode: authorizationCode } : {}),
							},
							where: [{ field: "id", value: targetSub.id }],
						}) as Subscription | null;
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
			} else if (status === "failed" || status === "abandoned") {
				try {
					await (ctx.context.adapter).update({
						model: "paystackTransaction",
						update: {
							status,
							updatedAt: new Date(),
						},
						where: [{ field: "reference", value: reference }],
					});
				} catch (e: unknown) {
					ctx.context.logger.error("Failed to update transaction status", e);
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
		async (ctx: any) => {
			if (subscriptionOptions?.enabled !== true) {
				throw new APIError("BAD_REQUEST", {
					message: "Subscriptions are not enabled in the Paystack options.",
				});
			}
			const session = await getSessionFromCtx(ctx);
			if (!session) throw new APIError("UNAUTHORIZED");
			const referenceIdPart = (ctx.context as Record<string, unknown>).referenceId as string | undefined;
			const queryRefId = ctx.query?.referenceId;
			const referenceId = (referenceIdPart !== undefined && referenceIdPart !== null && referenceIdPart !== "")
				? referenceIdPart
				: (queryRefId !== undefined && queryRefId !== null && queryRefId !== "")
					? queryRefId
					: (session.user as unknown as { id: string }).id;
			const res = await (ctx.context.adapter).findMany({
				model: "subscription",
				where: [{ field: "referenceId", value: referenceId }],
			}) as Subscription[];
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
		async (ctx: any) => {
			const session = await getSessionFromCtx(ctx);
			if (!session) throw new APIError("UNAUTHORIZED");
			const referenceId =
				((ctx.context as Record<string, unknown>).referenceId as string | undefined) ??
				(ctx.query?.referenceId) ??
				((session.user as unknown as { id: string }).id);
			const res = await (ctx.context.adapter).findMany({
				model: "paystackTransaction",
				where: [{ field: "referenceId", value: referenceId }],
			}) as PaystackTransaction[];
			// Sort by createdAt desc locally if adapter doesn't support it well, 
			// but Better Auth adapters usually return in insertion order.
			// Let's sort to be sure.
			const sorted = res.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
			return ctx.json({ transactions: sorted });
		},
	);
};

const enableDisableBodySchema = z.object({
	referenceId: z.string().optional(),
	subscriptionCode: z.string(),
	emailToken: z.string().optional(),
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
		async (ctx: any) => {
			const { subscriptionCode } = ctx.body;
			const paystack = getPaystackOps(options.paystackClient);
			try {
				if (subscriptionCode.startsWith("LOC_")) {
					const sub = await (ctx.context.adapter).findOne({
						model: "subscription",
						where: [{ field: "paystackSubscriptionCode", value: subscriptionCode }],
					}) as Subscription | null;

					if (sub) {
						await (ctx.context.adapter).update({
							model: "subscription",
							update: {
								status: "active",
								cancelAtPeriodEnd: true,
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
					const fetchRes = unwrapSdkResult<Record<string, unknown>>(raw);
					const data =
						fetchRes !== null && fetchRes !== undefined && typeof fetchRes === "object" && "status" in fetchRes && "data" in fetchRes
							? (fetchRes).data
							: fetchRes?.data !== undefined ? fetchRes.data : fetchRes;

					if (emailToken === undefined || emailToken === null || emailToken === "") {
						emailToken = (data as Record<string, unknown>)?.email_token as string | undefined;
					}
					nextPaymentDate = (data as Record<string, unknown>)?.next_payment_date as string | undefined;
				} catch {
					// ignore fetch failure? If we can't fetch, we might miss next_payment_date.
				}

				if (emailToken === undefined || emailToken === null || emailToken === "") {
					try {
						const raw = await paystack.subscriptionManageLink(subscriptionCode);
						const linkRes = unwrapSdkResult<Record<string, unknown>>(raw);
						const data =
							linkRes !== null && linkRes !== undefined && typeof linkRes === "object" && "status" in linkRes && "data" in linkRes
								? (linkRes).data
								: linkRes?.data !== undefined ? linkRes.data : linkRes;
						const link = typeof data === "string" ? data : (data as Record<string, unknown>)?.link as string | undefined;

						if (link !== undefined && link !== null && link !== "") {
							emailToken = tryGetEmailTokenFromSubscriptionManageLink(link);
						}
					} catch {
						// ignore
					}
				}

				if (emailToken === undefined || emailToken === null || emailToken === "") {
					throw new Error("Could not retrieve email_token for subscription disable.");
				}

				await paystack.subscriptionDisable({ code: subscriptionCode, token: emailToken });

				// Implement Cancel at Period End logic
				// Paystack "disable" stops future charges.
				// We keep status as "active" but set cancelAtPeriodEnd = true

				// Duplicate removed

				const periodEnd = (nextPaymentDate !== undefined && nextPaymentDate !== null && nextPaymentDate !== "") ? new Date(nextPaymentDate) : undefined;

				const sub = await (ctx.context.adapter).findOne({
					model: "subscription",
					where: [{ field: "paystackSubscriptionCode", value: subscriptionCode }],
				}) as Subscription | null;

				if (sub) {
					await (ctx.context.adapter).update({
						model: "subscription",
						update: {
							status: "active", // Keep active until period end
							cancelAtPeriodEnd: true,
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
				(ctx as unknown as { context: { logger: { error: (msg: string, err: unknown) => void } } }).context.logger.error("Failed to disable subscription", error);
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
		async (ctx: any) => {
			const { subscriptionCode } = ctx.body;
			const paystack = getPaystackOps(options.paystackClient);
			try {
				let emailToken = ctx.body.emailToken;
				if (emailToken === undefined || emailToken === null || emailToken === "") {
					try {
						const raw = await paystack.subscriptionFetch(subscriptionCode);
						const fetchRes = unwrapSdkResult<Record<string, unknown>>(raw);
						const data =
							fetchRes !== null && fetchRes !== undefined && typeof fetchRes === "object" && "status" in fetchRes && "data" in fetchRes
								? (fetchRes).data
								: fetchRes?.data !== undefined ? fetchRes.data : fetchRes;
						emailToken = (data as Record<string, unknown>)?.email_token as string | undefined;
					} catch {
						// ignore; try manage-link fallback below
					}
				}

				if (emailToken === undefined || emailToken === null || emailToken === "") {
					try {
						const raw = await paystack.subscriptionManageLink(subscriptionCode);
						const linkRes = unwrapSdkResult<Record<string, unknown>>(raw);
						const data =
							linkRes !== null && linkRes !== undefined && "status" in linkRes && "data" in linkRes
								? (linkRes).data
								: linkRes?.data !== undefined ? linkRes.data : linkRes;
						const link = typeof data === "string" ? data : (data as Record<string, unknown>)?.link as string | undefined;

						if (link !== undefined && link !== null && link !== "") {
							emailToken = tryGetEmailTokenFromSubscriptionManageLink(link);
						}
					} catch {
						// ignore
					}
				}

				if (emailToken === undefined || emailToken === null || emailToken === "") {
					throw new APIError("BAD_REQUEST", { message: "Could not retrieve email_token for subscription enable." });
				}

				await paystack.subscriptionEnable({ code: subscriptionCode, token: emailToken });

				// Update local status immediately
				await (ctx.context.adapter).update({
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

	const handler = async (ctx: any) => {
		const { subscriptionCode } = ctx.query;

		// If it's a local mock subscription, return null link instead of error
		if (subscriptionCode.startsWith("LOC_") || subscriptionCode.startsWith("sub_local_")) {
			return ctx.json({ link: null, message: "Local subscriptions cannot be managed on Paystack" });
		}

		const paystack = getPaystackOps(options.paystackClient);
		try {
			const raw = await paystack.subscriptionManageLink(subscriptionCode);
			const res = unwrapSdkResult<Record<string, unknown>>(raw);
			const data =
				(res !== null && res !== undefined && typeof res === "object" && "status" in res && "data" in res)
					? (res).data
					: res?.data !== undefined ? res.data : res;

			const link = typeof data === "string" ? data : (data as Record<string, unknown>)?.link as string | undefined;

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
		async (ctx: any) => {
			console.error("DEBUG: syncProducts endpoint hit!");
			const paystack = getPaystackOps(options.paystackClient);
			try {
				const raw = await paystack.productList();
				const res = unwrapSdkResult<Record<string, unknown>>(raw);
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const productsData = (res !== null && typeof res === "object" && "status" in res && "data" in res) ? (res as Record<string, any>).data : (res as Record<string, any>)?.data ?? res;

				if (!Array.isArray(productsData)) {
					return ctx.json({ status: "success", count: 0 });
				}

				for (const product of productsData) {
					const paystackId = String(product.id);
					const existing = await (ctx.context.adapter).findOne({
						model: "paystackProduct",
						where: [{ field: "paystackId", value: paystackId }],
					}) as PaystackProduct | null;

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
						await (ctx.context.adapter).update({
							model: "paystackProduct",
							update: productData,
							where: [{ field: "id", value: existing.id }],
						});
					} else {
						await (ctx.context.adapter).create({
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
		async (ctx: any) => {
			const res = await (ctx.context.adapter).findMany({
				model: "paystackProduct",
			}) as PaystackProduct[];
			const sorted = res.sort((a, b) => a.name.localeCompare(b.name));
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
		async (ctx: any) => {
			const paystack = getPaystackOps(options.paystackClient);
			try {
				const raw = await paystack.planList();
				const res = unwrapSdkResult<Record<string, unknown>>(raw);
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const plansData = (res !== null && typeof res === "object" && "status" in res && "data" in res) ? (res as Record<string, any>).data : (res as Record<string, any>)?.data ?? res;

				if (!Array.isArray(plansData)) {
					return ctx.json({ status: "success", count: 0 });
				}

				for (const plan of plansData) {
					const paystackId = String(plan.id);
					const existing = await (ctx.context.adapter).findOne({
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
						await (ctx.context.adapter).update({
							model: "paystackPlan",
							update: planData,
							where: [{ field: "id", value: existing.id }],
						});
					} else {
						await (ctx.context.adapter).create({
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
		async (ctx: any) => {
			try {
				const plans = await (ctx.context.adapter).findMany({
					model: "paystackPlan",
				}) as any[];
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
		async (ctx: any) => {
			const { subscriptionId, amount: bodyAmount } = ctx.body;
			const subscription = await (ctx.context.adapter).findOne({
				model: "subscription",
				where: [{ field: "id", value: subscriptionId }],
			}) as Subscription | null;

			if (subscription === null || subscription === undefined) {
				throw new APIError("NOT_FOUND", { message: "Subscription not found" });
			}

			if (subscription.paystackAuthorizationCode === undefined || subscription.paystackAuthorizationCode === null || subscription.paystackAuthorizationCode === "") {
				throw new APIError("BAD_REQUEST", { message: "No authorization code found for this subscription" });
			}

			const plans = await getPlans(options.subscription);
			const plan = plans.find((p) => p.name.toLowerCase() === subscription.plan.toLowerCase());

			if (plan === undefined || plan === null) {
				throw new APIError("NOT_FOUND", { message: "Plan not found" });
			}

			const amount = bodyAmount ?? plan.amount;
			if (amount === undefined || amount === null) {
				throw new APIError("BAD_REQUEST", { message: "Plan amount is not defined" });
			}

			let email: string | null | undefined;
			if (subscription.referenceId !== undefined && subscription.referenceId !== null && subscription.referenceId !== "") {
				// Try to find user or org
				const user = await (ctx.context.adapter).findOne({
					model: "user",
					where: [{ field: "id", value: subscription.referenceId }],
				}) as User | null;
				if (user !== undefined && user !== null) {
					email = user.email;
				} else if (options.organization?.enabled === true) {
					// Check org owner email if referenceId is organizationId
					const ownerMember = await (ctx.context.adapter).findOne({
						model: "member",
						where: [
							{ field: "organizationId", value: subscription.referenceId },
							{ field: "role", value: "owner" },
						],
					}) as Member | null;
					if (ownerMember !== undefined && ownerMember !== null) {
						const ownerUser = await (ctx.context.adapter).findOne({
							model: "user",
							where: [{ field: "id", value: ownerMember.userId }],
						}) as User | null;
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
			const chargeRes = await paystack.transactionChargeAuthorization({
				email,
				amount,
				authorization_code: subscription.paystackAuthorizationCode,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				currency: plan.currency as any,
				metadata: {
					subscriptionId,
					referenceId: subscription.referenceId,
					plan: plan.name,
				},
			});

			const data = unwrapSdkResult<Record<string, unknown>>(chargeRes);
			const chargeData = (data as { data?: Record<string, unknown> })?.data ?? data;

			if (chargeData?.status === "success") {
				const now = new Date();
				const nextPeriodEnd = getNextPeriodEnd(now, plan.interval ?? "monthly");

				await (ctx.context.adapter).update({
					model: "subscription",
					update: {
						periodStart: now,
						periodEnd: nextPeriodEnd,
						updatedAt: now,
						// Record the last transaction reference if available
						paystackTransactionReference: chargeData.reference as string | undefined,
					},
					where: [{ field: "id", value: subscription.id }],
				});

				return ctx.json({ status: "success", data: chargeData });
			}

			return ctx.json({ status: "failed", data: chargeData }, { status: 400 });
		},
	);
};
