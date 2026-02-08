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


    return {
        id: "paystack",
        endpoints,
        init(_ctx) {
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
                        organization: options.organization?.enabled
                            ? {
                                create: {
                                    async after(org: any, hookCtx?: GenericEndpointContext | null) {
                                        if (!hookCtx) return;

                                        try {
                                            const extraCreateParams = options.organization?.getCustomerCreateParams
                                                ? await options.organization.getCustomerCreateParams(org, hookCtx as any)
                                                : {};

                                            const params = defu(
                                                {
                                                    email: org.email || `billing+${org.id}@example.com`,
                                                    first_name: org.name,
                                                    metadata: { organizationId: org.id },
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

                                            await (hookCtx as any).context.internalAdapter.updateOrganization(org.id, {
                                                paystackCustomerCode: customerCode,
                                            });

                                            await options.organization?.onCustomerCreate?.(
                                                {
                                                    paystackCustomer,
                                                    organization: {
                                                        ...org,
                                                        paystackCustomerCode: customerCode,
                                                    },
                                                },
                                                hookCtx as any,
                                            );
                                        } catch (e: any) {
                                            (hookCtx as any).context.logger.error(
                                                `Failed to create Paystack customer for organization: ${e?.message || "Unknown error"}`,
                                                e,
                                            );
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
                                    // Optionally check if organization is already full before sending invitation
                                    // Logic: if members >= seats, can't invite more (assuming invited person will join)
                                    // We pass 0 to checkSeatLimit to just check current usage vs limit (strict check would be >=)
                                    // But checkSeatLimit(ctx, orgId, 1) checks if adding 1 exceeds.
                                    // If we are just inviting, we trigger this check to see if we have space for 1 more.
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
        schema: getSchema(options),
        $ERROR_CODES: INTERNAL_ERROR_CODES,
    } satisfies BetterAuthPlugin;
};

export type PaystackPlugin<O extends PaystackOptions<any> = PaystackOptions> = ReturnType<
    typeof paystack<any, O>
>;

export type { Subscription, SubscriptionOptions, PaystackPlan, PaystackOptions, PaystackProduct };
