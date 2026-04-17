import { defineErrorCodes } from "@better-auth/core/utils/error-codes";
import type { AuthContext, BetterAuthPlugin, GenericEndpointContext } from "better-auth";
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
  syncProducts,
  listProducts,
  syncPlans,
  listPlans,
} from "./routes";
import { getSchema } from "./schema";
import { checkSeatLimit, checkTeamLimit, getOrganizationSubscription } from "./limits";
import { getPlanByName, syncSubscriptionSeats } from "./utils";
import type {
  PaystackClientLike,
  PaystackOptions,
  PaystackPlan,
  Subscription,
  SubscriptionOptions,
  PaystackProduct,
  PaystackCustomerResponse,
  Member,
  AnyPaystackOptions,
  User,
} from "./types";
import { getPaystackOps, unwrapSdkResult } from "./paystack-sdk";

const INTERNAL_ERROR_CODES = defineErrorCodes(
  Object.fromEntries(
    Object.entries(PAYSTACK_ERROR_CODES).map(([key, value]) => [
      key,
      typeof value === "string" ? value : (value as { message: string }).message,
    ]),
  ),
);

/**
 * Paystack plugin for Better Auth.
 */
export const paystack = <
  TPaystackClient extends PaystackClientLike = PaystackClientLike,
  O extends PaystackOptions<TPaystackClient> = PaystackOptions<TPaystackClient>,
>(
  options: O,
) => {
  const routeOptions = options as unknown as AnyPaystackOptions;
  return {
    id: "paystack",
    endpoints: {
      initializeTransaction: initializeTransaction(routeOptions),
      verifyTransaction: verifyTransaction(routeOptions),
      listSubscriptions: listSubscriptions(routeOptions),
      webhook: paystackWebhook(routeOptions),
      listTransactions: listTransactions(routeOptions),
      getConfig: getConfig(routeOptions),
      disableSubscription: disablePaystackSubscription(routeOptions),
      enableSubscription: enablePaystackSubscription(routeOptions),
      getSubscriptionManageLink: getSubscriptionManageLink(routeOptions),
      subscriptionManageLink: getSubscriptionManageLink(routeOptions, "/subscription/manage-link"), // Historical alias
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
    init: (ctx: AuthContext) => {
      return {
        options: {
          databaseHooks: {
            user: {
              create: {
                async after(
                  user: { id: string; email?: string | null; name?: string | null },
                  hookCtx?: GenericEndpointContext | null,
                ) {
                  if (
                    !hookCtx ||
                    options.createCustomerOnSignUp !== true ||
                    user.email === null ||
                    user.email === undefined ||
                    user.email === ""
                  )
                    return;

                  try {
                    const paystackOps = getPaystackOps(
                      options.paystackClient as PaystackClientLike,
                    );
                    if (!paystackOps) return;
                    const raw =
                      (await paystackOps.customer?.create({
                        body: {
                          email: user.email,
                          first_name: user.name ?? undefined,
                          metadata: {
                            userId: user.id,
                          },
                        },
                      })) ??
                      (await Promise.reject(new Error("Paystack client missing customer ops")));
                    const sdkRes = unwrapSdkResult<PaystackCustomerResponse>(raw);
                    const customerCode = sdkRes?.customer_code;

                    if (
                      customerCode !== undefined &&
                      customerCode !== null &&
                      customerCode !== ""
                    ) {
                      await ctx.adapter.update({
                        model: "user",
                        where: [{ field: "id", value: user.id }],
                        update: {
                          paystackCustomerCode: customerCode,
                        },
                      });

                      if (typeof options.onCustomerCreate === "function") {
                        await options.onCustomerCreate(
                          {
                            paystackCustomer: sdkRes,
                            user: {
                              ...(user as User),
                              paystackCustomerCode: customerCode,
                            },
                          },
                          hookCtx,
                        );
                      }
                    }
                  } catch (error: unknown) {
                    ctx.logger.error("Failed to create Paystack customer for user", error);
                  }
                },
              },
            },
            organization:
              options.organization?.enabled === true
                ? {
                    create: {
                      async after(
                        org: { id: string; name: string; email?: string | null },
                        hookCtx: GenericEndpointContext | null,
                      ) {
                        try {
                          const extraCreateParams =
                            typeof options.organization?.getCustomerCreateParams === "function"
                              ? await (
                                  options.organization.getCustomerCreateParams as (
                                    org: Record<string, unknown>,
                                    hookCtx: GenericEndpointContext,
                                  ) => Promise<Record<string, unknown>>
                                )(org as Record<string, unknown>, hookCtx!)
                              : {};

                          let targetEmail = org.email;
                          if (targetEmail === undefined || targetEmail === null) {
                            const ownerMember = await ctx.adapter.findOne<Member>({
                              model: "member",
                              where: [
                                { field: "organizationId", value: org.id },
                                { field: "role", value: "owner" },
                              ],
                            });
                            if (ownerMember !== null && ownerMember !== undefined) {
                              const ownerUser = await ctx.adapter.findOne<User>({
                                model: "user",
                                where: [{ field: "id", value: ownerMember.userId }],
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
                          const paystackOps = getPaystackOps(
                            options.paystackClient as PaystackClientLike,
                          );
                          if (!paystackOps) return;
                          const raw =
                            (await paystackOps.customer?.create({
                              body: params as Record<string, unknown>,
                            })) ??
                            (await Promise.reject(
                              new Error("Paystack client missing customer ops"),
                            ));
                          const sdkRes = unwrapSdkResult<PaystackCustomerResponse>(raw);
                          const customerCode = sdkRes?.customer_code as string | undefined;

                          if (
                            customerCode !== undefined &&
                            customerCode !== null &&
                            customerCode !== "" &&
                            sdkRes !== undefined &&
                            sdkRes !== null
                          ) {
                            await (
                              ctx.internalAdapter as unknown as {
                                updateOrganization: (
                                  id: string,
                                  data: Record<string, unknown>,
                                ) => Promise<void>;
                              }
                            ).updateOrganization(org.id, {
                              paystackCustomerCode: customerCode,
                            });

                            if (typeof options.organization?.onCustomerCreate === "function") {
                              await options.organization.onCustomerCreate(
                                {
                                  paystackCustomer: sdkRes,
                                  organization: {
                                    ...org,
                                    paystackCustomerCode: customerCode,
                                  },
                                },
                                hookCtx!,
                              );
                            }
                          }
                        } catch (error: unknown) {
                          ctx.logger.error(
                            "Failed to create Paystack customer for organization",
                            error,
                          );
                        }
                      },
                    },
                  }
                : undefined,
          },
          member: {
            create: {
              before: async (
                member: { organizationId: string },
                ctx: GenericEndpointContext | null | undefined,
              ) => {
                if (
                  options.subscription?.enabled === true &&
                  member.organizationId &&
                  ctx !== null &&
                  ctx !== undefined
                ) {
                  await checkSeatLimit(ctx, member.organizationId);
                }
              },
              after: async (
                member: { organizationId: string | undefined },
                ctx: GenericEndpointContext | null | undefined,
              ) => {
                if (
                  options.subscription?.enabled === true &&
                  typeof member?.organizationId === "string" &&
                  ctx
                ) {
                  await syncSubscriptionSeats(ctx, member.organizationId, routeOptions);
                }
              },
            },
            delete: {
              after: async (
                member: { organizationId: string | undefined },
                ctx: GenericEndpointContext | null | undefined,
              ) => {
                if (
                  options.subscription?.enabled === true &&
                  typeof member?.organizationId === "string" &&
                  ctx
                ) {
                  await syncSubscriptionSeats(ctx, member.organizationId, routeOptions);
                }
              },
            },
          },
          invitation: {
            create: {
              before: async (
                invitation: { organizationId: string },
                ctx: GenericEndpointContext | null | undefined,
              ) => {
                if (
                  options.subscription?.enabled === true &&
                  invitation.organizationId &&
                  ctx !== null &&
                  ctx !== undefined
                ) {
                  await checkSeatLimit(ctx, invitation.organizationId);
                }
              },
              after: async (
                invitation: { organizationId: string | undefined },
                ctx: GenericEndpointContext | null | undefined,
              ) => {
                if (
                  options.subscription?.enabled === true &&
                  typeof invitation?.organizationId === "string" &&
                  ctx
                ) {
                  await syncSubscriptionSeats(ctx, invitation.organizationId, routeOptions);
                }
              },
            },
            delete: {
              after: async (
                invitation: { organizationId: string | undefined },
                ctx: GenericEndpointContext | null | undefined,
              ) => {
                if (
                  options.subscription?.enabled === true &&
                  typeof invitation?.organizationId === "string" &&
                  ctx
                ) {
                  await syncSubscriptionSeats(ctx, invitation.organizationId, routeOptions);
                }
              },
            },
          },
          team: {
            create: {
              before: async (
                team: { organizationId: string },
                ctx: GenericEndpointContext | null | undefined,
              ) => {
                if (options.subscription?.enabled === true && team.organizationId && ctx) {
                  const subscription = await getOrganizationSubscription(ctx, team.organizationId);
                  if (subscription !== null && subscription !== undefined) {
                    const plan = await getPlanByName(routeOptions, subscription.plan);
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
  } satisfies BetterAuthPlugin;
};

export type PaystackPlugin<
  TPaystackClient extends PaystackClientLike = PaystackClientLike,
  O extends PaystackOptions<TPaystackClient> = PaystackOptions<TPaystackClient>,
> = ReturnType<typeof paystack<TPaystackClient, O>>;

export type { Subscription, SubscriptionOptions, PaystackPlan, PaystackOptions, PaystackProduct };
