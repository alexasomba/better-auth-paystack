import { defineErrorCodes } from "@better-auth/core/utils";
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
    createSubscription,
    upgradeSubscription,
    cancelSubscription,
    restoreSubscription,
} from "./routes";
import { getSchema } from "./schema";
import { checkSeatLimit, checkTeamLimit, getOrganizationSubscription } from "./limits";
import { getPlanByName } from "./utils";
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
    const res = {
        id: "paystack",
        endpoints: {
            "initialize-transaction": initializeTransaction(options),
            "verify-transaction": verifyTransaction(options),
            "list-subscriptions": listSubscriptions(options),
            "paystack-webhook": paystackWebhook(options),
            "list-transactions": listTransactions(options),
            "get-config": getConfig(options),
            "disable-subscription": disablePaystackSubscription(options),
            "enable-subscription": enablePaystackSubscription(options),
            "get-subscription-manage-link": getSubscriptionManageLink(options),
            "create-subscription": createSubscription(options),
            "upgrade-subscription": upgradeSubscription(options),
            "cancel-subscription": cancelSubscription(options),
            "restore-subscription": restoreSubscription(options),
        },
        schema: getSchema(options),
        init: async (ctx: any) => {
            return {
                options: {
                    databaseHooks: {
                        user: {
                            create: {
                                async after(user: any, hookCtx?: GenericEndpointContext | null) {
                                    if (!hookCtx || !options.createCustomerOnSignUp) return;

                                    const paystackOps = getPaystackOps(options.paystackClient as any);
                                    const raw = await paystackOps.customerCreate({
                                        email: user.email,
                                        first_name: user.name || undefined,
                                        metadata: {
                                            userId: user.id,
                                        },
                                    });
                                    const data = unwrapSdkResult<any>(raw);
                                    const customerCode = data?.customer_code || data?.data?.customer_code;

                                    if (!customerCode) {
                                        return;
                                    }
                                    await (hookCtx as any).context.adapter.update({
                                        model: "user",
                                        where: [{ field: "id", value: user.id }],
                                        update: {
                                            paystackCustomerCode: customerCode,
                                        },
                                    });
                                },
                            },
                        },
                        organization: options.organization?.enabled
                            ? {
                                create: {
                                    async after(org: any, hookCtx: GenericEndpointContext | null) {
                                        try {
                                            const extraCreateParams = options.organization?.getCustomerCreateParams
                                                ? await options.organization.getCustomerCreateParams(org, hookCtx as any)
                                                : {};

                                            let targetEmail = org.email;
                                            if (!targetEmail) {
                                                const ownerMember = await (hookCtx as any).context.adapter.findOne({
                                                    model: "member",
                                                    where: [
                                                        { field: "organizationId", value: org.id },
                                                        { field: "role", value: "owner" }
                                                    ]
                                                });
                                                if (ownerMember) {
                                                    const ownerUser = await (hookCtx as any).context.adapter.findOne({
                                                        model: "user",
                                                        where: [{ field: "id", value: ownerMember.userId }]
                                                    });
                                                    targetEmail = ownerUser?.email;
                                                }
                                            }

                                            if (!targetEmail) return;

                                            const params = defu(
                                                {
                                                    email: targetEmail,
                                                    first_name: org.name,
                                                    metadata: { organizationId: org.id },
                                                },
                                                extraCreateParams,
                                            );
                                            const paystack = getPaystackOps(options.paystackClient as any);
                                            const raw = await paystack.customerCreate(params as any);
                                            const sdkRes = unwrapSdkResult<any>(raw);
                                            const paystackCustomer =
                                                sdkRes && typeof sdkRes === "object" && "status" in sdkRes && "data" in sdkRes
                                                    ? (sdkRes as any).data
                                                    : sdkRes?.data ?? sdkRes;
                                            const customerCode = paystackCustomer?.customer_code;

                                            if (!customerCode) return;

                                            await (hookCtx as any).context.internalAdapter.updateOrganization(org.id, {
                                                paystackCustomerCode: customerCode,
                                            });

                                            await options.organization?.onCustomerCreate?.(
                                                {
                                                    paystackCustomer,
                                                    organization: {
                                                        ...(org as any),
                                                        paystackCustomerCode: customerCode,
                                                    },
                                                },
                                                hookCtx as any,
                                            );
                                        } catch (error: any) {
                                            ctx.context.logger.error("Failed to create Paystack customer for organization", error);
                                        }
                                    },
                                },
                            }
                            : undefined,
                    },
                    member: {
                        create: {
                            before: async (member: any, ctx: GenericEndpointContext | null | undefined) => {
                                if (options.subscription?.enabled && member.organizationId && ctx) {
                                    await checkSeatLimit(ctx, member.organizationId);
                                }
                            },
                        },
                    },
                    invitation: {
                        create: {
                            before: async (invitation: any, ctx: GenericEndpointContext | null | undefined) => {
                                if (options.subscription?.enabled && invitation.organizationId && ctx) {
                                    await checkSeatLimit(ctx, invitation.organizationId);
                                }
                            },
                        },
                    },
                    team: {
                        create: {
                            before: async (team: any, ctx: GenericEndpointContext | null | undefined) => {
                                if (options.subscription?.enabled && team.organizationId && ctx) {
                                    const subscription = await getOrganizationSubscription(ctx, team.organizationId);
                                    if (subscription) {
                                        const plan = await getPlanByName(options, subscription.plan);
                                        const limits = plan?.limits as Record<string, unknown> | undefined;
                                        const maxTeams = limits?.teams as number | undefined;

                                        if (typeof maxTeams === "number") {
                                            await checkTeamLimit(ctx, team.organizationId, maxTeams);
                                        }
                                    }
                                }
                            },
                        },
                    },
                },
            };
        },
        $ERROR_CODES: INTERNAL_ERROR_CODES,
    } as const;



    return res;
};

export type PaystackPlugin<O extends PaystackOptions<any> = PaystackOptions> = ReturnType<
    typeof paystack<any, O>
>;

export type { Subscription, SubscriptionOptions, PaystackPlan, PaystackOptions, PaystackProduct };
