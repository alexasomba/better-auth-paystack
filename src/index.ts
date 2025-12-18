import { defineErrorCodes } from "@better-auth/core/utils";
import type { BetterAuthPlugin } from "better-auth";
import type { GenericEndpointContext } from "better-auth";
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
import type {
    PaystackNodeClient,
    PaystackClientLike,
    PaystackOptions,
    PaystackPlan,
    Subscription,
    SubscriptionOptions,
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

type PaystackClientFromOptions<O extends PaystackOptions<any>> =
    O extends PaystackOptions<infer TClient> ? TClient : PaystackNodeClient;

export type PaystackPlugin<O extends PaystackOptions<any> = PaystackOptions> = ReturnType<
    typeof paystack<PaystackClientFromOptions<O>, O>
>;

export type { Subscription, SubscriptionOptions, PaystackPlan, PaystackOptions };
