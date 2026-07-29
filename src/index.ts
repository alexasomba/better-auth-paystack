import {
  defineErrorCodes,
  type AuthContext,
  type BetterAuthPlugin,
  type GenericEndpointContext,
} from "better-auth";
import { APIError } from "better-auth/api";
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
import { checkSeatLimit, checkTeamLimit, getOrganizationEntitlements } from "./limits";
import { syncSubscriptionSeats } from "./utils";
import type { PaystackClientLike, PaystackOptions, AnyPaystackOptions, User } from "./types";
import { createPaystackAdapter } from "./paystack-sdk";
import { PACKAGE_VERSION } from "./version";
import { createBillingStoreFromAdapter } from "./billing-store";
import { resolvePaystackCustomer } from "./customer";

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

/**
 * Must stay a `type` rather than an `interface`.
 *
 * `BetterAuthPlugin["endpoints"]` is `{ [key: string]: Endpoint }`, and only object literal
 * *type aliases* get TypeScript's implicit index signature — interfaces do not. Declaring
 * this as `interface ... extends Record<string, Endpoint>` satisfies that constraint but
 * gives the plugin a real string index signature. Better Auth merges every plugin's
 * endpoints into `auth.api`, so that signature spreads across the whole API surface and,
 * under `noUncheckedIndexedAccess`, makes *every* `auth.api.*` call possibly `undefined`.
 */
// oxlint-disable-next-line typescript/consistent-type-definitions
type PaystackPluginEndpoints = {
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
};

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
    webhook: options.webhook,
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
                  user: {
                    id: string;
                    email?: string | null;
                    name?: string | null;
                    emailVerified?: boolean;
                    paystackCustomerCode?: string | null;
                  },
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
                    const result = await resolvePaystackCustomer({
                      adapter: ctx.adapter,
                      client: options.paystackClient as PaystackClientLike,
                      logger: ctx.logger,
                      reference: {
                        id: user.id,
                        type: "user",
                        email: user.email,
                        name: user.name,
                        emailVerified: user.emailVerified,
                        paystackCustomerCode: user.paystackCustomerCode,
                      },
                    });
                    const customerCode = result?.customer.customer_code;

                    if (
                      result?.created === true &&
                      typeof customerCode === "string" &&
                      typeof options.onCustomerCreate === "function"
                    ) {
                      await options.onCustomerCreate(
                        {
                          paystackCustomer: result.customer,
                          user: {
                            ...(user as User),
                            paystackCustomerCode: customerCode,
                          },
                        },
                        hookCtx,
                      );
                    }
                  } catch (error: unknown) {
                    ctx.logger.error("Failed to create Paystack customer for user", error);
                  }
                },
              },
              update: {
                async after(user: {
                  id: string;
                  email?: string | null;
                  paystackCustomerCode?: string | null;
                }) {
                  const persisted = await createBillingStoreFromAdapter(ctx.adapter).findUser(
                    user.id,
                  );
                  const customerCode =
                    user.paystackCustomerCode ??
                    (persisted as { paystackCustomerCode?: string | null } | null)
                      ?.paystackCustomerCode;
                  if (
                    typeof customerCode !== "string" ||
                    customerCode === "" ||
                    typeof user.email !== "string" ||
                    user.email === ""
                  )
                    return;
                  try {
                    await createPaystackAdapter(options.paystackClient).updateCustomer(
                      customerCode,
                      { email: user.email },
                    );
                  } catch (error: unknown) {
                    ctx.logger.error("Failed to synchronize Paystack customer email", error);
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
                                )(org, hookCtx!)
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

                          const result = await resolvePaystackCustomer({
                            adapter: ctx.adapter,
                            client: options.paystackClient as PaystackClientLike,
                            logger: ctx.logger,
                            reference: {
                              id: org.id,
                              type: "organization",
                              email: targetEmail,
                              name: org.name,
                              paystackCustomerCode: (
                                org as { paystackCustomerCode?: string | null }
                              ).paystackCustomerCode,
                            },
                            createParams: defu({}, extraCreateParams),
                          });
                          const customerCode = result?.customer.customer_code;

                          if (
                            result?.created === true &&
                            typeof customerCode === "string" &&
                            typeof options.organization?.onCustomerCreate === "function"
                          ) {
                            await options.organization.onCustomerCreate(
                              {
                                paystackCustomer: result.customer,
                                organization: {
                                  ...org,
                                  paystackCustomerCode: customerCode,
                                },
                              },
                              hookCtx!,
                            );
                          }
                        } catch (error: unknown) {
                          ctx.logger.error(
                            "Failed to create Paystack customer for organization",
                            error,
                          );
                        }
                      },
                    },
                    update: {
                      async after(
                        org: {
                          id: string;
                          name?: string | null;
                          email?: string | null;
                          paystackCustomerCode?: string | null;
                        },
                        hookCtx?: GenericEndpointContext | null,
                      ) {
                        const persisted = await createBillingStoreFromAdapter(
                          ctx.adapter,
                        ).findOrganization(org.id);
                        const customerCode =
                          org.paystackCustomerCode ?? persisted?.paystackCustomerCode;
                        if (typeof customerCode !== "string" || customerCode === "") return;
                        try {
                          const configured =
                            typeof options.organization?.getCustomerCreateParams === "function" &&
                            hookCtx
                              ? await options.organization.getCustomerCreateParams(
                                  {
                                    id: org.id,
                                    name: org.name ?? persisted?.name ?? "",
                                    email:
                                      org.email ??
                                      (persisted as typeof persisted & { email?: string | null })
                                        ?.email,
                                  },
                                  hookCtx,
                                )
                              : {};
                          const configuredEmail =
                            typeof configured.email === "string" && configured.email !== ""
                              ? configured.email
                              : undefined;
                          await createPaystackAdapter(options.paystackClient).updateCustomer(
                            customerCode,
                            {
                              ...(configuredEmail !== undefined ||
                              (typeof org.email === "string" && org.email !== "")
                                ? { email: configuredEmail ?? org.email ?? undefined }
                                : {}),
                              ...(typeof org.name === "string" && org.name !== ""
                                ? { first_name: org.name }
                                : {}),
                            },
                          );
                        } catch (error: unknown) {
                          ctx.logger.error(
                            "Failed to synchronize Paystack organization customer",
                            error,
                          );
                        }
                      },
                    },
                    delete: {
                      async before(org: { id: string; paystackCustomerCode?: string | null }) {
                        const store = createBillingStoreFromAdapter(ctx.adapter);
                        const subscriptions = await store.findSubscriptionsByReference(org.id);
                        if (
                          subscriptions.some(
                            (subscription) =>
                              subscription.status === "active" ||
                              subscription.status === "trialing",
                          )
                        ) {
                          throw new APIError("BAD_REQUEST", {
                            message:
                              "Organization cannot be deleted while it has an active subscription",
                          });
                        }

                        const persisted = await store.findOrganization(org.id);
                        const customerCode =
                          org.paystackCustomerCode ?? persisted?.paystackCustomerCode;
                        if (typeof customerCode !== "string" || customerCode === "") return;
                        try {
                          const customer = (await createPaystackAdapter(
                            options.paystackClient,
                          ).fetchCustomer(customerCode)) as {
                            subscriptions?: { status?: string }[];
                          };
                          if (
                            customer.subscriptions?.some(
                              (subscription) =>
                                subscription.status === "active" ||
                                subscription.status === "trialing",
                            ) === true
                          ) {
                            throw new APIError("BAD_REQUEST", {
                              message:
                                "Organization cannot be deleted while it has an active subscription",
                            });
                          }
                        } catch (error: unknown) {
                          if (error instanceof APIError) throw error;
                          ctx.logger.error(
                            "Failed to check Paystack subscriptions before organization deletion",
                            error,
                          );
                          throw new APIError("BAD_REQUEST", {
                            message:
                              "Organization deletion could not verify its Paystack subscriptions",
                          });
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
                        const entitlements = await getOrganizationEntitlements(
                          ctx,
                          team.organizationId,
                          routeOptions,
                        );
                        const maxTeams = entitlements.limits.teams;
                        if (typeof maxTeams === "number") {
                          await checkTeamLimit(ctx, team.organizationId, maxTeams);
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
    options: options,
  } satisfies BetterAuthPlugin;
};

export const paystack: typeof createPaystackPlugin = createPaystackPlugin;

export type PaystackPlugin<
  TPaystackClient extends PaystackClientLike = PaystackClientLike,
  O extends PaystackOptions<TPaystackClient> = PaystackOptions<TPaystackClient>,
> = ReturnType<typeof paystack<TPaystackClient, O>>;

export { chargeSubscriptionRenewal, syncPaystackPlans, syncPaystackProducts } from "./operations";
export { getOrganizationEntitlements } from "./limits";
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
