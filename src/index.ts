import { defineErrorCodes } from "@better-auth/core/utils/error-codes";
import type {
  AuthContext,
  BetterAuthPlugin,
  BetterAuthPluginDBSchema,
  GenericEndpointContext,
  MiddlewareInputContext,
  MiddlewareOptions,
  RawError,
  StrictEndpoint,
  ZodBoolean,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodRecord,
  ZodString,
  ZodUnknown,
} from "better-auth";
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
  listProducts,
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
  PaystackTransaction,
} from "./types";
import { getPaystackOps, unwrapSdkResult } from "./paystack-sdk";
import type { $strip } from "zod/v4/core";

declare module "@better-auth/core" {
  interface BetterAuthPluginRegistry<AuthOptions, Options> {
    paystack: {
      creator: typeof paystack;
    };
  }
}

const INTERNAL_ERROR_CODES = defineErrorCodes(
  Object.fromEntries(
    Object.entries(PAYSTACK_ERROR_CODES).map(([key, value]) => [
      key,
      typeof value === "string" ? value : (value as { message: string }).message,
    ]),
  ),
);

export const paystack = <
  TPaystackClient extends PaystackClientLike = PaystackClientLike,
  O extends PaystackOptions<TPaystackClient> = PaystackOptions<TPaystackClient>,
>(
  options: O,
): {
  id: "paystack";
  endpoints: {
    initializeTransaction: StrictEndpoint<
      "/paystack/initialize-transaction",
      {
        method: "POST";
        body: ZodObject<
          {
            plan: ZodOptional<ZodString>;
            product: ZodOptional<ZodString>;
            amount: ZodOptional<ZodNumber>;
            currency: ZodOptional<ZodString>;
            email: ZodOptional<ZodString>;
            metadata: ZodOptional<ZodRecord<ZodString, ZodUnknown>>;
            referenceId: ZodOptional<ZodString>;
            callbackURL: ZodOptional<ZodString>;
            quantity: ZodOptional<ZodNumber>;
            scheduleAtPeriodEnd: ZodOptional<ZodBoolean>;
            cancelAtPeriodEnd: ZodOptional<ZodBoolean>;
            prorateAndCharge: ZodOptional<ZodBoolean>;
          },
          $strip
        >;
        use: (
          | ((
              getValue: (ctx: GenericEndpointContext) => string | string[],
            ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
          | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
        )[];
      },
      | {
          status: string;
          message: string;
          scheduled: boolean;
        }
      | {
          status: string;
          message: string;
          prorated: boolean;
        }
      | {
          url: string;
          reference: string;
          accessCode: string;
          redirect: boolean;
        }
      | undefined
    >;
    verifyTransaction: StrictEndpoint<
      "/paystack/verify-transaction",
      {
        method: "POST";
        body: ZodObject<
          {
            reference: ZodString;
          },
          $strip
        >;
        use: (
          | ((
              getValue: (ctx: GenericEndpointContext) => string | string[],
            ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
          | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
        )[];
      },
      {
        status: string;
        reference: string;
        data: {
          id: number;
          domain: string;
          status: string;
          reference: string;
          receipt_number: string | null;
          amount: number;
          message: string | null;
          gateway_response: string;
          channel: string;
          currency: string;
          ip_address: string | null;
          metadata: (string | Record<string, never> | number) | null;
          log: {
            start_time: number;
            time_spent: number;
            attempts: number;
            errors: number;
            success: boolean;
            mobile: boolean;
            input: unknown[];
            history: {
              type: string;
              message: string;
              time: number;
            }[];
          } | null;
          fees: number | null;
          fees_split: unknown;
          authorization: {
            authorization_code?: string;
            bin?: string | null;
            last4?: string;
            exp_month?: string;
            exp_year?: string;
            channel?: string;
            card_type?: string;
            bank?: string;
            country_code?: string;
            brand?: string;
            reusable?: boolean;
            signature?: string;
            account_name?: string | null;
            receiver_bank_account_number?: string | null;
            receiver_bank?: string | null;
          };
          customer: {
            id: number;
            first_name: string | null;
            last_name: string | null;
            email: string;
            customer_code: string;
            phone: string | null;
            metadata: Record<string, never> | null;
            risk_action: string;
            international_format_phone?: string | null;
          };
          plan: (string | Record<string, never>) | null;
          split: Record<string, never> | null;
          order_id: unknown;
          paidAt: string | null;
          createdAt: string;
          requested_amount: number;
          pos_transaction_data: unknown;
          source: unknown;
          fees_breakdown: unknown;
          connect: unknown;
          transaction_date: string;
          plan_object: {
            id?: number;
            name?: string;
            plan_code?: string;
            description?: unknown;
            amount?: number;
            interval?: string;
            send_invoices?: boolean;
            send_sms?: boolean;
            currency?: string;
          };
          subaccount: Record<string, never> | null;
        };
      }
    >;
    listSubscriptions: StrictEndpoint<
      "/paystack/list-subscriptions",
      {
        method: "GET";
        query: ZodObject<
          {
            referenceId: ZodOptional<ZodString>;
          },
          $strip
        >;
        use: (
          | ((
              getValue: (ctx: GenericEndpointContext) => string | string[],
            ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
          | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
        )[];
      },
      {
        subscriptions: Subscription[];
      }
    >;
    paystackWebhook: StrictEndpoint<
      "/paystack/webhook",
      {
        method: "POST";
        metadata: {
          openapi: {
            operationId: string;
          };
          scope: "server";
        };
        cloneRequest: true;
        disableBody: true;
      },
      {
        received: boolean;
      }
    >;
    listTransactions: StrictEndpoint<
      "/paystack/list-transactions",
      {
        method: "GET";
        query: ZodObject<
          {
            referenceId: ZodOptional<ZodString>;
          },
          $strip
        >;
        use: (
          | ((
              getValue: (ctx: GenericEndpointContext) => string | string[],
            ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
          | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
        )[];
      },
      {
        transactions: PaystackTransaction[];
      }
    >;
    getConfig: StrictEndpoint<
      "/paystack/config",
      {
        method: "GET";
        metadata: {
          openapi: {
            operationId: string;
          };
        };
      },
      {
        plans: PaystackPlan[];
        products: PaystackProduct[];
      }
    >;
    disableSubscription: StrictEndpoint<
      "/paystack/disable-subscription",
      {
        method: "POST";
        body: ZodObject<
          {
            referenceId: ZodOptional<ZodString>;
            subscriptionCode: ZodString;
            emailToken: ZodOptional<ZodString>;
            atPeriodEnd: ZodOptional<ZodBoolean>;
          },
          $strip
        >;
        use: (
          | ((
              getValue: (ctx: GenericEndpointContext) => string | string[],
            ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
          | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
        )[];
      },
      {
        status: string;
      }
    >;
    enableSubscription: StrictEndpoint<
      "/paystack/enable-subscription",
      {
        method: "POST";
        body: ZodObject<
          {
            referenceId: ZodOptional<ZodString>;
            subscriptionCode: ZodString;
            emailToken: ZodOptional<ZodString>;
            atPeriodEnd: ZodOptional<ZodBoolean>;
          },
          $strip
        >;
        use: (
          | ((
              getValue: (ctx: GenericEndpointContext) => string | string[],
            ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
          | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
        )[];
      },
      {
        status: string;
      }
    >;
    getSubscriptionManageLink: StrictEndpoint<
      "/paystack/subscription-manage-link",
      {
        method: "GET";
        query: ZodObject<
          {
            subscriptionCode: ZodString;
          },
          $strip
        >;
        use: (
          | ((
              getValue: (ctx: GenericEndpointContext) => string | string[],
            ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
          | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
        )[];
      },
      {
        link: string | null;
      }
    >;
    subscriptionManageLink: StrictEndpoint<
      "/paystack/subscription/manage-link",
      {
        method: "GET";
        query: ZodObject<
          {
            subscriptionCode: ZodString;
          },
          $strip
        >;
        use: (
          | ((
              getValue: (ctx: GenericEndpointContext) => string | string[],
            ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
          | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
        )[];
      },
      {
        link: string | null;
      }
    >;
    createSubscription: StrictEndpoint<
      "/paystack/create-subscription",
      {
        method: "POST";
        body: ZodObject<
          {
            plan: ZodOptional<ZodString>;
            product: ZodOptional<ZodString>;
            amount: ZodOptional<ZodNumber>;
            currency: ZodOptional<ZodString>;
            email: ZodOptional<ZodString>;
            metadata: ZodOptional<ZodRecord<ZodString, ZodUnknown>>;
            referenceId: ZodOptional<ZodString>;
            callbackURL: ZodOptional<ZodString>;
            quantity: ZodOptional<ZodNumber>;
            scheduleAtPeriodEnd: ZodOptional<ZodBoolean>;
            cancelAtPeriodEnd: ZodOptional<ZodBoolean>;
            prorateAndCharge: ZodOptional<ZodBoolean>;
          },
          $strip
        >;
        use: (
          | ((
              getValue: (ctx: GenericEndpointContext) => string | string[],
            ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
          | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
        )[];
      },
      | {
          status: string;
          message: string;
          scheduled: boolean;
        }
      | {
          status: string;
          message: string;
          prorated: boolean;
        }
      | {
          url: string;
          reference: string;
          accessCode: string;
          redirect: boolean;
        }
      | undefined
    >;
    upgradeSubscription: StrictEndpoint<
      "/paystack/upgrade-subscription",
      {
        method: "POST";
        body: ZodObject<
          {
            plan: ZodOptional<ZodString>;
            product: ZodOptional<ZodString>;
            amount: ZodOptional<ZodNumber>;
            currency: ZodOptional<ZodString>;
            email: ZodOptional<ZodString>;
            metadata: ZodOptional<ZodRecord<ZodString, ZodUnknown>>;
            referenceId: ZodOptional<ZodString>;
            callbackURL: ZodOptional<ZodString>;
            quantity: ZodOptional<ZodNumber>;
            scheduleAtPeriodEnd: ZodOptional<ZodBoolean>;
            cancelAtPeriodEnd: ZodOptional<ZodBoolean>;
            prorateAndCharge: ZodOptional<ZodBoolean>;
          },
          $strip
        >;
        use: (
          | ((
              getValue: (ctx: GenericEndpointContext) => string | string[],
            ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
          | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
        )[];
      },
      | {
          status: string;
          message: string;
          scheduled: boolean;
        }
      | {
          status: string;
          message: string;
          prorated: boolean;
        }
      | {
          url: string;
          reference: string;
          accessCode: string;
          redirect: boolean;
        }
      | undefined
    >;
    cancelSubscription: StrictEndpoint<
      "/paystack/cancel-subscription",
      {
        method: "POST";
        body: ZodObject<
          {
            referenceId: ZodOptional<ZodString>;
            subscriptionCode: ZodString;
            emailToken: ZodOptional<ZodString>;
            atPeriodEnd: ZodOptional<ZodBoolean>;
          },
          $strip
        >;
        use: (
          | ((
              getValue: (ctx: GenericEndpointContext) => string | string[],
            ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
          | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
        )[];
      },
      {
        status: string;
      }
    >;
    restoreSubscription: StrictEndpoint<
      "/paystack/restore-subscription",
      {
        method: "POST";
        body: ZodObject<
          {
            referenceId: ZodOptional<ZodString>;
            subscriptionCode: ZodString;
            emailToken: ZodOptional<ZodString>;
            atPeriodEnd: ZodOptional<ZodBoolean>;
          },
          $strip
        >;
        use: (
          | ((
              getValue: (ctx: GenericEndpointContext) => string | string[],
            ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
          | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
        )[];
      },
      {
        status: string;
      }
    >;
    listProducts: StrictEndpoint<
      "/paystack/list-products",
      {
        method: "GET";
        metadata: {
          openapi: {
            operationId: string;
          };
        };
      },
      {
        products: PaystackProduct[];
      }
    >;
    listPlans: StrictEndpoint<
      "/paystack/list-plans",
      {
        method: "GET";
        metadata: {
          scope: "server";
        };
        use: ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<{
          session: {
            session: Record<string, unknown> & {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              userId: string;
              expiresAt: Date;
              token: string;
              ipAddress?: string | null | undefined;
              userAgent?: string | null | undefined;
            };
            user: Record<string, unknown> & {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            };
          };
        }>)[];
      },
      {
        plans: PaystackPlan[];
      }
    >;
  };
  schema: BetterAuthPluginDBSchema;
  init: (ctx: AuthContext) => {
    options: {
      databaseHooks: {
        user: {
          create: {
            after(
              user: { id: string; email?: string | null; name?: string | null },
              hookCtx?: GenericEndpointContext | null,
            ): Promise<void>;
          };
        };
        organization:
          | {
              create: {
                after(
                  org: { id: string; name: string; email?: string | null },
                  hookCtx: GenericEndpointContext | null,
                ): Promise<void>;
              };
            }
          | undefined;
      };
      member: {
        create: {
          before: (
            member: { organizationId: string },
            ctx: GenericEndpointContext | null | undefined,
          ) => Promise<void>;
          after: (
            member: { organizationId: string | undefined },
            ctx: GenericEndpointContext | null | undefined,
          ) => Promise<void>;
        };
        delete: {
          after: (
            member: { organizationId: string | undefined },
            ctx: GenericEndpointContext | null | undefined,
          ) => Promise<void>;
        };
      };
      invitation: {
        create: {
          before: (
            invitation: { organizationId: string },
            ctx: GenericEndpointContext | null | undefined,
          ) => Promise<void>;
          after: (
            invitation: { organizationId: string | undefined },
            ctx: GenericEndpointContext | null | undefined,
          ) => Promise<void>;
        };
        delete: {
          after: (
            invitation: { organizationId: string | undefined },
            ctx: GenericEndpointContext | null | undefined,
          ) => Promise<void>;
        };
      };
      team: {
        create: {
          before: (
            team: { organizationId: string },
            ctx: GenericEndpointContext | null | undefined,
          ) => Promise<void>;
        };
      };
    };
  };
  $ERROR_CODES: Record<string, RawError<string>>;
  options: NoInfer<O>;
} => {
  const routeOptions = {
    ...(options as unknown as AnyPaystackOptions),
    webhook: {
      ...options.webhook,
      secret: options.webhook?.secret ?? options.paystackWebhookSecret,
    },
  } satisfies AnyPaystackOptions;
  return {
    id: "paystack",
    endpoints: {
      initializeTransaction: initializeTransaction(
        routeOptions,
        "/paystack/initialize-transaction",
      ),
      verifyTransaction: verifyTransaction(routeOptions, "/paystack/verify-transaction"),
      listSubscriptions: listSubscriptions(routeOptions, "/paystack/list-subscriptions"),
      paystackWebhook: paystackWebhook(routeOptions, "/paystack/webhook"),
      listTransactions: listTransactions(routeOptions, "/paystack/list-transactions"),
      getConfig: getConfig(routeOptions, "/paystack/config"),
      disableSubscription: disablePaystackSubscription(
        routeOptions,
        "/paystack/disable-subscription",
      ),
      enableSubscription: enablePaystackSubscription(routeOptions, "/paystack/enable-subscription"),
      getSubscriptionManageLink: getSubscriptionManageLink(
        routeOptions,
        "/paystack/subscription-manage-link",
      ),
      subscriptionManageLink: getSubscriptionManageLink(
        routeOptions,
        "/paystack/subscription/manage-link",
      ),
      createSubscription: createSubscription(routeOptions, "/paystack/create-subscription"),
      upgradeSubscription: upgradeSubscription(routeOptions, "/paystack/upgrade-subscription"),
      cancelSubscription: cancelSubscription(routeOptions, "/paystack/cancel-subscription"),
      restoreSubscription: restoreSubscription(routeOptions, "/paystack/restore-subscription"),
      listProducts: listProducts(routeOptions, "/paystack/list-products"),
      listPlans: listPlans(routeOptions, "/paystack/list-plans"),
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
    options: options as NoInfer<O>,
  } satisfies BetterAuthPlugin;
};

export type PaystackPlugin<
  TPaystackClient extends PaystackClientLike = PaystackClientLike,
  O extends PaystackOptions<TPaystackClient> = PaystackOptions<TPaystackClient>,
> = ReturnType<typeof paystack<TPaystackClient, O>>;

export { chargeSubscriptionRenewal, syncPaystackPlans, syncPaystackProducts } from "./operations";
export type { Subscription, SubscriptionOptions, PaystackPlan, PaystackOptions, PaystackProduct };
