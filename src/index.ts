import { defineErrorCodes } from "@better-auth/core/utils";
import type { BetterAuthPlugin } from "better-auth";
import { defu } from "defu";
import {
    disablePaystackSubscription,
    enablePaystackSubscription,
    initializeTransaction,
    listSubscriptions,
    paystackWebhook,
    verifyTransaction,
    PAYSTACK_ERROR_CODES,
} from "./routes";
import { getSchema } from "./schema";
import type { PaystackOptions, PaystackPlan, Subscription, SubscriptionOptions } from "./types";

const INTERNAL_ERROR_CODES = defineErrorCodes({
    ...PAYSTACK_ERROR_CODES,
});

export const paystack = <O extends PaystackOptions>(options: O) => {
    const baseEndpoints = {
        paystackWebhook: paystackWebhook(options),
    } satisfies NonNullable<BetterAuthPlugin["endpoints"]>;

    const subscriptionEnabledEndpoints = {
        ...baseEndpoints,
        initializeTransaction: initializeTransaction(options),
        verifyTransaction: verifyTransaction(options),
        listSubscriptions: listSubscriptions(options),
        disablePaystackSubscription: disablePaystackSubscription(options),
        enablePaystackSubscription: enablePaystackSubscription(options),
    } satisfies NonNullable<BetterAuthPlugin["endpoints"]>;

    const endpoints = options.subscription?.enabled
        ? subscriptionEnabledEndpoints
        : baseEndpoints;

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
                                    if (!hookCtx || !options.createCustomerOnSignUp) return;

                                    try {
                                        const firstName = user.name?.split(" ")[0];
                                        const lastName = user.name?.split(" ").slice(1).join(" ") || undefined;

                                        const extraCreateParams = options.getCustomerCreateParams
                                            ? await options.getCustomerCreateParams(user as any, hookCtx as any)
                                            : {};

                                        const params = defu(
                                            {
                                                email: user.email,
                                                first_name: firstName,
                                                last_name: lastName,
                                                metadata: { userId: user.id },
                                            },
                                            extraCreateParams,
                                        );

                                        const res = await options.paystackClient?.customer?.create?.(params);
                                        const paystackCustomer = res?.data ?? res;
                                        const customerCode =
                                            paystackCustomer?.customer_code ??
                                            paystackCustomer?.data?.customer_code;

                                        if (!customerCode) return;

                                        await hookCtx.context.internalAdapter.updateUser(user.id, {
                                            paystackCustomerCode: customerCode,
                                        });

                                        await options.onCustomerCreate?.(
                                            {
                                                paystackCustomer,
                                                user: {
                                                    ...(user as any),
                                                    paystackCustomerCode: customerCode,
                                                },
                                            },
                                            hookCtx as any,
                                        );
                                    } catch (e: any) {
                                        hookCtx.context.logger.error(
                                            `Failed to create Paystack customer: ${e?.message || "Unknown error"}`,
                                            e,
                                        );
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
    } satisfies BetterAuthPlugin;
};

export type PaystackPlugin<O extends PaystackOptions> = ReturnType<typeof paystack<O>>;

export type { Subscription, SubscriptionOptions, PaystackPlan, PaystackOptions };
