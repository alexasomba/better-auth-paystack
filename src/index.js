import { defineErrorCodes } from "@better-auth/core/utils";
import { defu } from "defu";
import { disablePaystackSubscription, enablePaystackSubscription, initializeTransaction, listSubscriptions, listTransactions, paystackWebhook, verifyTransaction, getConfig, getSubscriptionManageLink, PAYSTACK_ERROR_CODES, } from "./routes";
import { getSchema } from "./schema";
import { checkSeatLimit, checkTeamLimit, getOrganizationSubscription } from "./limits";
import { getPlanByName } from "./utils";
import { getPaystackOps, unwrapSdkResult } from "./paystack-sdk";
const INTERNAL_ERROR_CODES = defineErrorCodes({
    ...PAYSTACK_ERROR_CODES,
});
export const paystack = (options) => {
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
    };
    return {
        id: "paystack",
        endpoints,
        init(_ctx) {
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
        schema: getSchema(options),
        $ERROR_CODES: INTERNAL_ERROR_CODES,
    };
};
