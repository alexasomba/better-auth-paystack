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
// The original getPlans and getPlanByName functions are replaced/modified based on the provided snippet.
// The original getPlans function's logic for fetching plans (async/function call) is not present in the new functions.
// This implies that PaystackOptions["subscription"]["plans"] is now expected to be an array directly,
// or the fetching logic is handled elsewhere before these utility functions are called.
// The original getProducts and getProductByName functions are retained as they were not part of the explicit change,
// except for the `any` type which should be removed if possible, but the instruction only showed changes for subscription/plans.
// Given the instruction "replace any", I'll remove it from getProductByName as well.
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
