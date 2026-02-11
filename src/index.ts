import { defineErrorCodes } from "@better-auth/core/utils";
import type { AuthContext, GenericEndpointContext } from "better-auth";
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
	chargeRecurringSubscription,
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
	Member,
	User,

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
			initializeTransaction: initializeTransaction(options),
			verifyTransaction: verifyTransaction(options),
			listSubscriptions: listSubscriptions(options),
			paystackWebhook: paystackWebhook(options),
			listTransactions: listTransactions(options),
			getConfig: getConfig(options),
			disableSubscription: disablePaystackSubscription(options),
			enableSubscription: enablePaystackSubscription(options),
			getSubscriptionManageLink: getSubscriptionManageLink(options),
			createSubscription: createSubscription(options),
			upgradeSubscription: upgradeSubscription(options),
			cancelSubscription: cancelSubscription(options),
			restoreSubscription: restoreSubscription(options),
			chargeRecurringSubscription: chargeRecurringSubscription(options),
		},
		schema: getSchema(options),
		init: (ctx: AuthContext) => {
			return {
				options: {
					databaseHooks: {
						user: {
							create: {
								async after(user: { id: string; email: string; name?: string | null }, hookCtx?: GenericEndpointContext | null) {
									if (hookCtx === undefined || hookCtx === null || options.createCustomerOnSignUp !== true) return;

									const paystackOps = getPaystackOps(options.paystackClient as PaystackClientLike);
									const raw = await paystackOps.customerCreate({
										email: user.email,
										first_name: user.name ?? undefined,
										metadata: {
											userId: user.id,
										},
									});
									const data = unwrapSdkResult<Record<string, unknown>>(raw);
									const customerCode = (data?.customer_code as string | undefined) ?? (data?.data as Record<string, unknown>)?.customer_code as string | undefined;

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
									async after(org: { id: string; name: string; email?: string | null }, hookCtx: GenericEndpointContext | null) {
										try {
											const extraCreateParams = options.organization?.getCustomerCreateParams
												? await options.organization.getCustomerCreateParams(org, hookCtx!)
												: {};

											let targetEmail = org.email;
											if (targetEmail === undefined || targetEmail === null) {
												const ownerMember = await ctx.adapter.findOne<Member>({
													model: "member",
													where: [
														{ field: "organizationId", value: org.id },
														{ field: "role", value: "owner" }
													]
												});
												if (ownerMember !== null && ownerMember !== undefined) {
													const ownerUser = await ctx.adapter.findOne<User>({
														model: "user",
														where: [{ field: "id", value: ownerMember.userId }]
													});
													targetEmail = ownerUser?.email;
												}
											}

											if (targetEmail === undefined || targetEmail === null) return;

											const params = defu(
												{
													email: targetEmail,
													first_name: org.name,
													metadata: { organizationId: org.id },
												},
												extraCreateParams,
											);
											const paystackOps = getPaystackOps(options.paystackClient as PaystackClientLike);
											const raw = await paystackOps.customerCreate(params);
											const sdkRes = unwrapSdkResult<Record<string, unknown>>(raw);
											const paystackCustomer =
                                                sdkRes !== null && typeof sdkRes === "object" && "status" in sdkRes && "data" in sdkRes
                                                	? (sdkRes as { data: Record<string, unknown> }).data
                                                	: sdkRes?.data ?? sdkRes;
											const customerCode = (paystackCustomer as Record<string, unknown>)?.customer_code as string | undefined;

											if (customerCode === undefined || customerCode === null) return;

											// eslint-disable-next-line @typescript-eslint/no-explicit-any
											await (ctx.internalAdapter as any).updateOrganization(org.id, {
												paystackCustomerCode: customerCode,
											});

											await options.organization?.onCustomerCreate?.(
												{
													paystackCustomer: paystackCustomer as Record<string, unknown>,
													organization: {
														...org,
														paystackCustomerCode: customerCode,
													},
												},
                                                hookCtx!,
											);
										} catch (error: unknown) {
											(ctx as unknown as AuthContext).logger.error("Failed to create Paystack customer for organization", error);
										}
									},
								},
							}
							: undefined,
					},
					member: {
						create: {
							before: async (member: { organizationId: string }, ctx: GenericEndpointContext | null | undefined) => {
								if (options.subscription?.enabled === true && member.organizationId && ctx !== null && ctx !== undefined) {
									await checkSeatLimit(ctx, member.organizationId);
								}
							},
						},
					},
					invitation: {
						create: {
							before: async (invitation: { organizationId: string }, ctx: GenericEndpointContext | null | undefined) => {
								if (options.subscription?.enabled === true && invitation.organizationId && ctx !== null && ctx !== undefined) {
									await checkSeatLimit(ctx, invitation.organizationId);
								}
							},
						},
					},
					team: {
						create: {
							before: async (team: { organizationId: string }, ctx: GenericEndpointContext | null | undefined) => {
								if (options.subscription?.enabled === true && team.organizationId && ctx !== null && ctx !== undefined) {
									const subscription = await getOrganizationSubscription(ctx, team.organizationId);
									if (subscription !== null && subscription !== undefined) {
										const plan = await getPlanByName(options, subscription.plan);
										const limits = plan?.limits;
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

export type PaystackPlugin<O extends PaystackOptions<PaystackClientLike> = PaystackOptions> = ReturnType<
    typeof paystack<PaystackClientLike, O>
>;

export type { Subscription, SubscriptionOptions, PaystackPlan, PaystackOptions, PaystackProduct };
