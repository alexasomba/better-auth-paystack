import type { PaystackClientLike, PaystackOptions, PaystackProduct } from "./types";
import { getPaystackOps, unwrapSdkResult } from "./paystack-sdk";

export async function getPlans(subscriptionOptions: PaystackOptions["subscription"]) {
	if (subscriptionOptions?.enabled === true) {
		return typeof subscriptionOptions.plans === "function"
			? subscriptionOptions.plans()
			: subscriptionOptions.plans;
	}
	throw new Error("Subscriptions are not enabled in the Paystack options.");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getPlan = async (options: PaystackOptions<PaystackClientLike, any, any>, planId: string) => {
	if (options.subscription?.enabled === true) {
		const plans = await getPlans(options.subscription);
		return plans.find((plan) => plan.name === planId) ?? null;
	}
	return null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPlanByName(options: PaystackOptions<PaystackClientLike, any, any>, name: string) {
	if (options.subscription?.enabled === true) {
		const plans = await getPlans(options.subscription);
		return plans.find(
			(plan) => plan.name.toLowerCase() === name.toLowerCase(),
		) ?? null;
	}
	return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPlanByPriceId(options: PaystackOptions<PaystackClientLike, any, any>, priceId: string) {
	if (options.subscription?.enabled === true) {
		const plans = await getPlans(options.subscription);
		return plans.find((plan) => plan.name === priceId) ?? null;
	}
	return null;
}


export async function getProducts(productOptions: PaystackOptions["products"]) {
	if (productOptions?.products) {
		return typeof productOptions.products === "function"
			? await productOptions.products()
			: productOptions.products;
	}
	return [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getProductByName(options: PaystackOptions<PaystackClientLike, any, any>, name: string) {
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
	ctx: any,
	productName: string,
	paystackClient: PaystackClientLike,
): Promise<void> {
	// Find the local product record (by name or slug)
	let localProduct = await (ctx.context.adapter).findOne({
		model: "paystackProduct",
		where: [{ field: "name", value: productName }],
	}) as PaystackProduct | null;

	localProduct ??= await (ctx.context.adapter).findOne({
		model: "paystackProduct",
		where: [{ field: "slug", value: productName.toLowerCase().replace(/\s+/g, "-") }],
	}) as PaystackProduct | null;

	if (localProduct?.paystackId === undefined || localProduct?.paystackId === null || localProduct?.paystackId === "") {
		// No local record with a Paystack ID — fall back to local decrement
		if (localProduct && (localProduct as any).unlimited !== true && (localProduct as any).quantity !== undefined && (localProduct as any).quantity > 0) {
			await (ctx.context.adapter).update({
				model: "paystackProduct",
				update: { quantity: (localProduct as any).quantity - 1, updatedAt: new Date() },
				where: [{ field: "id", value: (localProduct as any).id }],
			});
		}
		return;
	}

	// Fetch the latest quantity from Paystack
	try {
		const ops = getPaystackOps(paystackClient);
		const raw = await ops.productFetch(localProduct.paystackId);
		const data = unwrapSdkResult<Record<string, unknown>>(raw);
		const remoteQuantity = data?.quantity as number | undefined;

		if (remoteQuantity !== undefined) {
			await (ctx.context.adapter).update({
				model: "paystackProduct",
				update: { quantity: remoteQuantity, updatedAt: new Date() },
				where: [{ field: "id", value: (localProduct as any).id }],
			});
		}
	} catch {
		// If API call fails, fall back to local decrement
		if ((localProduct as any).unlimited !== true && (localProduct as any).quantity !== undefined && (localProduct as any).quantity > 0) {
			await (ctx.context.adapter).update({
				model: "paystackProduct",
				update: { quantity: (localProduct as any).quantity - 1, updatedAt: new Date() },
				where: [{ field: "id", value: (localProduct as any).id }],
			});
		}
	}
}

/** @deprecated Use syncProductQuantityFromPaystack instead */
export async function decrementProductQuantity(ctx: any, productName: string) {
	let product = await (ctx.context.adapter).findOne({
		model: "paystackProduct",
		where: [{ field: "name", value: productName }],
	}) as PaystackProduct | null;

	product ??= await (ctx.context.adapter).findOne({
		model: "paystackProduct",
		where: [{ field: "slug", value: productName.toLowerCase().replace(/\s+/g, "-") }],
	}) as PaystackProduct | null;

	if (product) {
		if (product.unlimited !== true && product.quantity !== undefined && product.quantity > 0) {
			await (ctx.context.adapter).update({
				model: "paystackProduct",
				update: {
					quantity: (product as any).quantity - 1,
					updatedAt: new Date(),
				},
				where: [{ field: "id", value: (product as any).id }],
			});
		}
	}
}

export async function syncSubscriptionSeats(
	ctx: any,
	organizationId: string,
	options: PaystackOptions<PaystackClientLike, any, any>,
): Promise<void> {
	if (options.subscription?.enabled !== true) return;

	const adapter = ctx.context?.adapter ?? ctx.adapter;
	const subscription = await (adapter).findOne({
		model: "subscription",
		where: [{ field: "referenceId", value: organizationId }],
	});

	if (subscription === null || subscription.paystackSubscriptionCode === undefined || subscription.paystackSubscriptionCode === null) return;
	const plan = await getPlanByName(options, subscription.plan);
	if (plan === null) return;
	if (plan.seatAmount === undefined && plan.seatPlanCode === undefined) return;

	const members = await (adapter).findMany({
		model: "member",
		where: [{ field: "organizationId", value: organizationId }],
	});

	const quantity = members.length;
	let totalAmount = plan.amount ?? 0;

	if (plan.seatAmount !== undefined && plan.seatAmount !== null) {
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
		const log = ctx.context?.logger ?? ctx.logger;
		if (log !== undefined && log !== null) {
			log.error("Failed to sync subscription seats with Paystack", e);
		}
	}
}
