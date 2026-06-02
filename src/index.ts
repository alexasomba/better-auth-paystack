import type { CustomerCreatePayload } from "@alexasomba/paystack-node";
import {
  defineErrorCodes,
  type AuthContext,
  type BetterAuthPlugin,
  type GenericEndpointContext,
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
  PaystackCustomerResponse,
  AnyPaystackOptions,
  User,
} from "./types";
import { createPaystackAdapter } from "./paystack-sdk";
import { PACKAGE_VERSION } from "./version";
import { createBillingStoreFromAdapter } from "./billing-store";
import { stringifyPaystackMetadata } from "./metadata";

export {
  createCheckoutMetadata,
  createProrationMetadata,
  createRenewalMetadata,
  getMetadataBoolean,
  getMetadataNumber,
  getMetadataString,
  hasPaystackMetadata,
  parsePaystackMetadata,
  stringifyPaystackMetadata,
} from "./metadata";
export type { PaystackMetadata } from "./metadata";
export type { PaystackInitializeResult } from "./types";

declare module "better-auth" {
  interface BetterAuthPluginRegistry<AuthOptions, Options> {
    paystack: {
      creator: typeof paystack;
    };
  }
}

const INTERNAL_ERROR_CODES: ReturnType<typeof defineErrorCodes> = defineErrorCodes(
  Object.fromEntries(
    Object.entries(PAYSTACK_ERROR_CODES).map(([key, value]) => [
      key,
      typeof value === "string" ? value : (value as { message: string }).message,
    ]),
  ),
);

type BetterAuthEndpoint = NonNullable<BetterAuthPlugin["endpoints"]>[string];

interface PaystackPluginEndpoints extends Record<string, BetterAuthEndpoint> {
  initializeTransaction: ReturnType<typeof initializeTransaction>;
  verifyTransaction: ReturnType<typeof verifyTransaction>;
  listSubscriptions: ReturnType<typeof listSubscriptions>;
  paystackWebhook: ReturnType<typeof paystackWebhook>;
  listTransactions: ReturnType<typeof listTransactions>;
  getConfig: ReturnType<typeof getConfig>;
  disableSubscription: ReturnType<typeof disablePaystackSubscription>;
  enableSubscription: ReturnType<typeof enablePaystackSubscription>;
  getSubscriptionManageLink: ReturnType<typeof getSubscriptionManageLink>;
  subscriptionManageLink: ReturnType<typeof getSubscriptionManageLink>;
  createSubscription: ReturnType<typeof createSubscription>;
  upgradeSubscription: ReturnType<typeof upgradeSubscription>;
  cancelSubscription: ReturnType<typeof cancelSubscription>;
  restoreSubscription: ReturnType<typeof restoreSubscription>;
  listProducts: ReturnType<typeof listProducts>;
  listPlans: ReturnType<typeof listPlans>;
}

type PaystackHookHandler = (...args: unknown[]) => unknown;

interface PaystackPluginInitResult {
  options: {
    databaseHooks: Record<string, unknown> & {
      organization: {
        create: {
          after: PaystackHookHandler;
        };
      };
    };
  };
}

type PaystackPluginInit = ((ctx: AuthContext) => PaystackPluginInitResult) &
  NonNullable<BetterAuthPlugin["init"]>;

type PaystackPluginInstance<O extends AnyPaystackOptions> = Omit<
  BetterAuthPlugin,
  "id" | "version" | "endpoints" | "schema" | "init" | "$ERROR_CODES" | "options"
> & {
  id: "paystack";
  version: typeof PACKAGE_VERSION;
  endpoints: PaystackPluginEndpoints;
  schema: ReturnType<typeof getSchema>;
  init: PaystackPluginInit;
  $ERROR_CODES: typeof INTERNAL_ERROR_CODES;
  options: NoInfer<O>;
};

const createPaystackPlugin = <
  TPaystackClient extends PaystackClientLike = PaystackClientLike,
  O extends PaystackOptions<TPaystackClient> = PaystackOptions<TPaystackClient>,
>(
  options: O,
): PaystackPluginInstance<O> => {
  const routeOptions = {
    ...(options as unknown as AnyPaystackOptions),
    webhook: {
      ...options.webhook,
      secret: options.webhook?.secret ?? options.paystackWebhookSecret,
    },
  } satisfies AnyPaystackOptions;
  return {
    id: "paystack",
    version: PACKAGE_VERSION as typeof PACKAGE_VERSION,
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
    init: ((ctx: AuthContext) => {
      const organizationPluginAvailable = ctx.hasPlugin("organization");
      if (options.organization?.enabled === true && !organizationPluginAvailable) {
        ctx.logger.error(
          "Paystack organization billing is enabled, but the Better Auth organization plugin was not found. Organization billing hooks will be skipped.",
        );
      }

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
                    const sdkRes = (await createPaystackAdapter(
                      options.paystackClient as PaystackClientLike,
                    ).createCustomer({
                      email: user.email,
                      first_name: user.name ?? undefined,
                      metadata: stringifyPaystackMetadata({ userId: user.id }),
                    })) as PaystackCustomerResponse;
                    const customerCode = sdkRes?.customer_code;

                    if (
                      customerCode !== undefined &&
                      customerCode !== null &&
                      customerCode !== ""
                    ) {
                      await createBillingStoreFromAdapter(ctx.adapter).saveCustomerCode(
                        user.id,
                        customerCode,
                        false,
                      );

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
              options.organization?.enabled === true && organizationPluginAvailable
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
                            const store = createBillingStoreFromAdapter(ctx.adapter);
                            const ownerMember = await store.findOrganizationOwner(org.id);
                            if (ownerMember !== null && ownerMember !== undefined) {
                              const ownerUser = await store.findUser(ownerMember.userId);
                              targetEmail = ownerUser?.email;
                            }
                          }

                          if (targetEmail === undefined || targetEmail === null) return;

                          const params = defu(
                            {
                              email: targetEmail,
                              first_name: org.name,
                              metadata: stringifyPaystackMetadata({ organizationId: org.id }),
                            },
                            extraCreateParams,
                          );
                          const sdkRes = (await createPaystackAdapter(
                            options.paystackClient as PaystackClientLike,
                          ).createCustomer(
                            params as CustomerCreatePayload,
                          )) as PaystackCustomerResponse;
                          const customerCode = sdkRes?.customer_code as string | undefined;

                          if (
                            customerCode !== undefined &&
                            customerCode !== null &&
                            customerCode !== "" &&
                            sdkRes !== undefined &&
                            sdkRes !== null
                          ) {
                            await createBillingStoreFromAdapter(ctx.adapter).saveCustomerCode(
                              org.id,
                              customerCode,
                              true,
                            );

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
            member: organizationPluginAvailable
              ? {
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
                }
              : undefined,
            invitation: organizationPluginAvailable
              ? {
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
                }
              : undefined,
            team: organizationPluginAvailable
              ? {
                  create: {
                    before: async (
                      team: { organizationId: string },
                      ctx: GenericEndpointContext | null | undefined,
                    ) => {
                      if (options.subscription?.enabled === true && team.organizationId && ctx) {
                        const subscription = await getOrganizationSubscription(
                          ctx,
                          team.organizationId,
                        );
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
                }
              : undefined,
          },
        },
      };
    }) as PaystackPluginInit,
    $ERROR_CODES: INTERNAL_ERROR_CODES,
    options: options as NoInfer<O>,
  } satisfies BetterAuthPlugin;
};

export const paystack: typeof createPaystackPlugin = createPaystackPlugin;

export type PaystackPlugin<
  TPaystackClient extends PaystackClientLike = PaystackClientLike,
  O extends PaystackOptions<TPaystackClient> = PaystackOptions<TPaystackClient>,
> = ReturnType<typeof paystack<TPaystackClient, O>>;

export { chargeSubscriptionRenewal, syncPaystackPlans, syncPaystackProducts } from "./operations";
export { reconcilePaystackTransaction } from "./reconciliation";
export type {
  PaystackReconciliationError,
  PaystackReconciliationSource,
  PaystackReconciliationSummary,
  ReconcilePaystackTransactionFailure,
  ReconcilePaystackTransactionInput,
  ReconcilePaystackTransactionResult,
  ReconcilePaystackTransactionSuccess,
} from "./reconciliation";
export type {
  Subscription,
  SubscriptionOptions,
  PaystackPlan,
  PaystackOptions,
  PaystackProduct,
  PaystackTransactionResponse,
  PaystackClientLike,
  ChargeRecurringSubscriptionResult,
  PaystackSyncResult,
} from "./types";
