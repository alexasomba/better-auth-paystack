import { defineErrorCodes } from "@better-auth/core/utils";
import { defu } from "defu";
import { disablePaystackSubscription, enablePaystackSubscription, initializeTransaction, listSubscriptions, listTransactions, paystackWebhook, verifyTransaction, getConfig, getSubscriptionManageLink, PAYSTACK_ERROR_CODES, } from "./routes";
import { getSchema } from "./schema";
import { getPaystackOps, unwrapSdkResult } from "./paystack-sdk";
const INTERNAL_ERROR_CODES = defineErrorCodes({
    ...PAYSTACK_ERROR_CODES,
});
export const paystack = (options) => {
    const baseEndpoints = {
        paystackWebhook: paystackWebhook(options),
        listTransactions: listTransactions(options),
        getConfig: getConfig(options),
    };
    const subscriptionEnabledEndpoints = {
        ...baseEndpoints,
        initializeTransaction: initializeTransaction(options),
        verifyTransaction: verifyTransaction(options),
        listSubscriptions: listSubscriptions(options),
        disablePaystackSubscription: disablePaystackSubscription(options),
        enablePaystackSubscription: enablePaystackSubscription(options),
        getSubscriptionManageLink: getSubscriptionManageLink(options),
    };
    const endpoints = (options.subscription?.enabled
        ? subscriptionEnabledEndpoints
        : baseEndpoints);
    return {
        id: "paystack",
        endpoints,
        init(ctx) {
            return {
                options: {
                    databaseHooks: {
                        user: {
                            create: {
                                async after(user, hookCtx) {
                                    if (!hookCtx || !options.createCustomerOnSignUp)
                                        return;
                                    try {
                                        const firstName = user.name?.split(" ")[0];
                                        const lastName = user.name?.split(" ").slice(1).join(" ") || undefined;
                                        const extraCreateParams = options.getCustomerCreateParams
                                            ? await options.getCustomerCreateParams(user, hookCtx)
                                            : {};
                                        const params = defu({
                                            email: user.email,
                                            first_name: firstName,
                                            last_name: lastName,
                                            metadata: { userId: user.id },
                                        }, extraCreateParams);
                                        const paystack = getPaystackOps(options.paystackClient);
                                        const raw = await paystack.customerCreate(params);
                                        const res = unwrapSdkResult(raw);
                                        const paystackCustomer = res && typeof res === "object" && "status" in res && "data" in res
                                            ? res.data
                                            : res?.data ?? res;
                                        const customerCode = paystackCustomer?.customer_code;
                                        if (!customerCode)
                                            return;
                                        await hookCtx.context.internalAdapter.updateUser(user.id, {
                                            paystackCustomerCode: customerCode,
                                        });
                                        await options.onCustomerCreate?.({
                                            paystackCustomer,
                                            user: {
                                                ...user,
                                                paystackCustomerCode: customerCode,
                                            },
                                        }, hookCtx);
                                    }
                                    catch (e) {
                                        hookCtx.context.logger.error(`Failed to create Paystack customer: ${e?.message || "Unknown error"}`, e);
                                    }
                                },
                            },
                        },
                    },
                },
            };
        },
        schema: getSchema(options),
        $ERROR_CODES: INTERNAL_ERROR_CODES,
    };
};
