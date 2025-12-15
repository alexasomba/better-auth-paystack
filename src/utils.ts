import type { PaystackOptions } from "./types";

export async function getPlans(subscriptionOptions: PaystackOptions["subscription"]) {
    if (subscriptionOptions?.enabled) {
        return typeof subscriptionOptions.plans === "function"
            ? await subscriptionOptions.plans()
            : subscriptionOptions.plans;
    }
    throw new Error("Subscriptions are not enabled in the Paystack options.");
}

export async function getPlanByName(options: PaystackOptions<any>, name: string) {
    return await getPlans(options.subscription).then((plans) =>
        plans?.find((plan) => plan.name.toLowerCase() === name.toLowerCase()),
    );
}
