import { getPaystackOps, unwrapSdkResult } from "./paystack-sdk";
export async function getPlans(subscriptionOptions) {
    if (subscriptionOptions?.enabled === true) {
        return typeof subscriptionOptions.plans === "function"
            ? subscriptionOptions.plans()
            : subscriptionOptions.plans;
    }
    throw new Error("Subscriptions are not enabled in the Paystack options.");
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getPlan = async (options, planId) => {
    if (options.subscription?.enabled === true) {
        const plans = await getPlans(options.subscription);
        return plans.find((plan) => plan.name === planId) ?? null;
    }
    return null;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPlanByName(options, name) {
    if (options.subscription?.enabled === true) {
        const plans = await getPlans(options.subscription);
        return plans.find((plan) => plan.name.toLowerCase() === name.toLowerCase()) ?? null;
    }
    return null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPlanByPriceId(options, priceId) {
    if (options.subscription?.enabled === true) {
        const plans = await getPlans(options.subscription);
        return plans.find((plan) => plan.name === priceId) ?? null;
    }
    return null;
}
export async function getProducts(productOptions) {
    if (productOptions?.products) {
        return typeof productOptions.products === "function"
            ? await productOptions.products()
            : productOptions.products;
    }
    return [];
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getProductByName(options, name) {
    return await getProducts(options.products).then((products) => products?.find((product) => product.name.toLowerCase() === name.toLowerCase()) ?? null);
}
export function getNextPeriodEnd(startDate, interval) {
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
export function validateMinAmount(amount, currency) {
    const minAmounts = {
        NGN: 5000, // 50.00
        GHS: 10, // 0.10
        ZAR: 100, // 1.00
        KES: 300, // 3.00
        USD: 200, // 2.00
        XOF: 100, // 1.00
    };
    const min = minAmounts[currency.toUpperCase()];
    return min !== undefined ? amount >= min : true;
}
export async function syncProductQuantityFromPaystack(ctx, productName, paystackClient) {
    // Find the local product record (by name or slug)
    let localProduct = await ctx.context.adapter.findOne({
        model: "paystackProduct",
        where: [{ field: "name", value: productName }],
    });
    localProduct ??= await ctx.context.adapter.findOne({
        model: "paystackProduct",
        where: [{ field: "slug", value: productName.toLowerCase().replace(/\s+/g, "-") }],
    });
    if (localProduct?.paystackId === undefined || localProduct?.paystackId === null || localProduct?.paystackId === "") {
        // No local record with a Paystack ID — fall back to local decrement
        if (localProduct && localProduct.unlimited !== true && localProduct.quantity !== undefined && localProduct.quantity > 0) {
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
        const data = unwrapSdkResult(raw);
        const remoteQuantity = data?.quantity;
        if (remoteQuantity !== undefined) {
            await ctx.context.adapter.update({
                model: "paystackProduct",
                update: { quantity: remoteQuantity, updatedAt: new Date() },
                where: [{ field: "id", value: localProduct.id }],
            });
        }
    }
    catch {
        // If API call fails, fall back to local decrement
        if (localProduct.unlimited !== true && localProduct.quantity !== undefined && localProduct.quantity > 0) {
            await ctx.context.adapter.update({
                model: "paystackProduct",
                update: { quantity: localProduct.quantity - 1, updatedAt: new Date() },
                where: [{ field: "id", value: localProduct.id }],
            });
        }
    }
}
/** @deprecated Use syncProductQuantityFromPaystack instead */
export async function decrementProductQuantity(ctx, productName) {
    let product = await ctx.context.adapter.findOne({
        model: "paystackProduct",
        where: [{ field: "name", value: productName }],
    });
    product ??= await ctx.context.adapter.findOne({
        model: "paystackProduct",
        where: [{ field: "slug", value: productName.toLowerCase().replace(/\s+/g, "-") }],
    });
    if (product) {
        if (product.unlimited !== true && product.quantity !== undefined && product.quantity > 0) {
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
