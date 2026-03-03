import { defineErrorCodes } from "@better-auth/core/utils/error-codes";
import { defu } from "defu";
import { disablePaystackSubscription, enablePaystackSubscription, initializeTransaction, listSubscriptions, listTransactions, paystackWebhook, verifyTransaction, getConfig, getSubscriptionManageLink, PAYSTACK_ERROR_CODES, createSubscription, upgradeSubscription, cancelSubscription, restoreSubscription, chargeRecurringSubscription, syncProducts, listProducts, syncPlans, listPlans, } from "./routes";
import { getSchema } from "./schema";
import { checkSeatLimit, checkTeamLimit, getOrganizationSubscription } from "./limits";
import { getPlanByName, syncSubscriptionSeats } from "./utils";
import { getPaystackOps, unwrapSdkResult } from "./paystack-sdk";
const INTERNAL_ERROR_CODES = defineErrorCodes({
    ...Object.fromEntries(Object.entries(PAYSTACK_ERROR_CODES).map(([key, value]) => [
        key,
        typeof value === "string" ? value : value.message,
    ])),
});
export const paystack = (options) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const routeOptions = options;
    const res = {
        id: "paystack",
        endpoints: {
            initializeTransaction: initializeTransaction(routeOptions),
            verifyTransaction: verifyTransaction(routeOptions),
            listSubscriptions: listSubscriptions(routeOptions),
            paystackWebhook: paystackWebhook(routeOptions),
            listTransactions: listTransactions(routeOptions),
            getConfig: getConfig(routeOptions),
            disableSubscription: disablePaystackSubscription(routeOptions),
            enableSubscription: enablePaystackSubscription(routeOptions),
            getSubscriptionManageLink: getSubscriptionManageLink(routeOptions),
            subscriptionManageLink: getSubscriptionManageLink(routeOptions, "/paystack/subscription/manage-link"), // Historical alias
            createSubscription: createSubscription(routeOptions),
            upgradeSubscription: upgradeSubscription(routeOptions),
            cancelSubscription: cancelSubscription(routeOptions),
            restoreSubscription: restoreSubscription(routeOptions),
            chargeRecurringSubscription: chargeRecurringSubscription(routeOptions),
            syncProducts: syncProducts(routeOptions),
            listProducts: listProducts(routeOptions),
            syncPlans: syncPlans(routeOptions),
            listPlans: listPlans(routeOptions),
        },
        schema: getSchema(options),
        init: (ctx) => {
            return {
                options: {
                    databaseHooks: {
                        user: {
                            create: {
                                async after(user, hookCtx) {
                                    if (hookCtx === undefined || hookCtx === null || options.createCustomerOnSignUp !== true || !user.email)
                                        return;
                                    const paystackOps = getPaystackOps(options.paystackClient);
                                    const raw = await paystackOps.customerCreate({
                                        email: user.email,
                                        first_name: user.name ?? undefined,
                                        metadata: {
                                            userId: user.id,
                                        },
                                    });
                                    const sdkRes = unwrapSdkResult(raw);
                                    const customerCode = sdkRes?.customer_code
                                        ?? sdkRes?.data?.customer_code;
                                    if (customerCode === undefined || customerCode === null) {
                                        return;
                                    }
                                    await ctx.adapter.update({
                                        model: "user",
                                        where: [{ field: "id", value: user.id }],
                                        update: {
                                            paystackCustomerCode: customerCode,
                                        },
                                    });
                                },
                            },
                        },
                        organization: options.organization?.enabled === true
                            ? {
                                create: {
                                    async after(org, hookCtx) {
                                        try {
                                            const extraCreateParams = options.organization?.getCustomerCreateParams
                                                ? await options.organization.getCustomerCreateParams(org, hookCtx)
                                                : {};
                                            let targetEmail = org.email;
                                            if (targetEmail === undefined || targetEmail === null) {
                                                const ownerMember = await ctx.adapter.findOne({
                                                    model: "member",
                                                    where: [
                                                        { field: "organizationId", value: org.id },
                                                        { field: "role", value: "owner" }
                                                    ]
                                                });
                                                if (ownerMember !== null && ownerMember !== undefined) {
                                                    const ownerUser = await ctx.adapter.findOne({
                                                        model: "user",
                                                        where: [{ field: "id", value: ownerMember.userId }]
                                                    });
                                                    targetEmail = ownerUser?.email;
                                                }
                                            }
                                            if (targetEmail === undefined || targetEmail === null)
                                                return;
                                            const params = defu({
                                                email: targetEmail,
                                                first_name: org.name,
                                                metadata: { organizationId: org.id },
                                            }, extraCreateParams);
                                            const paystackOps = getPaystackOps(options.paystackClient);
                                            const raw = await paystackOps.customerCreate(params);
                                            const sdkRes = unwrapSdkResult(raw);
                                            const customerCode = sdkRes?.customer_code
                                                ?? sdkRes?.data?.customer_code;
                                            if (customerCode === undefined || customerCode === null)
                                                return;
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            await ctx.internalAdapter.updateOrganization(org.id, {
                                                paystackCustomerCode: customerCode,
                                            });
                                            await options.organization?.onCustomerCreate?.({
                                                paystackCustomer: sdkRes,
                                                organization: {
                                                    ...org,
                                                    paystackCustomerCode: customerCode,
                                                },
                                            }, hookCtx);
                                        }
                                        catch (error) {
                                            ctx.logger.error("Failed to create Paystack customer for organization", error);
                                        }
                                    },
                                },
                            }
                            : undefined,
                    },
                    member: {
                        create: {
                            before: async (member, ctx) => {
                                if (options.subscription?.enabled === true && member.organizationId && ctx !== null && ctx !== undefined) {
                                    await checkSeatLimit(ctx, member.organizationId);
                                }
                            },
                            after: async (member, ctx) => {
                                if (options.subscription?.enabled === true && (member?.organizationId !== undefined && member?.organizationId !== null) && (ctx !== undefined && ctx !== null)) {
                                    await syncSubscriptionSeats(ctx, member.organizationId, options);
                                }
                            },
                        },
                        delete: {
                            after: async (member, ctx) => {
                                if (options.subscription?.enabled === true && (member?.organizationId !== undefined && member?.organizationId !== null) && (ctx !== undefined && ctx !== null)) {
                                    await syncSubscriptionSeats(ctx, member.organizationId, options);
                                }
                            },
                        }
                    },
                    invitation: {
                        create: {
                            before: async (invitation, ctx) => {
                                if (options.subscription?.enabled === true && invitation.organizationId && ctx !== null && ctx !== undefined) {
                                    await checkSeatLimit(ctx, invitation.organizationId);
                                }
                            },
                            after: async (invitation, ctx) => {
                                if (options.subscription?.enabled === true && (invitation?.organizationId !== undefined && invitation?.organizationId !== null) && (ctx !== undefined && ctx !== null)) {
                                    await syncSubscriptionSeats(ctx, invitation.organizationId, options);
                                }
                            },
                        },
                        delete: {
                            after: async (invitation, ctx) => {
                                if (options.subscription?.enabled === true && (invitation?.organizationId !== undefined && invitation?.organizationId !== null) && (ctx !== undefined && ctx !== null)) {
                                    await syncSubscriptionSeats(ctx, invitation.organizationId, options);
                                }
                            },
                        }
                    },
                    team: {
                        create: {
                            before: async (team, ctx) => {
                                if (options.subscription?.enabled === true && team.organizationId && ctx !== null && ctx !== undefined) {
                                    const subscription = await getOrganizationSubscription(ctx, team.organizationId);
                                    if (subscription !== null && subscription !== undefined) {
                                        const plan = await getPlanByName(options, subscription.plan);
                                        const limits = plan?.limits;
                                        const maxTeams = limits?.teams;
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
    };
    return res;
};
