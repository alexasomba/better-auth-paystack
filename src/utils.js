export async function getPlans(subscriptionOptions) {
    if (subscriptionOptions?.enabled === true) {
        return typeof subscriptionOptions.plans === "function"
            ? subscriptionOptions.plans()
            : subscriptionOptions.plans;
    }
    throw new Error("Subscriptions are not enabled in the Paystack options.");
}
export const getPlan = async (options, planId) => {
    if (options.subscription?.enabled === true) {
        const plans = await getPlans(options.subscription);
        return plans.find((plan) => plan.name === planId) ?? null;
    }
    return null;
};
export async function getPlanByName(options, name) {
    if (options.subscription?.enabled === true) {
        const plans = await getPlans(options.subscription);
        return plans.find((plan) => plan.name.toLowerCase() === name.toLowerCase()) ?? null;
    }
    return null;
}
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
export async function getProductByName(options, name) {
    return await getProducts(options.products).then((products) => products?.find((product) => product.name.toLowerCase() === name.toLowerCase()));
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
