import { defineErrorCodes } from "@better-auth/core/utils";
import { defu } from "defu";
import { disablePaystackSubscription, enablePaystackSubscription, initializeTransaction, listSubscriptions, listTransactions, paystackWebhook, verifyTransaction, getConfig, getSubscriptionManageLink, PAYSTACK_ERROR_CODES, createSubscription, upgradeSubscription, cancelSubscription, restoreSubscription, } from "./routes";
import { getSchema } from "./schema";
import { checkSeatLimit, checkTeamLimit, getOrganizationSubscription } from "./limits";
import { getPlanByName } from "./utils";
import { getPaystackOps, unwrapSdkResult } from "./paystack-sdk";
const INTERNAL_ERROR_CODES = defineErrorCodes({
    ...PAYSTACK_ERROR_CODES,
});
export const paystack = (options) => {
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
        init: async (ctx) => {
            return {
                options: {
                    databaseHooks: {
                        user: {
                            create: {
                                async after(user, hookCtx) {
                                    if (!hookCtx || !options.createCustomerOnSignUp)
                                        return;
                                    const paystackOps = getPaystackOps(options.paystackClient);
                                    const raw = await paystackOps.customerCreate({
                                        email: user.email,
                                        first_name: user.name || undefined,
                                        metadata: {
                                            userId: user.id,
                                        },
                                    });
                                    const data = unwrapSdkResult(raw);
                                    const customerCode = data?.customer_code || data?.data?.customer_code;
                                    if (!customerCode) {
                                        return;
                                    }
                                    await hookCtx.context.adapter.update({
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
                                    async after(org, hookCtx) {
                                        try {
                                            const extraCreateParams = options.organization?.getCustomerCreateParams
                                                ? await options.organization.getCustomerCreateParams(org, hookCtx)
                                                : {};
                                            let targetEmail = org.email;
                                            if (!targetEmail) {
                                                const ownerMember = await hookCtx.context.adapter.findOne({
                                                    model: "member",
                                                    where: [
                                                        { field: "organizationId", value: org.id },
                                                        { field: "role", value: "owner" }
                                                    ]
                                                });
                                                if (ownerMember) {
                                                    const ownerUser = await hookCtx.context.adapter.findOne({
                                                        model: "user",
                                                        where: [{ field: "id", value: ownerMember.userId }]
                                                    });
                                                    targetEmail = ownerUser?.email;
                                                }
                                            }
                                            if (!targetEmail)
                                                return;
                                            const params = defu({
                                                email: targetEmail,
                                                first_name: org.name,
                                                metadata: { organizationId: org.id },
                                            }, extraCreateParams);
                                            const paystack = getPaystackOps(options.paystackClient);
                                            const raw = await paystack.customerCreate(params);
                                            const sdkRes = unwrapSdkResult(raw);
                                            const paystackCustomer = sdkRes && typeof sdkRes === "object" && "status" in sdkRes && "data" in sdkRes
                                                ? sdkRes.data
                                                : sdkRes?.data ?? sdkRes;
                                            const customerCode = paystackCustomer?.customer_code;
                                            if (!customerCode)
                                                return;
                                            await hookCtx.context.internalAdapter.updateOrganization(org.id, {
                                                paystackCustomerCode: customerCode,
                                            });
                                            await options.organization?.onCustomerCreate?.({
                                                paystackCustomer,
                                                organization: {
                                                    ...org,
                                                    paystackCustomerCode: customerCode,
                                                },
                                            }, hookCtx);
                                        }
                                        catch (error) {
                                            ctx.context.logger.error("Failed to create Paystack customer for organization", error);
                                        }
                                    },
                                },
                            }
                            : undefined,
                    },
                    member: {
                        create: {
                            before: async (member, ctx) => {
                                if (options.subscription?.enabled && member.organizationId && ctx) {
                                    await checkSeatLimit(ctx, member.organizationId);
                                }
                            },
                        },
                    },
                    invitation: {
                        create: {
                            before: async (invitation, ctx) => {
                                if (options.subscription?.enabled && invitation.organizationId && ctx) {
                                    await checkSeatLimit(ctx, invitation.organizationId);
                                }
                            },
                        },
                    },
                    team: {
                        create: {
                            before: async (team, ctx) => {
                                if (options.subscription?.enabled && team.organizationId && ctx) {
                                    const subscription = await getOrganizationSubscription(ctx, team.organizationId);
                                    if (subscription) {
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
