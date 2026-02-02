import { defineErrorCodes } from "@better-auth/core/utils";
import type { BetterAuthPlugin } from "better-auth";
import type { GenericEndpointContext } from "better-auth";
import { defu } from "defu";
import {
    disablePaystackSubscription,
    enablePaystackSubscription,
    initializeTransaction,
    listSubscriptions,
    listTransactions,
    paystackWebhook,
    verifyTransaction,
    getConfig,
    getSubscriptionManageLink,
    PAYSTACK_ERROR_CODES,
} from "./routes";
import { getSchema } from "./schema";
import type {
    PaystackNodeClient,
    PaystackClientLike,
    PaystackOptions,
    PaystackPlan,
    Subscription,
    SubscriptionOptions,
    PaystackProduct,
} from "./types";
import { getPaystackOps, unwrapSdkResult } from "./paystack-sdk";

const INTERNAL_ERROR_CODES = defineErrorCodes({
    ...PAYSTACK_ERROR_CODES,
});

export const paystack = <
    TPaystackClient extends PaystackClientLike = PaystackNodeClient,
    O extends PaystackOptions<TPaystackClient> = PaystackOptions<TPaystackClient>,
>(
    options: O,
) => {
    type GenericEndpoints = NonNullable<BetterAuthPlugin["endpoints"]>;
    const endpoints = {
        paystackWebhook: paystackWebhook(options),
        listTransactions: listTransactions(options),
        getConfig: getConfig(options),
        initializeTransaction: initializeTransaction(options),
        verifyTransaction: verifyTransaction(options),
        listLocalSubscriptions: listSubscriptions(options),
        disablePaystackSubscription: disablePaystackSubscription(options),
        enablePaystackSubscription: enablePaystackSubscription(options),
        getSubscriptionManageLink: getSubscriptionManageLink(options),
    } satisfies GenericEndpoints;

    type EndpointsForOptions = typeof endpoints;

    return {
        id: "paystack",
        endpoints,
        init(ctx) {
            return {
                options: {
                    databaseHooks: {
                        user: {
                            create: {
                                async after(user, hookCtx?: GenericEndpointContext | null) {
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
                                        const paystack = getPaystackOps(options.paystackClient);
                                        const raw = await paystack.customerCreate(params);
                                        const res = unwrapSdkResult<any>(raw);
                                        const paystackCustomer =
                                            res && typeof res === "object" && "status" in res && "data" in res
                                                ? (res as any).data
                                                : res?.data ?? res;
                                        const customerCode = paystackCustomer?.customer_code;

                                        if (!customerCode) return;

                                        await (hookCtx as any).context.internalAdapter.updateUser(user.id, {
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
                                        (hookCtx as any).context.logger.error(
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

export type PaystackPlugin<O extends PaystackOptions<any> = PaystackOptions> = ReturnType<
    typeof paystack<any, O>
>;

export type { Subscription, SubscriptionOptions, PaystackPlan, PaystackOptions, PaystackProduct };
