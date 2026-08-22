import type { BetterFetchResponse, BetterFetchOption, BetterFetch } from "@better-fetch/fetch";
import type { BetterAuthClientPlugin } from "better-auth/client";

import type { paystack as paystackServer } from "./index";
import type {
  PaystackPlan,
  PaystackProduct,
  PaystackTransaction,
  PaystackTransactionResponse,
  Subscription,
  PaystackClientLike,
  AnyPaystackOptions,
  PaystackInitializeResult,
} from "./types";
import { PACKAGE_VERSION } from "./version";

export { parsePaystackMetadata } from "./metadata";
export type { PaystackMetadata } from "./metadata";

/**
 * Helper type to handle the conditional return type based on 'throw' option.
 */
export type FetchResult<T, O extends BetterFetchOption | undefined> = O extends { throw: true }
  ? T
  : BetterFetchResponse<T>;

/**
 * Paystack Client Action Definitions
 */
export interface PaystackActions {
  /**
   * Initialize a transaction.
   */
  initializeTransaction: <O extends BetterFetchOption | undefined = undefined>(
    data: Record<string, unknown> & {
      callbackUrl?: string;
      callbackURL?: string;
      product?: string;
      referenceId?: string;
    },
    options?: O,
  ) => Promise<FetchResult<PaystackInitializeResult, O>>;
  /**
   * Verify a transaction by reference.
   */
  verifyTransaction: <O extends BetterFetchOption | undefined = undefined>(
    data: { reference: string },
    options?: O,
  ) => Promise<
    FetchResult<
      {
        status: string;
        reference: string;
        data: PaystackTransactionResponse;
      },
      O
    >
  >;
  /**
   * List transactions for the current user/reference.
   */
  listTransactions: <O extends BetterFetchOption | undefined = undefined>(
    data?: { query?: Record<string, unknown> },
    options?: O,
  ) => Promise<FetchResult<{ transactions: PaystackTransaction[] }, O>>;
  /**
   * List subscriptions for the current user/reference.
   */
  listSubscriptions: <O extends BetterFetchOption | undefined = undefined>(
    data?: { query?: Record<string, unknown> },
    options?: O,
  ) => Promise<FetchResult<{ subscriptions: Subscription[] }, O>>;
  /**
   * Get a manage link/billing portal link for a subscription.
   */
  getSubscriptionManageLink: <O extends BetterFetchOption | undefined = undefined>(
    data: { subscriptionCode: string },
    options?: O,
  ) => Promise<FetchResult<{ link: string }, O>>;
  /**
   * Get the plugin configuration (plans and products).
   */
  config: () => Promise<BetterFetchResponse<Record<string, unknown>>>;
  /**
   * List available products.
   */
  listProducts: <O extends BetterFetchOption | undefined = undefined>(
    options?: O,
  ) => Promise<FetchResult<{ products: PaystackProduct[] }, O>>;
  /**
   * List available plans.
   */
  listPlans: <O extends BetterFetchOption | undefined = undefined>(
    options?: O,
  ) => Promise<FetchResult<{ plans: PaystackPlan[] }, O>>;
}

/**
 * Paystack Client Plugin Actions including namespaces
 */
export interface PaystackClientActions extends PaystackActions {
  transaction: {
    initialize: PaystackActions["initializeTransaction"];
    verify: PaystackActions["verifyTransaction"];
    list: PaystackActions["listTransactions"];
  };
  subscription: {
    upgrade: PaystackActions["initializeTransaction"];
    create: PaystackActions["initializeTransaction"];
    cancel: <O extends BetterFetchOption | undefined = undefined>(
      data: {
        subscriptionCode: string;
        emailToken?: string;
        atPeriodEnd?: boolean;
      },
      options?: O,
    ) => Promise<FetchResult<{ status: string }, O>>;
    restore: <O extends BetterFetchOption | undefined = undefined>(
      data: {
        subscriptionCode: string;
        emailToken?: string;
      },
      options?: O,
    ) => Promise<FetchResult<{ status: string }, O>>;
    list: PaystackActions["listSubscriptions"];
    billingPortal: PaystackActions["getSubscriptionManageLink"];
    manageLink: PaystackActions["getSubscriptionManageLink"];
    /**
     * @deprecated Use `subscription.cancel` instead.
     */
    disable: PaystackClientActions["subscription"]["cancel"];
    /**
     * @deprecated Use `subscription.restore` instead.
     */
    enable: PaystackClientActions["subscription"]["restore"];
  };
  paystack: PaystackClientActions;
}

declare module "better-auth/client" {
  interface BetterAuthClient {
    paystack: PaystackClientActions;
    subscription: PaystackClientActions["subscription"];
    transaction: PaystackClientActions["transaction"];
  }
}

declare module "better-auth" {
  interface BetterAuthClientPlugins {
    paystack: ReturnType<typeof paystackClient>;
  }
}

/**
 * The concrete shape returned by {@link paystackClient}.
 *
 * `id` and `$InferServerPlugin` are deliberately narrower than the
 * `BetterAuthClientPlugin` defaults: Better Auth keys its plugin merge on the *literal*
 * plugin id and reads the server plugin's endpoints off `$InferServerPlugin`. Widening
 * either one (e.g. by annotating this function as returning plain
 * `BetterAuthClientPlugin`) collapses the entire inferred auth client to `never`.
 */
type PaystackClientPluginInstance = Omit<
  BetterAuthClientPlugin,
  "id" | "$InferServerPlugin" | "getActions"
> & {
  id: "paystack";
  $InferServerPlugin: ReturnType<typeof paystackServer<PaystackClientLike, AnyPaystackOptions>>;
  getActions: ($fetch: BetterFetch, $store: unknown, options: unknown) => PaystackClientActions;
};

/**
 * Better Auth Paystack Client Plugin
 */
export const paystackClient = <
  O extends {
    subscription?: boolean;
  } = { subscription?: boolean },
>(
  _options?: O,
): PaystackClientPluginInstance => {
  return {
    id: "paystack",
    version: PACKAGE_VERSION,
    $InferServerPlugin: {} as ReturnType<
      typeof paystackServer<PaystackClientLike, AnyPaystackOptions>
    >,
    pathMethods: {
      "/paystack/initialize-transaction": "POST",
      "/paystack/verify-transaction": "POST",
      "/paystack/disable-subscription": "POST",
      "/paystack/enable-subscription": "POST",
      "/paystack/create-subscription": "POST",
      "/paystack/upgrade-subscription": "POST",
      "/paystack/cancel-subscription": "POST",
      "/paystack/restore-subscription": "POST",
    },
    getActions: (
      $fetch: BetterFetch,
      _store: unknown,
      _options: unknown,
    ): PaystackClientActions => {
      const fetch = $fetch;

      const actions = {
        transaction: {
          initialize: (data: unknown, options?: BetterFetchOption) =>
            fetch("/paystack/initialize-transaction", { method: "POST", body: data, ...options }),
          verify: (data: unknown, options?: BetterFetchOption) =>
            fetch("/paystack/verify-transaction", { method: "POST", body: data, ...options }),
          list: (data?: { query?: Record<string, unknown> }, options?: BetterFetchOption) =>
            fetch("/paystack/list-transactions", { method: "GET", query: data?.query, ...options }),
        },
        subscription: {
          upgrade: (data: unknown, options?: BetterFetchOption) =>
            fetch("/paystack/initialize-transaction", { method: "POST", body: data, ...options }),
          create: (data: unknown, options?: BetterFetchOption) =>
            fetch("/paystack/initialize-transaction", { method: "POST", body: data, ...options }),
          cancel: (data: unknown, options?: BetterFetchOption) =>
            fetch("/paystack/disable-subscription", { method: "POST", body: data, ...options }),
          restore: (data: unknown, options?: BetterFetchOption) =>
            fetch("/paystack/enable-subscription", { method: "POST", body: data, ...options }),
          list: (data?: { query?: Record<string, unknown> }, options?: BetterFetchOption) =>
            fetch("/paystack/list-subscriptions", {
              method: "GET",
              query: data?.query,
              ...options,
            }),
          billingPortal: (data: unknown, options?: BetterFetchOption) =>
            fetch("/paystack/subscription-manage-link", { method: "GET", query: data, ...options }),
          manageLink: (data: unknown, options?: BetterFetchOption) =>
            fetch("/paystack/subscription-manage-link", { method: "GET", query: data, ...options }),
          disable: function (data: unknown, options?: BetterFetchOption) {
            return this.cancel(data, options);
          },
          enable: function (data: unknown, options?: BetterFetchOption) {
            return this.restore(data, options);
          },
        },
        initializeTransaction: (data: unknown, options?: BetterFetchOption) =>
          fetch("/paystack/initialize-transaction", { method: "POST", body: data, ...options }),
        verifyTransaction: (data: unknown, options?: BetterFetchOption) =>
          fetch("/paystack/verify-transaction", { method: "POST", body: data, ...options }),
        listTransactions: (
          data?: { query?: Record<string, unknown> },
          options?: BetterFetchOption,
        ) =>
          fetch("/paystack/list-transactions", { method: "GET", query: data?.query, ...options }),
        listSubscriptions: (
          data?: { query?: Record<string, unknown> },
          options?: BetterFetchOption,
        ) =>
          fetch("/paystack/list-subscriptions", { method: "GET", query: data?.query, ...options }),
        getSubscriptionManageLink: (data: unknown, options?: BetterFetchOption) =>
          fetch("/paystack/subscription-manage-link", { method: "GET", query: data, ...options }),
        config: () => fetch("/paystack/config", { method: "GET" }),
        listProducts: (options?: BetterFetchOption) =>
          fetch("/paystack/list-products", { method: "GET", ...options }),
        listPlans: (options?: BetterFetchOption) =>
          fetch("/paystack/list-plans", { method: "GET", ...options }),
        paystack: {} as unknown,
      } as unknown as PaystackClientActions;

      actions.paystack = actions;

      return actions;
    },
  } satisfies BetterAuthClientPlugin;
};

export const paystack: typeof paystackClient = paystackClient;
