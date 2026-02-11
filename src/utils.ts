import type { PaystackClientLike, PaystackOptions } from "./types";

 
export async function getPlans(subscriptionOptions: PaystackOptions["subscription"]) {
	if (subscriptionOptions?.enabled === true) {
		return typeof subscriptionOptions.plans === "function"
			? subscriptionOptions.plans()
			: subscriptionOptions.plans;
	}
	throw new Error("Subscriptions are not enabled in the Paystack options.");
}

export const getPlan = async (options: PaystackOptions<PaystackClientLike>, planId: string) => {
	if (options.subscription?.enabled === true) {
		const plans = await getPlans(options.subscription);
		return plans.find((plan) => plan.name === planId) ?? null;
	}
	return null;
};

export async function getPlanByName(options: PaystackOptions<PaystackClientLike>, name: string) {
	if (options.subscription?.enabled === true) {
		const plans = await getPlans(options.subscription);
		return plans.find(
			(plan) => plan.name.toLowerCase() === name.toLowerCase(),
		) ?? null;
	}
	return null;
}

export async function getPlanByPriceId(options: PaystackOptions<PaystackClientLike>, priceId: string) {
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

export async function getProductByName(options: PaystackOptions<PaystackClientLike>, name: string) {
	return await getProducts(options.products).then((products) =>
		products?.find((product) => product.name.toLowerCase() === name.toLowerCase()),
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
