import type { GenericEndpointContext } from "better-auth";

import type { AnyPaystackOptions, PaystackClientLike, PaystackProduct, Subscription, PaystackProductResponse } from "./types";
import { getPaystackOps, unwrapSdkResult } from "./paystack-sdk";

export async function getPlans(subscriptionOptions: AnyPaystackOptions["subscription"]) {
	if (subscriptionOptions?.enabled === true) {
		return typeof subscriptionOptions.plans === "function"
			? subscriptionOptions.plans()
			: subscriptionOptions.plans;
	}
	throw new Error("Subscriptions are not enabled in the Paystack options.");
}

export const getPlan = async (options: AnyPaystackOptions, planId: string) => {
	if (options.subscription?.enabled === true) {
		const plans = await getPlans(options.subscription);
		return plans.find((plan) => plan.name === planId) ?? null;
	}
	return null;
};

export async function getPlanByName(options: AnyPaystackOptions, name: string) {
	if (options.subscription?.enabled === true) {
		const plans = await getPlans(options.subscription);
		return plans.find(
			(plan) => plan.name.toLowerCase() === name.toLowerCase(),
		) ?? null;
	}
	return null;
}

export async function getPlanByPriceId(options: AnyPaystackOptions, priceId: string) {
	if (options.subscription?.enabled === true) {
		const plans = await getPlans(options.subscription);
		return plans.find((plan) => plan.name === priceId) ?? null;
	}
	return null;
}


export async function getProducts(productOptions: AnyPaystackOptions["products"]) {
	if (productOptions?.products) {
		return typeof productOptions.products === "function"
			? await productOptions.products()
			: productOptions.products;
	}
	return [];
}

export async function getProductByName(options: AnyPaystackOptions, name: string) {
	return await getProducts(options.products).then((products) =>
		products?.find((product) => product.name.toLowerCase() === name.toLowerCase()) ?? null,
	);
}

export function getNextPeriodEnd(startDate: Date, interval: string): Date {
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
	default:
		// Default to monthly if unknown
		date.setMonth(date.getMonth() + 1);
	}
	return date;
}

/**
 * Validates if the amount meets Paystack's minimum transaction requirements.
 * Amounts should be in the smallest currency unit (e.g., kobo, cents).
 */
export function validateMinAmount(amount: number, currency: string): boolean {
	const minAmounts: Record<string, number> = {
		NGN: 5000, // 50.00
		GHS: 10,   // 0.10
		ZAR: 100,  // 1.00
		KES: 300,  // 3.00
		USD: 200,  // 2.00
		XOF: 100,  // 1.00
	};
	const min = minAmounts[currency.toUpperCase()];
	return min !== undefined ? amount >= min : true;
}

export async function syncProductQuantityFromPaystack(
	ctx: GenericEndpointContext,
	productName: string,
	paystackClient: PaystackClientLike,
): Promise<void> {
	// Find the local product record (by name or slug)
	let localProduct = await ctx.context.adapter.findOne<PaystackProduct>({
		model: "paystackProduct",
		where: [{ field: "name", value: productName }],
	});

	localProduct ??= await ctx.context.adapter.findOne<PaystackProduct>({
		model: "paystackProduct",
		where: [{ field: "slug", value: productName.toLowerCase().replace(/\s+/g, "-") }],
	});

	if (localProduct?.paystackId === undefined || localProduct.paystackId === null || localProduct.paystackId === "") {
		// No local record with a Paystack ID — fall back to local decrement
		if (localProduct !== null && localProduct.unlimited !== true && typeof localProduct.quantity === "number" && localProduct.quantity > 0) {
			await ctx.context.adapter.update({
				model: "paystackProduct",
				update: { quantity: localProduct.quantity - 1, updatedAt: new Date() },
				where: [{ field: "id", value: localProduct.id }],
			});
		}
		return;
	}

	// Fetch the latest quantity from Paystack
	try {
		const ops = getPaystackOps(paystackClient);
		const raw = await ops.productFetch(localProduct.paystackId);
		const sdkRes = unwrapSdkResult<PaystackProductResponse>(raw);
		const remoteQuantity = sdkRes?.quantity;

		if (remoteQuantity !== undefined) {
			await ctx.context.adapter.update({
				model: "paystackProduct",
				update: { quantity: remoteQuantity, updatedAt: new Date() },
				where: [{ field: "id", value: localProduct.id }],
			});
		}
	} catch {
		// If API call fails, fall back to local decrement
		if (localProduct !== null && localProduct.unlimited !== true && typeof localProduct.quantity === "number" && localProduct.quantity > 0) {
			await ctx.context.adapter.update({
				model: "paystackProduct",
				update: { quantity: localProduct.quantity - 1, updatedAt: new Date() },
				where: [{ field: "id", value: localProduct.id }],
			});
		}
	}
}

export async function decrementProductQuantity(ctx: GenericEndpointContext, productName: string) {
	let product = await ctx.context.adapter.findOne<PaystackProduct>({
		model: "paystackProduct",
		where: [{ field: "name", value: productName }],
	});

	product ??= await ctx.context.adapter.findOne<PaystackProduct>({
		model: "paystackProduct",
		where: [{ field: "slug", value: productName.toLowerCase().replace(/\s+/g, "-") }],
	});

	if (product) {
		if (product.unlimited !== true && typeof product.quantity === "number" && product.quantity > 0) {
			await ctx.context.adapter.update({
				model: "paystackProduct",
				update: {
					quantity: product.quantity - 1,
					updatedAt: new Date(),
				},
				where: [{ field: "id", value: product.id }],
			});
		}
	}
}

export async function syncSubscriptionSeats(
	ctx: GenericEndpointContext,
	organizationId: string,
	options: AnyPaystackOptions,
): Promise<void> {
	if (options.subscription?.enabled !== true) return;

	const adapter = ctx.context.adapter;
	const subscription = await adapter.findOne<Subscription>({
		model: "subscription",
		where: [{ field: "referenceId", value: organizationId }],
	});

	if (subscription?.paystackSubscriptionCode === undefined || subscription.paystackSubscriptionCode === null || subscription.paystackSubscriptionCode === "") return;
	const plan = await getPlanByName(options, subscription.plan);
	if (plan === null) return;
	if (plan.seatAmount === undefined && plan.seatPlanCode === undefined) return;

	const members = await (adapter).findMany({
		model: "member",
		where: [{ field: "organizationId", value: organizationId }],
	});

	const quantity = members.length;
	let totalAmount = plan.amount ?? 0;

	if (plan.seatAmount !== undefined && plan.seatAmount !== null && typeof plan.seatAmount === "number") {
		totalAmount += (quantity * plan.seatAmount);
	}

	const ops = getPaystackOps(options.paystackClient);
	try {
		// Paystack subscription update doesn't natively support quantity in the same way as Stripe
		// but we can update the amount or the plan.
		await ops.subscriptionUpdate({
			code: subscription.paystackSubscriptionCode,
			amount: totalAmount,
		});

		// Update local DB to reflect current seat count
		await (adapter).update({
			model: "subscription",
			where: [{ field: "id", value: subscription.id }],
			update: {
				seats: quantity,
				updatedAt: new Date(),
			},
		});
	} catch (e: unknown) {
		const log = ctx.context.logger;
		if (log !== undefined && log !== null) {
			log.error("Failed to sync subscription seats with Paystack", e);
		}
	}
}
