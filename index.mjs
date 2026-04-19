import { defineErrorCodes } from "@better-auth/core/utils/error-codes";
import { defu } from "defu";
import { createAuthEndpoint, createAuthMiddleware } from "@better-auth/core/api";
import { HIDE_METADATA, logger } from "better-auth";
import { APIError, getSessionFromCtx, originCheck, sessionMiddleware } from "better-auth/api";
import { z } from "zod";
import { PaystackResponse } from "@alexasomba/paystack-node";
import { mergeSchema } from "better-auth/db";
//#region src/paystack-sdk.ts
/**
* Interface for checking if a result is a PaystackResponse from the SDK v1.9.1+
*/
function IsPaystackResponse(value) {
	return value instanceof PaystackResponse;
}
/**
* Unwraps a Paystack SDK result, extracting the data or throwing an APIError if the request failed.
* Leverages the native .unwrap() method in SDK v1.9.1+ if available.
*/
function unwrapSdkResult(result) {
	if (IsPaystackResponse(result)) try {
		return result.unwrap();
	} catch (e) {
		throw new APIError("BAD_REQUEST", { message: e?.message ?? "Paystack API error" });
	}
	let current = result;
	while (current !== null && current !== void 0 && typeof current === "object") {
		const body = current;
		if (body.status === false) throw new APIError("BAD_REQUEST", { message: body.message ?? "Paystack API error" });
		if ("authorization_url" in body || "reference" in body || "customer_code" in body) break;
		if ("data" in body && body.data !== void 0 && body.data !== null && typeof body.data === "object") {
			current = body.data;
			continue;
		}
		break;
	}
	return current;
}
/**
* Returns the operations object from a Paystack client.
* For v1.9.1+, the client itself uses the grouped structure.
*/
function getPaystackOps(client) {
	return client;
}
//#endregion
//#region src/utils.ts
function getPlanSeatAmount(plan) {
	if (plan.seatAmount !== void 0) {
		if (typeof plan.seatAmount === "number" && Number.isFinite(plan.seatAmount)) return plan.seatAmount;
		throw new Error(`Invalid seatAmount for plan '${plan.name}'. Expected a finite number.`);
	}
	if (plan.seatPriceId === void 0 || plan.seatPriceId === null || plan.seatPriceId === "") return;
	const parsed = typeof plan.seatPriceId === "string" ? Number(plan.seatPriceId) : plan.seatPriceId;
	if (typeof parsed === "number" && Number.isFinite(parsed)) return parsed;
	throw new Error(`Invalid seatPriceId for plan '${plan.name}'. Expected a numeric amount in the smallest currency unit.`);
}
function calculatePlanAmount(plan, quantity) {
	return (plan.amount ?? 0) + quantity * (getPlanSeatAmount(plan) ?? 0);
}
function isLocalSubscriptionCode(subscriptionCode) {
	return typeof subscriptionCode === "string" && (subscriptionCode.startsWith("LOC_") || subscriptionCode.startsWith("sub_local_"));
}
function isLocallyManagedSubscription(subscription) {
	if (isLocalSubscriptionCode(subscription.paystackSubscriptionCode)) return true;
	if (typeof subscription.paystackSubscriptionCode === "string" && subscription.paystackSubscriptionCode !== "") return false;
	return subscription.paystackPlanCode === void 0 || subscription.paystackPlanCode === null || subscription.paystackPlanCode === "";
}
function assertLocallyManagedSubscription(subscription, action) {
	if (!isLocallyManagedSubscription(subscription)) throw new Error(`Paystack-managed subscriptions do not support ${action}. Use local billing for seat-based or prorated subscription changes.`);
}
async function getPlans(subscriptionOptions) {
	if (subscriptionOptions?.enabled === true) return typeof subscriptionOptions.plans === "function" ? subscriptionOptions.plans() : subscriptionOptions.plans;
	throw new Error("Subscriptions are not enabled in the Paystack options.");
}
async function getPlanByName(options, name) {
	if (typeof name !== "string" || name.trim() === "") return null;
	if (options.subscription?.enabled === true) {
		const plans = await getPlans(options.subscription);
		const normalizedName = name.toLowerCase();
		return plans.find((plan) => typeof plan.name === "string" && plan.name.toLowerCase() === normalizedName) ?? null;
	}
	return null;
}
async function getProducts(productOptions) {
	if (productOptions?.products) return typeof productOptions.products === "function" ? await productOptions.products() : productOptions.products;
	return [];
}
async function getProductByName(options, name) {
	return await getProducts(options.products).then((products) => products !== void 0 && products !== null ? products.find((product) => product.name.toLowerCase() === name.toLowerCase()) ?? null : null);
}
function getNextPeriodEnd(startDate, interval) {
	const date = new Date(startDate);
	switch (interval) {
		case "daily":
			date.setDate(date.getDate() + 1);
			break;
		case "weekly":
			date.setDate(date.getDate() + 7);
			break;
		case "monthly":
			date.setMonth(date.getMonth() + 1);
			break;
		case "quarterly":
			date.setMonth(date.getMonth() + 3);
			break;
		case "biannually":
			date.setMonth(date.getMonth() + 6);
			break;
		case "annually":
			date.setFullYear(date.getFullYear() + 1);
			break;
		default: date.setMonth(date.getMonth() + 1);
	}
	return date;
}
/**
* Validates if the amount meets Paystack's minimum transaction requirements.
* Amounts should be in the smallest currency unit (e.g., kobo, cents).
*/
function validateMinAmount(amount, currency) {
	const min = {
		NGN: 5e3,
		GHS: 10,
		ZAR: 100,
		KES: 300,
		USD: 200,
		XOF: 100
	}[currency.toUpperCase()];
	return min !== void 0 ? amount >= min : true;
}
async function syncProductQuantityFromPaystack(ctx, productName, paystackClient) {
	let localProduct = await ctx.context.adapter.findOne({
		model: "paystackProduct",
		where: [{
			field: "name",
			value: productName
		}]
	});
	localProduct ??= await ctx.context.adapter.findOne({
		model: "paystackProduct",
		where: [{
			field: "slug",
			value: productName.toLowerCase().replace(/\s+/g, "-")
		}]
	});
	if (localProduct?.paystackId === void 0 || localProduct.paystackId === null || localProduct.paystackId === "") {
		if (localProduct?.id !== void 0 && localProduct.unlimited !== true && typeof localProduct.quantity === "number" && localProduct.quantity > 0) await ctx.context.adapter.update({
			model: "paystackProduct",
			update: {
				quantity: localProduct.quantity - 1,
				updatedAt: /* @__PURE__ */ new Date()
			},
			where: [{
				field: "id",
				value: localProduct.id
			}]
		});
		return;
	}
	try {
		const paystackProductId = Number(localProduct.paystackId);
		if (!Number.isFinite(paystackProductId)) return;
		const remoteQuantity = unwrapSdkResult(await paystackClient.product?.fetch(paystackProductId))?.quantity;
		if (remoteQuantity !== void 0 && localProduct.id !== void 0) await ctx.context.adapter.update({
			model: "paystackProduct",
			update: {
				quantity: remoteQuantity,
				updatedAt: /* @__PURE__ */ new Date()
			},
			where: [{
				field: "id",
				value: localProduct.id
			}]
		});
	} catch {
		if (localProduct?.id !== void 0 && localProduct.unlimited !== true && typeof localProduct.quantity === "number" && localProduct.quantity > 0) await ctx.context.adapter.update({
			model: "paystackProduct",
			update: {
				quantity: localProduct.quantity - 1,
				updatedAt: /* @__PURE__ */ new Date()
			},
			where: [{
				field: "id",
				value: localProduct.id
			}]
		});
	}
}
async function syncSubscriptionSeats(ctx, organizationId, options) {
	if (options.subscription?.enabled !== true) return;
	const adapter = ctx.context.adapter;
	const subscription = await adapter.findOne({
		model: "subscription",
		where: [{
			field: "referenceId",
			value: organizationId
		}]
	});
	if (subscription?.paystackSubscriptionCode === void 0 || subscription.paystackSubscriptionCode === null || subscription.paystackSubscriptionCode === "") return;
	if (subscription === null || subscription === void 0) return;
	const plan = await getPlanByName(options, subscription.plan);
	if (plan === null || plan === void 0) return;
	if (getPlanSeatAmount(plan) === void 0) return;
	const quantity = (await adapter.findMany({
		model: "member",
		where: [{
			field: "organizationId",
			value: organizationId
		}]
	})).length;
	try {
		assertLocallyManagedSubscription(subscription, "automatic seat sync");
		await adapter.update({
			model: "subscription",
			where: [{
				field: "id",
				value: subscription.id
			}],
			update: {
				seats: quantity,
				updatedAt: /* @__PURE__ */ new Date()
			}
		});
	} catch (e) {
		const log = ctx.context.logger;
		if (log !== void 0 && log !== null) log.error("Failed to sync subscription seats", e);
	}
}
//#endregion
//#region src/middleware.ts
const referenceMiddleware = (options, action) => createAuthMiddleware(async (ctx) => {
	const session = ctx.context.session;
	if (session === null || session === void 0) throw new APIError("UNAUTHORIZED");
	const body = ctx.body ?? {};
	const query = ctx.query ?? {};
	const referenceId = body.referenceId ?? query.referenceId ?? session.user.id;
	const subscriptionOptions = options.subscription;
	if (referenceId === session.user.id) return { referenceId };
	if (subscriptionOptions?.enabled === true && "authorizeReference" in subscriptionOptions && typeof subscriptionOptions.authorizeReference === "function") {
		if (await subscriptionOptions.authorizeReference({
			user: session.user,
			session: session.session,
			referenceId,
			action
		}, ctx) === true) return { referenceId };
		throw new APIError("UNAUTHORIZED");
	}
	if (options.organization?.enabled === true) {
		const member = await ctx.context.adapter.findOne({
			model: "member",
			where: [{
				field: "userId",
				value: session.user.id
			}, {
				field: "organizationId",
				value: referenceId
			}]
		});
		if (member !== null && member !== void 0) {
			logger.debug("DEBUG MIDDLEWARE MEMBER FOUND:", member);
			return { referenceId };
		}
	}
	logger.error(`Passing referenceId into a subscription action isn't allowed if subscription.authorizeReference isn't defined in your paystack plugin config and matches no organization membership.`);
	throw new APIError("BAD_REQUEST", { message: "Passing referenceId isn't allowed without subscription.authorizeReference or valid organization membership." });
});
//#endregion
//#region src/limits.ts
const getOrganizationSubscription = async (ctx, organizationId) => {
	return await ctx.context.adapter.findOne({
		model: "subscription",
		where: [{
			field: "referenceId",
			value: organizationId
		}]
	});
};
const checkSeatLimit = async (ctx, organizationId, seatsToAdd = 1) => {
	const subscription = await getOrganizationSubscription(ctx, organizationId);
	if (subscription?.seats === null) return true;
	const members = await ctx.context.adapter.findMany({
		model: "member",
		where: [{
			field: "organizationId",
			value: organizationId
		}]
	});
	if (!subscription) return true;
	if (members.length + seatsToAdd > subscription.seats) throw new APIError("FORBIDDEN", { message: `Organization member limit reached. Used: ${members.length}, Max: ${subscription.seats}` });
	return true;
};
const checkTeamLimit = async (ctx, organizationId, maxTeams) => {
	if ((await ctx.context.adapter.findMany({
		model: "team",
		where: [{
			field: "organizationId",
			value: organizationId
		}]
	})).length >= maxTeams) throw new APIError("FORBIDDEN", { message: `Organization team limit reached. Max teams: ${maxTeams}` });
	return true;
};
//#endregion
//#region src/routes.ts
const PAYSTACK_ERROR_CODES = defineErrorCodes({
	SUBSCRIPTION_NOT_FOUND: "Subscription not found",
	SUBSCRIPTION_PLAN_NOT_FOUND: "Subscription plan not found",
	UNABLE_TO_CREATE_CUSTOMER: "Unable to create customer",
	FAILED_TO_INITIALIZE_TRANSACTION: "Failed to initialize transaction",
	FAILED_TO_VERIFY_TRANSACTION: "Failed to verify transaction",
	FAILED_TO_DISABLE_SUBSCRIPTION: "Failed to disable subscription",
	FAILED_TO_ENABLE_SUBSCRIPTION: "Failed to enable subscription",
	EMAIL_VERIFICATION_REQUIRED: "Email verification is required before you can subscribe to a plan",
	SUBSCRIPTION_PAYMENT_CHANNEL_NOT_ALLOWED: "This subscription only supports specific payment channels"
});
function getAllowedSubscriptionChannels(options) {
	const channels = options.subscription?.allowedPaymentChannels;
	return Array.isArray(channels) && channels.length > 0 ? channels : void 0;
}
function isAllowedSubscriptionChannel(channel, allowedChannels) {
	if (allowedChannels === void 0) return true;
	return channel !== void 0 && channel !== null && allowedChannels.includes(channel);
}
async function hmacSha512Hex(secret, message) {
	const encoder = new TextEncoder();
	const keyData = encoder.encode(secret);
	const msgData = encoder.encode(message);
	const crypto = globalThis.crypto;
	if (crypto !== void 0 && crypto !== null && "subtle" in crypto) {
		const subtle = crypto.subtle;
		const key = await subtle.importKey("raw", keyData, {
			name: "HMAC",
			hash: "SHA-512"
		}, false, ["sign"]);
		const signature = await subtle.sign("HMAC", key, msgData);
		return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
	}
	const { createHmac } = await import("node:crypto");
	return createHmac("sha512", secret).update(message).digest("hex");
}
const paystackWebhook = (options, path = "/webhook") => {
	return createAuthEndpoint(path, {
		method: "POST",
		metadata: {
			...HIDE_METADATA,
			openapi: { operationId: "handlePaystackWebhook" }
		},
		cloneRequest: true,
		disableBody: true
	}, async (ctx) => {
		const request = ctx.requestClone ?? ctx.request;
		if (request === void 0 || request === null) throw new APIError("BAD_REQUEST", { message: "Request object is missing from context" });
		const payload = await request.text();
		const headers = ctx.headers ?? ctx.request?.headers;
		const signature = headers?.get("x-paystack-signature");
		if (options.webhook?.verifyIP === true) {
			const trustedIPs = options.webhook.trustedIPs ?? [
				"52.31.139.75",
				"52.49.173.169",
				"52.214.14.220"
			];
			const clientIP = headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headers?.get("x-real-ip") ?? ctx.request.ip;
			if (clientIP !== void 0 && clientIP !== null && trustedIPs.includes(clientIP) === false) throw new APIError("UNAUTHORIZED", {
				message: `Forbidden IP: ${clientIP}`,
				status: 401
			});
		}
		if (signature === void 0 || signature === null || signature === "") throw new APIError("UNAUTHORIZED", {
			message: "Missing x-paystack-signature header",
			status: 401
		});
		if (await hmacSha512Hex(options.webhook?.secret ?? options.paystackWebhookSecret ?? options.secretKey, payload) !== signature) throw new APIError("UNAUTHORIZED", {
			message: "Invalid Paystack webhook signature",
			status: 401
		});
		const event = JSON.parse(payload);
		const eventName = event.event;
		const data = event.data;
		if (eventName === "charge.success") {
			const reference = data?.reference;
			const paystackIdRaw = data?.id;
			const paystackId = paystackIdRaw !== void 0 && paystackIdRaw !== null ? String(paystackIdRaw) : void 0;
			if (reference !== void 0 && reference !== null && reference !== "") {
				try {
					await ctx.context.adapter.update({
						model: "paystackTransaction",
						update: {
							status: "success",
							paystackId,
							updatedAt: /* @__PURE__ */ new Date()
						},
						where: [{
							field: "reference",
							value: reference
						}]
					});
				} catch (e) {
					ctx.context.logger.warn("Failed to update transaction status for charge.success", e);
				}
				try {
					const transaction = await ctx.context.adapter.findOne({
						model: "paystackTransaction",
						where: [{
							field: "reference",
							value: reference
						}]
					});
					if (transaction !== void 0 && transaction !== null && transaction.product !== void 0 && transaction.product !== null && transaction.product !== "") {
						if (options.paystackClient !== void 0 && options.paystackClient !== null) await syncProductQuantityFromPaystack(ctx, transaction.product, options.paystackClient);
					}
				} catch (e) {
					ctx.context.logger.warn("Failed to sync product quantity", e);
				}
			}
		}
		if (eventName === "charge.failure") {
			const reference = data?.reference;
			if (reference !== void 0 && reference !== null && reference !== "") try {
				await ctx.context.adapter.update({
					model: "paystackTransaction",
					update: {
						status: "failed",
						updatedAt: /* @__PURE__ */ new Date()
					},
					where: [{
						field: "reference",
						value: reference
					}]
				});
			} catch (e) {
				ctx.context.logger.warn("Failed to update transaction status for charge.failure", e);
			}
		}
		if (options.subscription?.enabled === true) try {
			if (eventName === "subscription.create") {
				const subscriptionData = data;
				const subscriptionCode = subscriptionData.subscription_code ?? "";
				const customerCode = subscriptionData.customer?.customer_code;
				const planCode = subscriptionData.plan?.plan_code;
				let metadata = subscriptionData.metadata;
				if (typeof metadata === "string") try {
					metadata = JSON.parse(metadata);
				} catch {}
				const metadataObj = metadata !== void 0 && metadata !== null && typeof metadata === "object" ? metadata : {};
				const referenceIdFromMetadata = typeof metadataObj.referenceId === "string" ? metadataObj.referenceId : void 0;
				let planNameFromMetadata = typeof metadataObj.plan === "string" ? metadataObj.plan : void 0;
				if (typeof planNameFromMetadata === "string") planNameFromMetadata = planNameFromMetadata.toLowerCase();
				const plans = await getPlans(options.subscription);
				const planFromCode = planCode !== void 0 && planCode !== null && planCode !== "" ? plans.find((p) => p.planCode === planCode) : void 0;
				const planPart = planFromCode?.name ?? planNameFromMetadata;
				const planName = planPart !== void 0 && planPart !== null && planPart !== "" ? planPart.toLowerCase() : void 0;
				if (subscriptionCode !== void 0 && subscriptionCode !== null && subscriptionCode !== "") {
					const where = [];
					if (referenceIdFromMetadata !== void 0 && referenceIdFromMetadata !== null && referenceIdFromMetadata !== "") where.push({
						field: "referenceId",
						value: referenceIdFromMetadata
					});
					else if (customerCode !== void 0 && customerCode !== null && customerCode !== "") where.push({
						field: "paystackCustomerCode",
						value: customerCode
					});
					if (planName !== void 0 && planName !== null && planName !== "") where.push({
						field: "plan",
						value: planName
					});
					if (where.length > 0) {
						const subscription = (await ctx.context.adapter.findMany({
							model: "subscription",
							where
						}))?.[0];
						if (subscription !== void 0 && subscription !== null) {
							await ctx.context.adapter.update({
								model: "subscription",
								update: {
									paystackSubscriptionCode: subscriptionCode,
									status: "active",
									updatedAt: /* @__PURE__ */ new Date(),
									periodEnd: subscriptionData.next_payment_date !== void 0 && subscriptionData.next_payment_date !== null ? new Date(subscriptionData.next_payment_date) : void 0
								},
								where: [{
									field: "id",
									value: subscription.id
								}]
							});
							const plan = planFromCode ?? (planName !== void 0 && planName !== null && planName !== "" ? await getPlanByName(options, planName) : void 0);
							if (plan !== void 0 && plan !== null) {
								await options.subscription.onSubscriptionComplete?.({
									event,
									subscription: {
										...subscription,
										paystackSubscriptionCode: subscriptionCode,
										status: "active"
									},
									plan
								}, ctx);
								await options.subscription.onSubscriptionCreated?.({
									event,
									subscription: {
										...subscription,
										paystackSubscriptionCode: subscriptionCode,
										status: "active"
									},
									plan
								}, ctx);
							}
						}
					}
				}
			}
			if (eventName === "subscription.disable" || eventName === "subscription.not_renew") {
				const subscriptionData = data;
				const subscriptionCode = subscriptionData.subscription_code ?? "";
				if (subscriptionCode !== "") {
					const existing = await ctx.context.adapter.findOne({
						model: "subscription",
						where: [{
							field: "paystackSubscriptionCode",
							value: subscriptionCode
						}]
					});
					let newStatus = "canceled";
					const nextPaymentDate = subscriptionData.next_payment_date;
					const periodEnd = nextPaymentDate !== void 0 && nextPaymentDate !== null && nextPaymentDate !== "" ? new Date(nextPaymentDate) : existing?.periodEnd !== void 0 && existing.periodEnd !== null ? new Date(existing.periodEnd) : void 0;
					if (periodEnd !== void 0 && periodEnd.getTime() > Date.now()) newStatus = "active";
					await ctx.context.adapter.update({
						model: "subscription",
						update: {
							status: newStatus,
							cancelAtPeriodEnd: true,
							...periodEnd ? { periodEnd } : {},
							updatedAt: /* @__PURE__ */ new Date()
						},
						where: [{
							field: "paystackSubscriptionCode",
							value: subscriptionCode
						}]
					});
					if (existing !== null && existing !== void 0) await options.subscription.onSubscriptionCancel?.({
						event,
						subscription: {
							...existing,
							status: "canceled"
						}
					}, ctx);
				}
			}
			if (eventName === "charge.success" || eventName === "invoice.update") {
				const subscriptionCodeRaw = (data?.subscription)?.subscription_code ?? data?.subscription_code;
				const subscriptionCode = subscriptionCodeRaw !== void 0 && subscriptionCodeRaw !== null && subscriptionCodeRaw !== "" ? subscriptionCodeRaw : void 0;
				if (subscriptionCode !== void 0) {
					const existingSub = await ctx.context.adapter.findOne({
						model: "subscription",
						where: [{
							field: "paystackSubscriptionCode",
							value: subscriptionCode
						}]
					});
					if (existingSub !== void 0 && existingSub !== null && existingSub.pendingPlan !== void 0 && existingSub.pendingPlan !== null && existingSub.pendingPlan !== "") await ctx.context.adapter.update({
						model: "subscription",
						update: {
							plan: existingSub.pendingPlan,
							pendingPlan: null,
							updatedAt: /* @__PURE__ */ new Date()
						},
						where: [{
							field: "id",
							value: existingSub.id
						}]
					});
				}
			}
		} catch (_e) {
			ctx.context.logger.error("Failed to sync Paystack webhook event", _e);
		}
		await options.onEvent?.(event);
		return ctx.json({ received: true });
	});
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
	prorateAndCharge: z.boolean().optional()
});
const initializeTransaction = (options, path = "/initialize-transaction") => {
	const subscriptionOptions = options.subscription;
	return createAuthEndpoint(path, {
		method: "POST",
		body: initializeTransactionBodySchema,
		use: subscriptionOptions?.enabled === true ? [
			sessionMiddleware,
			originCheck,
			referenceMiddleware(options, "initialize-transaction")
		] : [sessionMiddleware, originCheck]
	}, async (ctx) => {
		const paystack = getPaystackOps(options.paystackClient);
		const { plan: planName, product: productName, amount: bodyAmount, currency, email, metadata: extraMetadata, callbackURL, quantity, scheduleAtPeriodEnd, cancelAtPeriodEnd, prorateAndCharge } = ctx.body;
		if (callbackURL !== void 0 && callbackURL !== null && callbackURL !== "") {
			const checkTrusted = () => {
				try {
					if (callbackURL?.startsWith("/") === true) return true;
					const baseUrl = ctx.context?.baseURL ?? ctx.request?.url ?? "";
					if (baseUrl === "") return false;
					const baseOrigin = new URL(baseUrl).origin;
					return new URL(callbackURL).origin === baseOrigin;
				} catch {
					return false;
				}
			};
			if (checkTrusted() === false) throw new APIError("FORBIDDEN", {
				message: "callbackURL is not a trusted origin.",
				status: 403
			});
		}
		const session = await getSessionFromCtx(ctx);
		if (session === void 0 || session === null) throw new APIError("UNAUTHORIZED");
		const user = session.user;
		if (subscriptionOptions?.enabled === true && subscriptionOptions.requireEmailVerification === true && user.emailVerified !== true) throw new APIError("BAD_REQUEST", {
			code: "EMAIL_VERIFICATION_REQUIRED",
			message: PAYSTACK_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED.message
		});
		let plan;
		let product;
		if (planName !== void 0 && planName !== null && planName !== "") {
			if (subscriptionOptions?.enabled !== true) throw new APIError("BAD_REQUEST", { message: "Subscriptions are not enabled." });
			plan = await getPlanByName(options, planName) ?? void 0;
			if (plan === void 0 || plan === null) try {
				const nativePlan = await ctx.context.adapter.findOne({
					model: "paystackPlan",
					where: [{
						field: "name",
						value: planName
					}]
				});
				if (nativePlan !== void 0 && nativePlan !== null) plan = nativePlan;
				else plan = await ctx.context.adapter.findOne({
					model: "paystackPlan",
					where: [{
						field: "planCode",
						value: planName
					}]
				}) ?? void 0;
			} catch {
				plan = void 0;
			}
			if (plan === void 0 || plan === null) throw new APIError("BAD_REQUEST", {
				code: "SUBSCRIPTION_PLAN_NOT_FOUND",
				message: PAYSTACK_ERROR_CODES.SUBSCRIPTION_PLAN_NOT_FOUND.message,
				status: 400
			});
		} else if (productName !== void 0 && productName !== null && productName !== "") {
			if (typeof productName === "string") {
				product = await getProductByName(options, productName) ?? void 0;
				product ??= await ctx.context.adapter.findOne({
					model: "paystackProduct",
					where: [{
						field: "name",
						value: productName
					}]
				}) ?? void 0;
			}
			if (product === void 0 || product === null) throw new APIError("BAD_REQUEST", {
				message: `Product '${productName}' not found.`,
				status: 400
			});
		} else if (bodyAmount === void 0 || bodyAmount === null) throw new APIError("BAD_REQUEST", {
			message: "Either 'plan', 'product', or 'amount' is required to initialize a transaction.",
			status: 400
		});
		let amount = bodyAmount ?? product?.price ?? product?.amount;
		const finalCurrency = currency ?? product?.currency ?? product?.currency ?? plan?.currency ?? "NGN";
		const referenceIdFromCtx = ctx.context.referenceId;
		const referenceId = ctx.body.referenceId ?? referenceIdFromCtx ?? session.user.id;
		if (plan !== void 0 && scheduleAtPeriodEnd === true) {
			const existingSub = await getOrganizationSubscription(ctx, referenceId);
			if (existingSub?.status === "active") {
				await ctx.context.adapter.update({
					model: "subscription",
					where: [{
						field: "id",
						value: existingSub.id
					}],
					update: {
						pendingPlan: plan.name,
						updatedAt: /* @__PURE__ */ new Date()
					}
				});
				return ctx.json({
					status: "success",
					message: "Plan change scheduled at period end.",
					scheduled: true
				});
			}
		}
		if (cancelAtPeriodEnd === true) {
			const existingSub = await getOrganizationSubscription(ctx, referenceId);
			if (existingSub?.status === "active") {
				await ctx.context.adapter.update({
					model: "subscription",
					where: [{
						field: "id",
						value: existingSub.id
					}],
					update: {
						cancelAtPeriodEnd: true,
						updatedAt: /* @__PURE__ */ new Date()
					}
				});
				return ctx.json({
					status: "success",
					message: "Subscription cancellation scheduled at period end.",
					scheduled: true
				});
			}
		}
		if (plan !== void 0) try {
			if (getPlanSeatAmount(plan) !== void 0) {
				const members = await ctx.context.adapter.findMany({
					model: "member",
					where: [{
						field: "organizationId",
						value: referenceId
					}]
				});
				const seatCount = members.length > 0 ? members.length : 1;
				amount = calculatePlanAmount(plan, quantity ?? seatCount);
			}
		} catch (error) {
			throw new APIError("BAD_REQUEST", { message: error instanceof Error ? error.message : "Invalid seat configuration for plan." });
		}
		let url;
		let reference;
		let accessCode;
		let trialStart;
		let trialEnd;
		const requestedTrialDays = plan?.freeTrial?.days !== void 0 && plan.freeTrial.days > 0 ? plan.freeTrial.days : 0;
		const trialRequested = requestedTrialDays > 0;
		let trialGranted = false;
		let trialDeniedReason;
		if (trialRequested) if ((await ctx.context.adapter.findMany({
			model: "subscription",
			where: [{
				field: "referenceId",
				value: referenceId
			}]
		}))?.some((sub) => sub.trialStart !== void 0 && sub.trialStart !== null || sub.trialEnd !== void 0 && sub.trialEnd !== null || sub.status === "trialing") === false) {
			trialStart = /* @__PURE__ */ new Date();
			trialEnd = /* @__PURE__ */ new Date();
			trialEnd.setDate(trialEnd.getDate() + requestedTrialDays);
			trialGranted = true;
		} else trialDeniedReason = "already_used";
		try {
			let targetEmail = email ?? user.email;
			if (options.organization?.enabled === true && referenceId !== void 0 && referenceId !== null && referenceId !== user.id) {
				const org = await ctx.context.adapter.findOne({
					model: "organization",
					where: [{
						field: "id",
						value: referenceId
					}]
				});
				if (org !== void 0 && org !== null) {
					const orgWithEmail = org;
					if (orgWithEmail.email !== void 0 && orgWithEmail.email !== null && orgWithEmail.email !== "") targetEmail = orgWithEmail.email;
					else {
						const ownerMember = await ctx.context.adapter.findOne({
							model: "member",
							where: [{
								field: "organizationId",
								value: referenceId
							}, {
								field: "role",
								value: "owner"
							}]
						});
						if (ownerMember !== void 0 && ownerMember !== null) {
							const ownerUser = await ctx.context.adapter.findOne({
								model: "user",
								where: [{
									field: "id",
									value: ownerMember.userId
								}]
							});
							if (ownerUser !== void 0 && ownerUser !== null && ownerUser.email !== void 0 && ownerUser.email !== null && ownerUser.email !== "") targetEmail = ownerUser.email;
						}
					}
				}
			}
			const allowedSubscriptionChannels = plan ? getAllowedSubscriptionChannels(options) : void 0;
			const metadata = JSON.stringify({
				referenceId,
				userId: user.id,
				plan: plan !== void 0 ? plan.name.toLowerCase() : void 0,
				product: product !== void 0 ? product.name.toLowerCase() : void 0,
				...extraMetadata,
				isTrial: trialStart !== void 0,
				trialRequested,
				trialGranted,
				trialDeniedReason,
				trialEnd: trialEnd !== void 0 ? trialEnd.toISOString() : void 0
			});
			const initBody = {
				email: targetEmail,
				callback_url: callbackURL ?? void 0,
				metadata,
				currency: finalCurrency,
				quantity
			};
			if (allowedSubscriptionChannels !== void 0) initBody.channels = allowedSubscriptionChannels;
			if (plan !== void 0 && prorateAndCharge === true) {
				const existingSub = await getOrganizationSubscription(ctx, referenceId);
				if (existingSub?.status === "active" && existingSub.paystackSubscriptionCode !== void 0 && existingSub.paystackSubscriptionCode !== null && existingSub.paystackSubscriptionCode !== "") {
					if (existingSub.periodEnd !== void 0 && existingSub.periodEnd !== null && existingSub.periodStart !== void 0 && existingSub.periodStart !== null) {
						const now = /* @__PURE__ */ new Date();
						const periodEndLocal = new Date(existingSub.periodEnd);
						const periodStartLocal = new Date(existingSub.periodStart);
						const totalDays = Math.max(1, Math.ceil((periodEndLocal.getTime() - periodStartLocal.getTime()) / (1e3 * 60 * 60 * 24)));
						const remainingDays = Math.max(0, Math.ceil((periodEndLocal.getTime() - now.getTime()) / (1e3 * 60 * 60 * 24)));
						let oldAmount = 0;
						if (existingSub.plan !== "") {
							const oldPlan = await getPlanByName(options, existingSub.plan) ?? await ctx.context.adapter.findOne({
								model: "paystackPlan",
								where: [{
									field: "name",
									value: existingSub.plan
								}]
							}) ?? void 0;
							if (oldPlan !== void 0 && oldPlan !== null) {
								const oldSeatCount = existingSub.seats;
								oldAmount = calculatePlanAmount(oldPlan, oldSeatCount);
							}
						}
						let membersCount = 1;
						let newSeatCount = quantity ?? existingSub.seats ?? membersCount;
						let newAmount;
						try {
							assertLocallyManagedSubscription(existingSub, "plan or seat changes");
							if (getPlanSeatAmount(plan) !== void 0) {
								const members = await ctx.context.adapter.findMany({
									model: "member",
									where: [{
										field: "organizationId",
										value: referenceId
									}]
								});
								membersCount = members.length > 0 ? members.length : 1;
							}
							newSeatCount = quantity ?? existingSub.seats ?? membersCount;
							newAmount = calculatePlanAmount(plan, newSeatCount);
						} catch (error) {
							throw new APIError("BAD_REQUEST", { message: error instanceof Error ? error.message : "Invalid seat configuration for plan." });
						}
						const costDifference = newAmount - oldAmount;
						const prorationMetadata = {
							type: "proration",
							subscriptionId: existingSub.id,
							referenceId,
							newPlan: plan.name.toLowerCase(),
							oldPlan: existingSub.plan,
							newSeatCount,
							remainingDays
						};
						let completedProrationReference;
						if (costDifference > 0 && remainingDays > 0) {
							const proratedAmount = Math.round(costDifference / totalDays * remainingDays);
							if (proratedAmount < 5e3) throw new APIError("BAD_REQUEST", {
								message: "Prorated upgrade amount is below Paystack's minimum charge. Schedule the change for period end instead.",
								status: 400
							});
							const ops = getPaystackOps(options.paystackClient);
							if (ops === void 0 || ops === null) {
								ctx.context.logger.error("Paystack client not configured for proration charge");
								return;
							}
							if (existingSub.paystackAuthorizationCode !== void 0 && existingSub.paystackAuthorizationCode !== null && existingSub.paystackAuthorizationCode !== "") {
								const sdkRes = unwrapSdkResult(await ops.transaction?.chargeAuthorization({ body: {
									email: targetEmail,
									amount: proratedAmount,
									authorization_code: existingSub.paystackAuthorizationCode,
									reference: `upg_${existingSub.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
									metadata: JSON.stringify(prorationMetadata)
								} }));
								if (sdkRes?.status !== "success") throw new APIError("BAD_REQUEST", { message: "Failed to process prorated charge via saved authorization." });
								await ctx.context.adapter.create({
									model: "paystackTransaction",
									data: {
										reference: sdkRes.reference ?? "",
										paystackId: sdkRes.id !== void 0 && sdkRes.id !== null ? String(sdkRes.id) : void 0,
										referenceId,
										userId: user.id,
										amount: sdkRes.amount ?? proratedAmount,
										currency: sdkRes.currency ?? finalCurrency,
										status: "success",
										plan: plan.name.toLowerCase(),
										metadata: JSON.stringify(prorationMetadata),
										createdAt: /* @__PURE__ */ new Date(),
										updatedAt: /* @__PURE__ */ new Date()
									}
								});
								completedProrationReference = sdkRes.reference ?? void 0;
							} else {
								const initRes = unwrapSdkResult(await ops.transaction?.initialize({ body: {
									email: targetEmail,
									amount: proratedAmount,
									currency: finalCurrency,
									callback_url: callbackURL ?? void 0,
									metadata: JSON.stringify(prorationMetadata),
									...allowedSubscriptionChannels !== void 0 ? { channels: allowedSubscriptionChannels } : {}
								} }));
								await ctx.context.adapter.create({
									model: "paystackTransaction",
									data: {
										reference: initRes?.reference ?? "",
										referenceId,
										userId: user.id,
										amount: proratedAmount,
										currency: finalCurrency,
										status: "pending",
										plan: plan.name.toLowerCase(),
										metadata: JSON.stringify(prorationMetadata),
										createdAt: /* @__PURE__ */ new Date(),
										updatedAt: /* @__PURE__ */ new Date()
									}
								});
								return ctx.json({
									url: initRes?.authorization_url,
									reference: initRes?.reference,
									accessCode: initRes?.access_code,
									redirect: true
								});
							}
						}
						await ctx.context.adapter.update({
							model: "subscription",
							where: [{
								field: "id",
								value: existingSub.id
							}],
							update: {
								plan: plan.name,
								seats: newSeatCount,
								...completedProrationReference !== void 0 ? { paystackTransactionReference: completedProrationReference } : {},
								updatedAt: /* @__PURE__ */ new Date()
							}
						});
						return ctx.json({
							status: "success",
							message: "Subscription successfully upgraded with prorated charge.",
							prorated: true
						});
					}
				}
			}
			if (plan !== void 0) if (trialStart !== void 0) initBody.amount = 5e3;
			else {
				initBody.plan = plan.planCode;
				initBody.invoice_limit = plan.invoiceLimit;
				let finalAmount;
				if (amount !== void 0 && amount !== null) {
					finalAmount = amount;
					initBody.quantity = 1;
				} else finalAmount = (plan.amount ?? 0) * (quantity ?? 1);
				initBody.amount = Math.max(Math.round(finalAmount), 5e3);
			}
			else {
				if (amount === void 0 || amount === null) throw new APIError("BAD_REQUEST", { message: "Amount is required for one-time payments" });
				initBody.amount = Math.round(amount);
			}
			const sdkRes = unwrapSdkResult(await paystack?.transaction?.initialize({ body: initBody }));
			url = sdkRes?.authorization_url;
			reference = sdkRes?.reference;
			accessCode = sdkRes?.access_code;
		} catch (error) {
			ctx.context.logger.error("Failed to initialize Paystack transaction", error);
			throw new APIError("BAD_REQUEST", {
				code: "FAILED_TO_INITIALIZE_TRANSACTION",
				message: error instanceof Error ? error.message : PAYSTACK_ERROR_CODES.FAILED_TO_INITIALIZE_TRANSACTION.message
			});
		}
		await ctx.context.adapter.create({
			model: "paystackTransaction",
			data: {
				reference: reference ?? "",
				referenceId,
				userId: user.id,
				amount: amount ?? 0,
				currency: plan?.currency ?? currency ?? "NGN",
				status: "pending",
				plan: plan !== void 0 ? plan.name.toLowerCase() : void 0,
				product: product !== void 0 ? product.name.toLowerCase() : void 0,
				metadata: extraMetadata !== void 0 && Object.keys(extraMetadata).length > 0 ? JSON.stringify(extraMetadata) : void 0,
				createdAt: /* @__PURE__ */ new Date(),
				updatedAt: /* @__PURE__ */ new Date()
			}
		});
		if (plan !== void 0) {
			let storedCustomerCode = user.paystackCustomerCode;
			if (options.organization?.enabled === true && referenceId !== user.id) {
				const org = await ctx.context.adapter.findOne({
					model: "organization",
					where: [{
						field: "id",
						value: referenceId
					}]
				});
				if (org !== void 0 && org !== null) {
					const paystackOrg = org;
					if (paystackOrg.paystackCustomerCode !== void 0 && paystackOrg.paystackCustomerCode !== null && paystackOrg.paystackCustomerCode !== "") storedCustomerCode = paystackOrg.paystackCustomerCode;
				}
			}
			const newSubscription = await ctx.context.adapter.create({
				model: "subscription",
				data: {
					plan: plan.name.toLowerCase(),
					referenceId,
					userId: user.id,
					paystackCustomerCode: storedCustomerCode ?? "",
					paystackSubscriptionCode: "",
					paystackPlanCode: plan.planCode,
					paystackAuthorizationCode: "",
					paystackTransactionReference: reference ?? "",
					status: trialStart !== void 0 ? "trialing" : "incomplete",
					seats: quantity ?? 1,
					periodStart: /* @__PURE__ */ new Date(),
					periodEnd: new Date(Date.now() + 720 * 60 * 60 * 1e3),
					cancelAtPeriodEnd: false,
					trialStart,
					trialEnd,
					createdAt: /* @__PURE__ */ new Date(),
					updatedAt: /* @__PURE__ */ new Date()
				}
			});
			if (trialStart !== void 0 && newSubscription !== void 0 && newSubscription !== null && plan.freeTrial?.onTrialStart !== void 0) await plan.freeTrial.onTrialStart(newSubscription);
		}
		return ctx.json({
			url,
			reference,
			accessCode,
			redirect: true
		});
	});
};
const createSubscription = (options, path = "/create-subscription") => initializeTransaction(options, path);
const upgradeSubscription = (options, path = "/upgrade-subscription") => initializeTransaction(options, path);
const cancelSubscription = (options, path = "/cancel-subscription") => disablePaystackSubscription(options, path);
const restoreSubscription = (options, path = "/restore-subscription") => enablePaystackSubscription(options, path);
const verifyTransaction = (options, path = "/verify-transaction") => {
	const verifyBodySchema = z.object({ reference: z.string() });
	const subscriptionOptions = options.subscription;
	return createAuthEndpoint(path, {
		method: "POST",
		body: verifyBodySchema,
		use: subscriptionOptions?.enabled === true ? [
			sessionMiddleware,
			originCheck,
			referenceMiddleware(options, "verify-transaction")
		] : [sessionMiddleware, originCheck]
	}, async (ctx) => {
		const paystack = getPaystackOps(options.paystackClient);
		let data;
		try {
			data = unwrapSdkResult(await paystack?.transaction?.verify(ctx.body.reference));
		} catch (error) {
			ctx.context.logger.error("Failed to verify Paystack transaction", error);
			throw new APIError("BAD_REQUEST", {
				code: "FAILED_TO_VERIFY_TRANSACTION",
				message: error instanceof Error ? error.message : PAYSTACK_ERROR_CODES.FAILED_TO_VERIFY_TRANSACTION.message
			});
		}
		if (data === void 0 || data === null) throw new APIError("BAD_REQUEST", { message: "Failed to fetch transaction data from Paystack." });
		const status = data.status ?? "failed";
		const reference = data.reference ?? ctx.body.reference;
		const paystackIdRaw = data.id;
		const paystackId = paystackIdRaw !== void 0 && paystackIdRaw !== null ? String(paystackIdRaw) : void 0;
		const authorizationCode = data.authorization?.authorization_code;
		const allowedSubscriptionChannels = getAllowedSubscriptionChannels(options);
		if (status === "success") {
			const session = await getSessionFromCtx(ctx);
			const txRecord = await ctx.context.adapter.findOne({
				model: "paystackTransaction",
				where: [{
					field: "reference",
					value: reference
				}]
			});
			const referenceId = txRecord !== void 0 && txRecord !== null && txRecord.referenceId !== void 0 && txRecord.referenceId !== null && txRecord.referenceId !== "" ? txRecord.referenceId : session !== void 0 && session !== null ? session.user.id : void 0;
			if ((txRecord?.plan !== void 0 && txRecord.plan !== null && txRecord.plan !== "" || Boolean(data.plan)) && isAllowedSubscriptionChannel(data.channel ?? void 0, allowedSubscriptionChannels) === false) {
				await ctx.context.adapter.update({
					model: "paystackTransaction",
					update: {
						status: "failed",
						paystackId,
						amount: data.amount,
						currency: data.currency,
						updatedAt: /* @__PURE__ */ new Date()
					},
					where: [{
						field: "reference",
						value: reference
					}]
				});
				throw new APIError("BAD_REQUEST", {
					code: "SUBSCRIPTION_PAYMENT_CHANNEL_NOT_ALLOWED",
					message: `This subscription requires one of: ${allowedSubscriptionChannels?.join(", ") ?? "allowed channels"}.`
				});
			}
			if (session !== void 0 && session !== null && referenceId !== void 0 && referenceId !== null && referenceId !== "" && referenceId !== session.user.id) {
				const authRef = subscriptionOptions?.authorizeReference;
				let authorized = false;
				if (authRef !== void 0 && authRef !== null) authorized = await authRef({
					user: session.user,
					session: session.session,
					referenceId,
					action: "verify-transaction"
				}, ctx);
				if (authorized === false && options.organization?.enabled === true) {
					const member = await ctx.context.adapter.findOne({
						model: "member",
						where: [{
							field: "userId",
							value: session.user.id
						}, {
							field: "organizationId",
							value: referenceId
						}]
					});
					if (member !== void 0 && member !== null) authorized = true;
				}
				if (authorized === false) throw new APIError("UNAUTHORIZED");
			}
			try {
				await ctx.context.adapter.update({
					model: "paystackTransaction",
					update: {
						status: "success",
						paystackId,
						amount: data.amount,
						currency: data.currency,
						updatedAt: /* @__PURE__ */ new Date()
					},
					where: [{
						field: "reference",
						value: reference
					}]
				});
				const paystackCustomerCodeFromPaystack = data.customer?.customer_code;
				if (paystackCustomerCodeFromPaystack !== void 0 && paystackCustomerCodeFromPaystack !== null && paystackCustomerCodeFromPaystack !== "" && referenceId !== void 0 && referenceId !== null && referenceId !== "") {
					let isOrg = options.organization?.enabled === true && typeof referenceId === "string" && referenceId.startsWith("org_");
					if (isOrg === false && options.organization?.enabled === true) {
						const org = await ctx.context.adapter.findOne({
							model: "organization",
							where: [{
								field: "id",
								value: referenceId
							}]
						});
						isOrg = org !== void 0 && org !== null;
					}
					if (isOrg) await ctx.context.adapter.update({
						model: "organization",
						update: { paystackCustomerCode: paystackCustomerCodeFromPaystack },
						where: [{
							field: "id",
							value: referenceId
						}]
					});
					else await ctx.context.adapter.update({
						model: "user",
						update: { paystackCustomerCode: paystackCustomerCodeFromPaystack },
						where: [{
							field: "id",
							value: referenceId
						}]
					});
				}
				const transaction = await ctx.context.adapter.findOne({
					model: "paystackTransaction",
					where: [{
						field: "reference",
						value: reference
					}]
				});
				if (transaction !== void 0 && transaction !== null && transaction.product !== void 0 && transaction.product !== null && transaction.product !== "" && options.paystackClient !== void 0 && options.paystackClient !== null) await syncProductQuantityFromPaystack(ctx, transaction.product, options.paystackClient);
				let isTrial = false;
				let trialEnd;
				let targetPlan;
				let metadataObj = {};
				if (data.metadata !== void 0 && data.metadata !== null && data.metadata !== "") {
					metadataObj = typeof data.metadata === "string" ? JSON.parse(data.metadata) : data.metadata;
					isTrial = metadataObj.isTrial === true || metadataObj.isTrial === "true";
					trialEnd = metadataObj.trialEnd;
					targetPlan = metadataObj.plan;
				}
				if (metadataObj.type === "proration") {
					const subscriptionId = metadataObj.subscriptionId;
					const newPlan = metadataObj.newPlan;
					const newSeatCount = metadataObj.newSeatCount;
					if (subscriptionId !== void 0 && subscriptionId !== "" && newPlan !== void 0 && newPlan !== "") await ctx.context.adapter.update({
						model: "subscription",
						update: {
							plan: newPlan,
							...typeof newSeatCount === "number" ? { seats: newSeatCount } : {},
							paystackTransactionReference: reference,
							...authorizationCode !== void 0 && authorizationCode !== null ? { paystackAuthorizationCode: authorizationCode } : {},
							updatedAt: /* @__PURE__ */ new Date()
						},
						where: [{
							field: "id",
							value: subscriptionId
						}]
					});
					return ctx.json({
						status,
						reference,
						data
					});
				}
				let paystackSubscriptionCode;
				if (isTrial && targetPlan !== void 0 && trialEnd !== void 0) {
					const email = data.customer?.email;
					const planConfig = (await getPlans(subscriptionOptions)).find((p) => p.name.toLowerCase() === targetPlan?.toLowerCase());
					if (planConfig !== void 0 && planConfig !== null && (planConfig.planCode === void 0 || planConfig.planCode === null || planConfig.planCode === "")) paystackSubscriptionCode = `LOC_${reference}`;
					if (authorizationCode !== void 0 && authorizationCode !== null && email !== void 0 && email !== null && email !== "" && planConfig?.planCode !== void 0 && planConfig.planCode !== null && planConfig.planCode !== "") paystackSubscriptionCode = unwrapSdkResult(await paystack?.subscription?.create({ body: {
						customer: email,
						plan: planConfig.planCode,
						authorization: authorizationCode,
						start_date: trialEnd
					} }))?.subscription_code;
				} else if (isTrial === false) {
					const planCodeFromPaystack = data.plan?.plan_code;
					if (planCodeFromPaystack === void 0 || planCodeFromPaystack === null || planCodeFromPaystack === "") paystackSubscriptionCode = `LOC_${reference}`;
					else paystackSubscriptionCode = data.subscription?.subscription_code ?? void 0;
				}
				const targetSub = (await ctx.context.adapter.findMany({
					model: "subscription",
					where: [{
						field: "paystackTransactionReference",
						value: reference
					}]
				}))?.find((s) => referenceId === void 0 || referenceId === null || referenceId === "" || s.referenceId === referenceId);
				let updatedSubscription = null;
				if (targetSub !== void 0 && targetSub !== null) updatedSubscription = await ctx.context.adapter.update({
					model: "subscription",
					update: {
						status: isTrial ? "trialing" : "active",
						periodStart: /* @__PURE__ */ new Date(),
						updatedAt: /* @__PURE__ */ new Date(),
						...isTrial && trialEnd !== void 0 ? {
							trialStart: /* @__PURE__ */ new Date(),
							trialEnd: new Date(trialEnd),
							periodEnd: new Date(trialEnd)
						} : {},
						...paystackSubscriptionCode !== void 0 ? { paystackSubscriptionCode } : {},
						...authorizationCode !== void 0 && authorizationCode !== null ? { paystackAuthorizationCode: authorizationCode } : {}
					},
					where: [{
						field: "id",
						value: targetSub.id
					}]
				});
				if (updatedSubscription !== void 0 && updatedSubscription !== null && subscriptionOptions?.onSubscriptionComplete !== void 0) {
					const plan = (await getPlans(subscriptionOptions)).find((p) => p.name.toLowerCase() === updatedSubscription.plan.toLowerCase());
					if (plan !== void 0) await subscriptionOptions.onSubscriptionComplete({
						event: data,
						subscription: updatedSubscription,
						plan
					}, ctx);
				}
			} catch (e) {
				ctx.context.logger.error("Failed to update transaction/subscription after verification", e);
			}
		}
		return ctx.json({
			status,
			reference,
			data
		});
	});
};
const listSubscriptions = (options, path = "/list-subscriptions") => {
	const listQuerySchema = z.object({ referenceId: z.string().optional() });
	const subscriptionOptions = options.subscription;
	return createAuthEndpoint(path, {
		method: "GET",
		query: listQuerySchema,
		use: subscriptionOptions?.enabled === true ? [
			sessionMiddleware,
			originCheck,
			referenceMiddleware(options, "list-subscriptions")
		] : [sessionMiddleware, originCheck]
	}, async (ctx) => {
		if (subscriptionOptions?.enabled !== true) throw new APIError("BAD_REQUEST", { message: "Subscriptions are not enabled in the Paystack options." });
		const session = await getSessionFromCtx(ctx);
		if (session === void 0 || session === null) throw new APIError("UNAUTHORIZED");
		const referenceIdPart = ctx.context.referenceId;
		const queryRefId = ctx.query?.referenceId;
		const referenceId = referenceIdPart ?? queryRefId ?? session.user.id;
		const res = await ctx.context.adapter.findMany({
			model: "subscription",
			where: [{
				field: "referenceId",
				value: referenceId
			}]
		});
		return ctx.json({ subscriptions: res });
	});
};
const listTransactions = (options, path = "/list-transactions") => {
	return createAuthEndpoint(path, {
		method: "GET",
		query: z.object({ referenceId: z.string().optional() }),
		use: options.subscription?.enabled === true ? [
			sessionMiddleware,
			originCheck,
			referenceMiddleware(options, "list-transactions")
		] : [sessionMiddleware, originCheck]
	}, async (ctx) => {
		const session = await getSessionFromCtx(ctx);
		if (session === void 0 || session === null) throw new APIError("UNAUTHORIZED");
		const referenceIdPart = ctx.context.referenceId;
		const queryRefId = ctx.query?.referenceId;
		const referenceId = referenceIdPart ?? queryRefId ?? session.user.id;
		const sorted = (await ctx.context.adapter.findMany({
			model: "paystackTransaction",
			where: [{
				field: "referenceId",
				value: referenceId
			}]
		})).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
		return ctx.json({ transactions: sorted });
	});
};
const enableDisableBodySchema = z.object({
	referenceId: z.string().optional(),
	subscriptionCode: z.string(),
	emailToken: z.string().optional(),
	atPeriodEnd: z.boolean().optional()
});
function decodeBase64UrlToString(value) {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized + "===".slice((normalized.length + 3) % 4);
	const binaryString = atob(padded);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
	return new TextDecoder().decode(bytes);
}
function tryGetEmailTokenFromSubscriptionManageLink(link) {
	try {
		const subscriptionToken = new URL(link).searchParams.get("subscription_token");
		if (subscriptionToken === void 0 || subscriptionToken === null || subscriptionToken === "") return void 0;
		const parts = subscriptionToken.split(".");
		if (parts.length < 2) return void 0;
		const payloadJson = decodeBase64UrlToString(parts[1]);
		const payload = JSON.parse(payloadJson);
		return typeof payload.email_token === "string" ? payload.email_token : void 0;
	} catch {
		return;
	}
}
const disablePaystackSubscription = (options, path = "/disable-subscription") => {
	return createAuthEndpoint(path, {
		method: "POST",
		body: enableDisableBodySchema,
		use: options.subscription?.enabled === true ? [
			sessionMiddleware,
			originCheck,
			referenceMiddleware(options, "disable-subscription")
		] : [sessionMiddleware, originCheck]
	}, async (ctx) => {
		const { subscriptionCode, atPeriodEnd } = ctx.body;
		const paystack = getPaystackOps(options.paystackClient);
		try {
			if (isLocalSubscriptionCode(subscriptionCode)) {
				const sub = await ctx.context.adapter.findOne({
					model: "subscription",
					where: [{
						field: "paystackSubscriptionCode",
						value: subscriptionCode
					}]
				});
				if (sub !== null && sub !== void 0) {
					await ctx.context.adapter.update({
						model: "subscription",
						update: {
							status: atPeriodEnd === false ? "canceled" : "active",
							cancelAtPeriodEnd: atPeriodEnd !== false,
							updatedAt: /* @__PURE__ */ new Date()
						},
						where: [{
							field: "id",
							value: sub.id
						}]
					});
					return ctx.json({ status: "success" });
				}
				throw new APIError("BAD_REQUEST", { message: "Subscription not found" });
			}
			let emailToken = ctx.body.emailToken;
			let nextPaymentDate;
			try {
				const fetchRes = unwrapSdkResult(await paystack?.subscription?.fetch(subscriptionCode));
				if (fetchRes !== void 0 && fetchRes !== null) {
					emailToken ??= fetchRes.email_token ?? void 0;
					nextPaymentDate = fetchRes.next_payment_date ?? void 0;
				}
			} catch {}
			if (emailToken === void 0 || emailToken === null || emailToken === "") try {
				const link = unwrapSdkResult(await paystack?.subscription?.manageLink(subscriptionCode))?.link;
				if (link !== void 0 && link !== null && link !== "") emailToken = tryGetEmailTokenFromSubscriptionManageLink(link);
			} catch {}
			if (emailToken === void 0 || emailToken === null || emailToken === "") throw new Error("Could not retrieve email_token for subscription disable.");
			await paystack?.subscription?.disable({ body: {
				code: subscriptionCode,
				token: emailToken
			} });
			const periodEnd = nextPaymentDate !== void 0 && nextPaymentDate !== null && nextPaymentDate !== "" ? new Date(nextPaymentDate) : void 0;
			const sub = await ctx.context.adapter.findOne({
				model: "subscription",
				where: [{
					field: "paystackSubscriptionCode",
					value: subscriptionCode
				}]
			});
			if (sub !== void 0 && sub !== null) await ctx.context.adapter.update({
				model: "subscription",
				update: {
					status: atPeriodEnd === false ? "canceled" : "active",
					cancelAtPeriodEnd: atPeriodEnd !== false,
					periodEnd,
					updatedAt: /* @__PURE__ */ new Date()
				},
				where: [{
					field: "id",
					value: sub.id
				}]
			});
			else ctx.context.logger.warn(`Could not find subscription with code ${subscriptionCode} to disable`);
			return ctx.json({ status: "success" });
		} catch (error) {
			ctx.context.logger.error("Failed to disable subscription", error);
			throw new APIError("BAD_REQUEST", {
				code: "FAILED_TO_DISABLE_SUBSCRIPTION",
				message: error instanceof Error ? error.message : PAYSTACK_ERROR_CODES.FAILED_TO_DISABLE_SUBSCRIPTION.message
			});
		}
	});
};
const enablePaystackSubscription = (options, path = "/enable-subscription") => {
	return createAuthEndpoint(path, {
		method: "POST",
		body: enableDisableBodySchema,
		use: options.subscription?.enabled === true ? [
			sessionMiddleware,
			originCheck,
			referenceMiddleware(options, "enable-subscription")
		] : [sessionMiddleware, originCheck]
	}, async (ctx) => {
		const { subscriptionCode } = ctx.body;
		const paystack = getPaystackOps(options.paystackClient);
		try {
			let emailToken = ctx.body.emailToken;
			if (emailToken === void 0 || emailToken === null || emailToken === "") try {
				const fetchRes = unwrapSdkResult(await paystack?.subscription?.fetch(subscriptionCode));
				if (fetchRes !== void 0 && fetchRes !== null) emailToken = fetchRes.email_token ?? void 0;
			} catch {}
			if (emailToken === void 0 || emailToken === null || emailToken === "") try {
				const link = unwrapSdkResult(await paystack?.subscription?.manageLink(subscriptionCode))?.link;
				if (link !== void 0 && link !== null && link !== "") emailToken = tryGetEmailTokenFromSubscriptionManageLink(link);
			} catch {}
			if (emailToken === void 0 || emailToken === null || emailToken === "") throw new APIError("BAD_REQUEST", { message: "Could not retrieve email_token for subscription enable." });
			await paystack?.subscription?.enable({ body: {
				code: subscriptionCode,
				token: emailToken
			} });
			await ctx.context.adapter.update({
				model: "subscription",
				update: {
					status: "active",
					updatedAt: /* @__PURE__ */ new Date()
				},
				where: [{
					field: "paystackSubscriptionCode",
					value: subscriptionCode
				}]
			});
			return ctx.json({ status: "success" });
		} catch (error) {
			ctx.context.logger.error("Failed to enable subscription", error);
			throw new APIError("BAD_REQUEST", {
				code: "FAILED_TO_ENABLE_SUBSCRIPTION",
				message: error instanceof Error ? error.message : PAYSTACK_ERROR_CODES.FAILED_TO_ENABLE_SUBSCRIPTION.message
			});
		}
	});
};
const getSubscriptionManageLink = (options, path = "/subscription-manage-link") => {
	const manageLinkQuerySchema = z.object({ subscriptionCode: z.string() });
	const useMiddlewares = options.subscription?.enabled === true ? [
		sessionMiddleware,
		originCheck,
		referenceMiddleware(options, "get-subscription-manage-link")
	] : [sessionMiddleware, originCheck];
	const handler = async (ctx) => {
		const { subscriptionCode } = ctx.query;
		if (isLocalSubscriptionCode(subscriptionCode)) return ctx.json({
			link: null,
			message: "Local subscriptions cannot be managed on Paystack"
		});
		const paystack = getPaystackOps(options.paystackClient);
		try {
			const res = unwrapSdkResult(await paystack?.subscription?.manageLink(subscriptionCode));
			return ctx.json({ link: res?.link || null });
		} catch (error) {
			ctx.context.logger.error("Failed to get subscription manage link", error);
			throw new APIError("BAD_REQUEST", { message: error instanceof Error ? error.message : "Failed to get subscription manage link" });
		}
	};
	return createAuthEndpoint(path, {
		method: "GET",
		query: manageLinkQuerySchema,
		use: useMiddlewares
	}, handler);
};
const listProducts = (_options, path = "/list-products") => {
	return createAuthEndpoint(path, {
		method: "GET",
		metadata: { openapi: { operationId: "listPaystackProducts" } }
	}, async (ctx) => {
		const sorted = (await ctx.context.adapter.findMany({ model: "paystackProduct" })).sort((a, b) => a.name.localeCompare(b.name));
		return ctx.json({ products: sorted });
	});
};
const listPlans = (_options, path = "/list-plans") => {
	return createAuthEndpoint(path, {
		method: "GET",
		metadata: { ...HIDE_METADATA },
		use: [sessionMiddleware]
	}, async (ctx) => {
		try {
			const plans = await ctx.context.adapter.findMany({ model: "paystackPlan" });
			return ctx.json({ plans });
		} catch (error) {
			ctx.context.logger.error("Failed to list plans", error);
			throw new APIError("BAD_REQUEST", { message: error instanceof Error ? error.message : "Failed to list plans" });
		}
	});
};
const getConfig = (options, path = "/get-config") => {
	return createAuthEndpoint(path, {
		method: "GET",
		metadata: { openapi: { operationId: "getPaystackConfig" } }
	}, async (ctx) => {
		const plans = options.subscription?.enabled === true ? await getPlans(options.subscription) : [];
		const products = await getProducts(options.products);
		return ctx.json({
			plans,
			products
		});
	});
};
//#endregion
//#region src/schema.ts
const transactions = { paystackTransaction: { fields: {
	reference: {
		type: "string",
		required: true,
		unique: true
	},
	paystackId: {
		type: "string",
		required: false
	},
	referenceId: {
		type: "string",
		required: true,
		index: true
	},
	userId: {
		type: "string",
		required: true,
		index: true
	},
	amount: {
		type: "number",
		required: true
	},
	currency: {
		type: "string",
		required: true
	},
	status: {
		type: "string",
		required: true
	},
	plan: {
		type: "string",
		required: false
	},
	product: {
		type: "string",
		required: false
	},
	metadata: {
		type: "string",
		required: false
	},
	createdAt: {
		type: "date",
		required: true
	},
	updatedAt: {
		type: "date",
		required: true
	}
} } };
const subscriptions = { subscription: { fields: {
	plan: {
		type: "string",
		required: true,
		index: true
	},
	referenceId: {
		type: "string",
		required: true,
		index: true
	},
	paystackCustomerCode: {
		type: "string",
		required: false,
		index: true
	},
	paystackSubscriptionCode: {
		type: "string",
		required: false,
		unique: true
	},
	paystackTransactionReference: {
		type: "string",
		required: false,
		index: true
	},
	paystackAuthorizationCode: {
		type: "string",
		required: false
	},
	paystackEmailToken: {
		type: "string",
		required: false
	},
	status: {
		type: "string",
		defaultValue: "incomplete"
	},
	periodStart: {
		type: "date",
		required: false
	},
	periodEnd: {
		type: "date",
		required: false
	},
	trialStart: {
		type: "date",
		required: false
	},
	trialEnd: {
		type: "date",
		required: false
	},
	cancelAtPeriodEnd: {
		type: "boolean",
		required: false,
		defaultValue: false
	},
	groupId: {
		type: "string",
		required: false
	},
	seats: {
		type: "number",
		required: false
	},
	pendingPlan: {
		type: "string",
		required: false
	}
} } };
const user = { user: { fields: { paystackCustomerCode: {
	type: "string",
	required: false,
	index: true
} } } };
const organization = { organization: { fields: {
	paystackCustomerCode: {
		type: "string",
		required: false,
		index: true
	},
	email: {
		type: "string",
		required: false
	}
} } };
const products = { paystackProduct: { fields: {
	name: {
		type: "string",
		required: true
	},
	description: {
		type: "string",
		required: false
	},
	price: {
		type: "number",
		required: true
	},
	currency: {
		type: "string",
		required: true
	},
	quantity: {
		type: "number",
		required: false,
		defaultValue: 0
	},
	unlimited: {
		type: "boolean",
		required: false,
		defaultValue: true
	},
	paystackId: {
		type: "string",
		required: false,
		unique: true
	},
	slug: {
		type: "string",
		required: true,
		unique: true
	},
	metadata: {
		type: "string",
		required: false
	},
	createdAt: {
		type: "date",
		required: true
	},
	updatedAt: {
		type: "date",
		required: true
	}
} } };
const plans = { paystackPlan: { fields: {
	name: {
		type: "string",
		required: true
	},
	description: {
		type: "string",
		required: false
	},
	amount: {
		type: "number",
		required: true
	},
	currency: {
		type: "string",
		required: true
	},
	interval: {
		type: "string",
		required: true
	},
	planCode: {
		type: "string",
		required: true,
		unique: true
	},
	paystackId: {
		type: "string",
		required: true,
		unique: true
	},
	metadata: {
		type: "string",
		required: false
	},
	createdAt: {
		type: "date",
		required: true
	},
	updatedAt: {
		type: "date",
		required: true
	}
} } };
const getSchema = (options) => {
	let baseSchema;
	if (options.subscription?.enabled === true) baseSchema = {
		...subscriptions,
		...transactions,
		...user,
		...products,
		...plans
	};
	else baseSchema = {
		...user,
		...transactions,
		...products,
		...plans
	};
	if (options.organization?.enabled === true) baseSchema = {
		...baseSchema,
		...organization
	};
	if (options.schema !== void 0 && options.subscription?.enabled !== true && "subscription" in options.schema) {
		const { subscription: _subscription, ...restSchema } = options.schema;
		return mergeSchema(baseSchema, restSchema);
	}
	return mergeSchema(baseSchema, options.schema);
};
//#endregion
//#region src/operations.ts
async function syncPaystackProducts(ctx, options) {
	const paystack = getPaystackOps(options.paystackClient);
	try {
		const productsData = unwrapSdkResult(await paystack?.product?.list({}));
		if (!Array.isArray(productsData)) return {
			status: "success",
			count: 0
		};
		for (const product of productsData) {
			const paystackId = String(product.id);
			const existing = await ctx.context.adapter.findOne({
				model: "paystackProduct",
				where: [{
					field: "paystackId",
					value: paystackId
				}]
			});
			const productFields = {
				name: product.name ?? "",
				description: product.description ?? "",
				price: product.price ?? 0,
				currency: product.currency ?? "",
				quantity: product.quantity ?? 0,
				unlimited: product.unlimited !== void 0 && product.unlimited !== null && product.unlimited !== false,
				paystackId,
				slug: product.slug ?? product.name?.toLowerCase().replace(/\s+/g, "-") ?? "",
				metadata: product.metadata !== void 0 && product.metadata !== null ? JSON.stringify(product.metadata) : void 0,
				updatedAt: /* @__PURE__ */ new Date()
			};
			if (existing !== void 0 && existing !== null) await ctx.context.adapter.update({
				model: "paystackProduct",
				update: productFields,
				where: [{
					field: "id",
					value: String(existing.id)
				}]
			});
			else await ctx.context.adapter.create({
				model: "paystackProduct",
				data: {
					...productFields,
					createdAt: /* @__PURE__ */ new Date()
				}
			});
		}
		return {
			status: "success",
			count: productsData.length
		};
	} catch (error) {
		ctx.context.logger.error("Failed to sync products", error);
		throw new APIError("BAD_REQUEST", { message: error instanceof Error ? error.message : "Failed to sync products" });
	}
}
async function syncPaystackPlans(ctx, options) {
	const paystack = getPaystackOps(options.paystackClient);
	try {
		const plansData = unwrapSdkResult(await paystack?.plan?.list());
		if (!Array.isArray(plansData)) return {
			status: "success",
			count: 0
		};
		for (const plan of plansData) {
			const paystackId = String(plan.id);
			const existing = await ctx.context.adapter.findOne({
				model: "paystackPlan",
				where: [{
					field: "paystackId",
					value: paystackId
				}]
			});
			const planData = {
				name: plan.name ?? "",
				description: plan.description ?? "",
				amount: plan.amount ?? 0,
				currency: plan.currency ?? "",
				interval: plan.interval ?? "",
				planCode: plan.plan_code ?? "",
				paystackId,
				metadata: plan.metadata !== void 0 && plan.metadata !== null ? JSON.stringify(plan.metadata) : void 0,
				updatedAt: /* @__PURE__ */ new Date()
			};
			if (existing !== void 0 && existing !== null) await ctx.context.adapter.update({
				model: "paystackPlan",
				update: planData,
				where: [{
					field: "id",
					value: existing.id
				}]
			});
			else await ctx.context.adapter.create({
				model: "paystackPlan",
				data: {
					...planData,
					createdAt: /* @__PURE__ */ new Date()
				}
			});
		}
		return {
			status: "success",
			count: plansData.length
		};
	} catch (error) {
		ctx.context.logger.error("Failed to sync plans", error);
		throw new APIError("BAD_REQUEST", { message: error instanceof Error ? error.message : "Failed to sync plans" });
	}
}
async function chargeSubscriptionRenewal(ctx, options, input) {
	const { subscriptionId, amount: bodyAmount } = input;
	const subscription = await ctx.context.adapter.findOne({
		model: "subscription",
		where: [{
			field: "id",
			value: subscriptionId
		}]
	});
	if (subscription === void 0 || subscription === null) throw new APIError("NOT_FOUND", { message: "Subscription not found" });
	if (subscription.paystackAuthorizationCode === void 0 || subscription.paystackAuthorizationCode === null || subscription.paystackAuthorizationCode === "") throw new APIError("BAD_REQUEST", { message: "No authorization code found for this subscription" });
	const plan = (await getPlans(options.subscription)).find((candidate) => candidate.name.toLowerCase() === subscription.plan.toLowerCase());
	if (plan === void 0 || plan === null) throw new APIError("NOT_FOUND", { message: "Plan not found" });
	const amount = bodyAmount ?? plan.amount;
	if (amount === void 0 || amount === null) throw new APIError("BAD_REQUEST", { message: "Plan amount is not defined" });
	let email;
	let billingUserId = subscription.userId;
	const referenceId = subscription.referenceId;
	if (referenceId !== void 0 && referenceId !== null && referenceId !== "") {
		const user = await ctx.context.adapter.findOne({
			model: "user",
			where: [{
				field: "id",
				value: referenceId
			}]
		});
		if (user !== void 0 && user !== null) {
			email = user.email;
			billingUserId = user.id;
		} else if (options.organization?.enabled === true) {
			const ownerMember = await ctx.context.adapter.findOne({
				model: "member",
				where: [{
					field: "organizationId",
					value: referenceId
				}, {
					field: "role",
					value: "owner"
				}]
			});
			if (ownerMember !== void 0 && ownerMember !== null) {
				const ownerUser = await ctx.context.adapter.findOne({
					model: "user",
					where: [{
						field: "id",
						value: ownerMember.userId
					}]
				});
				email = ownerUser?.email;
				billingUserId = ownerUser?.id ?? ownerMember.userId;
			}
		}
	}
	if (email === void 0 || email === null || email === "") throw new APIError("NOT_FOUND", { message: "User email not found" });
	const finalCurrency = plan.currency ?? "NGN";
	if (!validateMinAmount(amount, finalCurrency)) throw new APIError("BAD_REQUEST", {
		message: `Amount ${amount} is less than the minimum required for ${finalCurrency}.`,
		status: 400
	});
	const chargeData = unwrapSdkResult(await getPaystackOps(options.paystackClient)?.transaction?.chargeAuthorization({ body: {
		email,
		amount,
		authorization_code: subscription.paystackAuthorizationCode,
		reference: `rec_${subscription.id}_${Date.now()}`,
		metadata: JSON.stringify({
			subscriptionId,
			referenceId
		})
	} }));
	if (chargeData?.status === "success" && chargeData.reference !== void 0) {
		const now = /* @__PURE__ */ new Date();
		const nextPeriodEnd = getNextPeriodEnd(now, plan.interval ?? "monthly");
		await ctx.context.adapter.create({
			model: "paystackTransaction",
			data: {
				reference: chargeData.reference,
				paystackId: chargeData.id !== void 0 && chargeData.id !== null ? String(chargeData.id) : void 0,
				referenceId,
				userId: billingUserId,
				amount: chargeData.amount,
				currency: chargeData.currency,
				status: "success",
				plan: plan.name.toLowerCase(),
				metadata: JSON.stringify({
					type: "renewal",
					subscriptionId,
					referenceId
				}),
				createdAt: now,
				updatedAt: now
			}
		});
		await ctx.context.adapter.update({
			model: "subscription",
			update: {
				periodStart: now,
				periodEnd: nextPeriodEnd,
				updatedAt: now,
				paystackTransactionReference: chargeData.reference
			},
			where: [{
				field: "id",
				value: subscription.id
			}]
		});
		return {
			status: "success",
			data: chargeData
		};
	}
	return {
		status: "failed",
		data: chargeData
	};
}
//#endregion
//#region src/index.ts
const INTERNAL_ERROR_CODES = defineErrorCodes(Object.fromEntries(Object.entries(PAYSTACK_ERROR_CODES).map(([key, value]) => [key, typeof value === "string" ? value : value.message])));
const paystack = (options) => {
	const routeOptions = {
		...options,
		webhook: {
			...options.webhook,
			secret: options.webhook?.secret ?? options.paystackWebhookSecret
		}
	};
	return {
		id: "paystack",
		endpoints: {
			initializeTransaction: initializeTransaction(routeOptions, "/paystack/initialize-transaction"),
			verifyTransaction: verifyTransaction(routeOptions, "/paystack/verify-transaction"),
			listSubscriptions: listSubscriptions(routeOptions, "/paystack/list-subscriptions"),
			paystackWebhook: paystackWebhook(routeOptions, "/paystack/webhook"),
			listTransactions: listTransactions(routeOptions, "/paystack/list-transactions"),
			getConfig: getConfig(routeOptions, "/paystack/config"),
			disableSubscription: disablePaystackSubscription(routeOptions, "/paystack/disable-subscription"),
			enableSubscription: enablePaystackSubscription(routeOptions, "/paystack/enable-subscription"),
			getSubscriptionManageLink: getSubscriptionManageLink(routeOptions, "/paystack/subscription-manage-link"),
			subscriptionManageLink: getSubscriptionManageLink(routeOptions, "/paystack/subscription/manage-link"),
			createSubscription: createSubscription(routeOptions, "/paystack/create-subscription"),
			upgradeSubscription: upgradeSubscription(routeOptions, "/paystack/upgrade-subscription"),
			cancelSubscription: cancelSubscription(routeOptions, "/paystack/cancel-subscription"),
			restoreSubscription: restoreSubscription(routeOptions, "/paystack/restore-subscription"),
			listProducts: listProducts(routeOptions, "/paystack/list-products"),
			listPlans: listPlans(routeOptions, "/paystack/list-plans")
		},
		schema: getSchema(options),
		init: (ctx) => {
			return { options: {
				databaseHooks: {
					user: { create: { async after(user, hookCtx) {
						if (!hookCtx || options.createCustomerOnSignUp !== true || user.email === null || user.email === void 0 || user.email === "") return;
						try {
							const paystackOps = getPaystackOps(options.paystackClient);
							if (!paystackOps) return;
							const sdkRes = unwrapSdkResult(await paystackOps.customer?.create({ body: {
								email: user.email,
								first_name: user.name ?? void 0,
								metadata: JSON.stringify({ userId: user.id })
							} }) ?? await Promise.reject(/* @__PURE__ */ new Error("Paystack client missing customer ops")));
							const customerCode = sdkRes?.customer_code;
							if (customerCode !== void 0 && customerCode !== null && customerCode !== "") {
								await ctx.adapter.update({
									model: "user",
									where: [{
										field: "id",
										value: user.id
									}],
									update: { paystackCustomerCode: customerCode }
								});
								if (typeof options.onCustomerCreate === "function") await options.onCustomerCreate({
									paystackCustomer: sdkRes,
									user: {
										...user,
										paystackCustomerCode: customerCode
									}
								}, hookCtx);
							}
						} catch (error) {
							ctx.logger.error("Failed to create Paystack customer for user", error);
						}
					} } },
					organization: options.organization?.enabled === true ? { create: { async after(org, hookCtx) {
						try {
							const extraCreateParams = typeof options.organization?.getCustomerCreateParams === "function" ? await options.organization.getCustomerCreateParams(org, hookCtx) : {};
							let targetEmail = org.email;
							if (targetEmail === void 0 || targetEmail === null) {
								const ownerMember = await ctx.adapter.findOne({
									model: "member",
									where: [{
										field: "organizationId",
										value: org.id
									}, {
										field: "role",
										value: "owner"
									}]
								});
								if (ownerMember !== null && ownerMember !== void 0) targetEmail = (await ctx.adapter.findOne({
									model: "user",
									where: [{
										field: "id",
										value: ownerMember.userId
									}]
								}))?.email;
							}
							if (targetEmail === void 0 || targetEmail === null) return;
							const params = defu({
								email: targetEmail,
								first_name: org.name,
								metadata: JSON.stringify({ organizationId: org.id })
							}, extraCreateParams);
							const paystackOps = getPaystackOps(options.paystackClient);
							if (!paystackOps) return;
							const sdkRes = unwrapSdkResult(await paystackOps.customer?.create({ body: params }) ?? await Promise.reject(/* @__PURE__ */ new Error("Paystack client missing customer ops")));
							const customerCode = sdkRes?.customer_code;
							if (customerCode !== void 0 && customerCode !== null && customerCode !== "" && sdkRes !== void 0 && sdkRes !== null) {
								await ctx.adapter.update({
									model: "organization",
									where: [{
										field: "id",
										value: org.id
									}],
									update: { paystackCustomerCode: customerCode }
								});
								if (typeof options.organization?.onCustomerCreate === "function") await options.organization.onCustomerCreate({
									paystackCustomer: sdkRes,
									organization: {
										...org,
										paystackCustomerCode: customerCode
									}
								}, hookCtx);
							}
						} catch (error) {
							ctx.logger.error("Failed to create Paystack customer for organization", error);
						}
					} } } : void 0
				},
				member: {
					create: {
						before: async (member, ctx) => {
							if (options.subscription?.enabled === true && member.organizationId && ctx !== null && ctx !== void 0) await checkSeatLimit(ctx, member.organizationId);
						},
						after: async (member, ctx) => {
							if (options.subscription?.enabled === true && typeof member?.organizationId === "string" && ctx) await syncSubscriptionSeats(ctx, member.organizationId, routeOptions);
						}
					},
					delete: { after: async (member, ctx) => {
						if (options.subscription?.enabled === true && typeof member?.organizationId === "string" && ctx) await syncSubscriptionSeats(ctx, member.organizationId, routeOptions);
					} }
				},
				invitation: {
					create: {
						before: async (invitation, ctx) => {
							if (options.subscription?.enabled === true && invitation.organizationId && ctx !== null && ctx !== void 0) await checkSeatLimit(ctx, invitation.organizationId);
						},
						after: async (invitation, ctx) => {
							if (options.subscription?.enabled === true && typeof invitation?.organizationId === "string" && ctx) await syncSubscriptionSeats(ctx, invitation.organizationId, routeOptions);
						}
					},
					delete: { after: async (invitation, ctx) => {
						if (options.subscription?.enabled === true && typeof invitation?.organizationId === "string" && ctx) await syncSubscriptionSeats(ctx, invitation.organizationId, routeOptions);
					} }
				},
				team: { create: { before: async (team, ctx) => {
					if (options.subscription?.enabled === true && team.organizationId && ctx) {
						const subscription = await getOrganizationSubscription(ctx, team.organizationId);
						if (subscription !== null && subscription !== void 0) {
							const maxTeams = ((await getPlanByName(routeOptions, subscription.plan))?.limits)?.teams;
							if (typeof maxTeams === "number") await checkTeamLimit(ctx, team.organizationId, maxTeams);
						}
					}
				} } }
			} };
		},
		$ERROR_CODES: INTERNAL_ERROR_CODES,
		options
	};
};
//#endregion
export { chargeSubscriptionRenewal, paystack, syncPaystackPlans, syncPaystackProducts };

//# sourceMappingURL=index.mjs.map