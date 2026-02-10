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
