export async function getPlans(subscriptionOptions) {
    if (subscriptionOptions?.enabled) {
        return typeof subscriptionOptions.plans === "function"
            ? await subscriptionOptions.plans()
            : subscriptionOptions.plans;
    }
    throw new Error("Subscriptions are not enabled in the Paystack options.");
}
export async function getPlanByName(options, name) {
    return await getPlans(options.subscription).then((plans) => plans?.find((plan) => plan.name.toLowerCase() === name.toLowerCase()));
}
