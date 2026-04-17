import type { BetterAuthClientPlugin } from "better-auth";
import type { BetterFetchResponse, BetterFetchOption, BetterFetch } from "@better-fetch/fetch";
import type {
  PaystackPlan,
  PaystackProduct,
  PaystackTransaction,
  Subscription,
  PaystackClientLike,
  AnyPaystackOptions,
} from "./types";

import type { paystack } from "./index";

export const paystackClient = <
  O extends {
    subscription?: boolean;
  },
>(
  _options?: O,
): {
  id: "paystack";
  version: string;
  $InferServerPlugin: ReturnType<typeof paystack<PaystackClientLike, AnyPaystackOptions>>;
  getActions: (
    $fetch: BetterFetch,
    _$store: unknown,
    _options: unknown,
  ) => {
    transaction: {
      initialize: (
        data: Record<string, unknown> & {
          callbackUrl?: string; // Client-side alias
          callbackURL?: string; // Client-side alias
          product?: string;
          referenceId?: string;
        },
        options?: BetterFetchOption,
      ) => Promise<
        BetterFetchResponse<{
          url: string;
          reference: string;
          accessCode: string;
          redirect: boolean;
        }>
      >;
      verify: (
        data: { reference: string },
        options?: BetterFetchOption,
      ) => Promise<
        BetterFetchResponse<{
          status: string;
          reference: string;
          data: unknown;
        }>
      >;
      list: (
        data?: { query?: Record<string, unknown> },
        options?: BetterFetchOption,
      ) => Promise<
        BetterFetchResponse<{
          transactions: PaystackTransaction[];
        }>
      >;
    };
    subscription: {
      /**
       * Initialize a transaction to upgrade or creating a subscription.
       */
      upgrade: (
        data: Record<string, unknown> & {
          callbackUrl?: string; // Client-side alias
          callbackURL?: string; // Client-side alias
          product?: string;
          referenceId?: string;
        },
        options?: BetterFetchOption,
      ) => Promise<
        BetterFetchResponse<{
          url: string;
          reference: string;
          accessCode: string;
          redirect: boolean;
        }>
      >;
      /**
       * Initialize a payment to create a subscription.
       */
      create: (
        data: Record<string, unknown> & {
          callbackUrl?: string; // Client-side alias
          callbackURL?: string; // Client-side alias
          product?: string;
          referenceId?: string;
        },
        options?: BetterFetchOption,
      ) => Promise<
        BetterFetchResponse<{
          url: string;
          reference: string;
          accessCode: string;
          redirect: boolean;
        }>
      >;
      /**
       * Disable a subscription.
       */
      cancel: (
        data: {
          subscriptionCode: string;
          emailToken?: string;
          atPeriodEnd?: boolean;
        },
        options?: BetterFetchOption,
      ) => Promise<
        BetterFetchResponse<{
          status: string;
        }>
      >;
      /**
       * Enable a subscription.
       */
      restore: (
        data: {
          subscriptionCode: string;
          emailToken?: string;
        },
        options?: BetterFetchOption,
      ) => Promise<
        BetterFetchResponse<{
          status: string;
        }>
      >;
      /**
       * List subscriptions for the user.
       */
      list: (
        data?: { query?: Record<string, unknown> },
        options?: BetterFetchOption,
      ) => Promise<
        BetterFetchResponse<{
          subscriptions: Subscription[];
        }>
      >;
      /**
       * Get a link to manage the subscription on Paystack.
       */
      billingPortal: (
        data: { subscriptionCode: string },
        options?: BetterFetchOption,
      ) => Promise<
        BetterFetchResponse<{
          link: string;
        }>
      >;
      manageLink: (
        data: { subscriptionCode: string },
        options?: BetterFetchOption,
      ) => Promise<
        BetterFetchResponse<{
          link: string;
        }>
      >;
      disable: (
        data: {
          subscriptionCode: string;
          emailToken?: string;
          atPeriodEnd?: boolean;
        },
        options?: BetterFetchOption,
      ) => Promise<
        BetterFetchResponse<{
          status: string;
        }>
      >;
      enable: (
        data: {
          subscriptionCode: string;
          emailToken?: string;
        },
        options?: BetterFetchOption,
      ) => Promise<
        BetterFetchResponse<{
          status: string;
        }>
      >;
    };
    initializeTransaction: (
      data: Record<string, unknown> & {
        callbackUrl?: string; // Client-side alias
        callbackURL?: string; // Client-side alias
        product?: string;
        referenceId?: string;
      },
      options?: BetterFetchOption,
    ) => Promise<
      BetterFetchResponse<{
        url: string;
        reference: string;
        accessCode: string;
        redirect: boolean;
      }>
    >;
    verifyTransaction: (
      data: { reference: string },
      options?: BetterFetchOption,
    ) => Promise<
      BetterFetchResponse<{
        status: string;
        reference: string;
        data: unknown;
      }>
    >;
    listTransactions: (
      data?: { query?: Record<string, unknown> },
      options?: BetterFetchOption,
    ) => Promise<
      BetterFetchResponse<{
        transactions: PaystackTransaction[];
      }>
    >;
    listSubscriptions: (
      data?: { query?: Record<string, unknown> },
      options?: BetterFetchOption,
    ) => Promise<
      BetterFetchResponse<{
        subscriptions: Subscription[];
      }>
    >;
    getSubscriptionManageLink: (
      data: { subscriptionCode: string },
      options?: BetterFetchOption,
    ) => Promise<
      BetterFetchResponse<{
        link: string;
      }>
    >;
    config: () => Promise<BetterFetchResponse<Record<string, unknown>>>;
    listProducts: (options?: BetterFetchOption) => Promise<
      BetterFetchResponse<{
        products: PaystackProduct[];
      }>
    >;
    listPlans: (options?: BetterFetchOption) => Promise<
      BetterFetchResponse<{
        plans: PaystackPlan[];
      }>
    >;
  };
} => {
  return {
    id: "paystack",
    version: "1.0.0",
    $InferServerPlugin: {} as ReturnType<typeof paystack<PaystackClientLike, AnyPaystackOptions>>,
    getActions: ($fetch: BetterFetch, _$store: unknown, _options: unknown) => {
      const fetch = $fetch;

      const initializeTransaction = async (
        data: Record<string, unknown> & {
          callbackUrl?: string; // Client-side alias
          callbackURL?: string; // Client-side alias
          product?: string;
          referenceId?: string;
        },
        options?: BetterFetchOption,
      ): Promise<
        BetterFetchResponse<{
          url: string;
          reference: string;
          accessCode: string;
          redirect: boolean;
        }>
      > => {
        return fetch<{
          url: string;
          reference: string;
          accessCode: string;
          redirect: boolean;
        }>("paystack/initialize-transaction", {
          method: "POST",
          body: data,
          ...options,
        });
      };

      const verifyTransaction = async (
        data: { reference: string },
        options?: BetterFetchOption,
      ): Promise<
        BetterFetchResponse<{
          status: string;
          reference: string;
          data: unknown;
        }>
      > => {
        return fetch<{
          status: string;
          reference: string;
          data: unknown;
        }>("paystack/verify-transaction", {
          method: "POST",
          body: data,
          ...options,
        });
      };

      const listTransactions = async (
        data: { query?: Record<string, unknown> } = {},
        options?: BetterFetchOption,
      ): Promise<
        BetterFetchResponse<{
          transactions: PaystackTransaction[];
        }>
      > => {
        return fetch<{
          transactions: PaystackTransaction[];
        }>("paystack/list-transactions", {
          method: "GET",
          query: data.query,
          ...options,
        });
      };

      const listSubscriptions = async (
        data: { query?: Record<string, unknown> } = {},
        options?: BetterFetchOption,
      ): Promise<
        BetterFetchResponse<{
          subscriptions: Subscription[];
        }>
      > => {
        return fetch<{
          subscriptions: Subscription[];
        }>("paystack/list-subscriptions", {
          method: "GET",
          query: data.query,
          ...options,
        });
      };

      const getSubscriptionManageLink = async (
        data: { subscriptionCode: string },
        options?: BetterFetchOption,
      ): Promise<
        BetterFetchResponse<{
          link: string;
        }>
      > => {
        return fetch<{
          link: string;
        }>("paystack/subscription-manage-link", {
          method: "GET",
          query: data,
          ...options,
        });
      };

      const cancelSubscription = async (
        data: {
          subscriptionCode: string;
          emailToken?: string;
          atPeriodEnd?: boolean;
        },
        options?: BetterFetchOption,
      ): Promise<
        BetterFetchResponse<{
          status: string;
        }>
      > => {
        return fetch<{
          status: string;
        }>("paystack/disable-subscription", {
          method: "POST",
          body: data,
          ...options,
        });
      };

      const restoreSubscription = async (
        data: {
          subscriptionCode: string;
          emailToken?: string;
        },
        options?: BetterFetchOption,
      ): Promise<
        BetterFetchResponse<{
          status: string;
        }>
      > => {
        return fetch<{
          status: string;
        }>("paystack/enable-subscription", {
          method: "POST",
          body: data,
          ...options,
        });
      };

      return {
        transaction: {
          initialize: initializeTransaction,
          verify: verifyTransaction,
          list: listTransactions,
        },
        subscription: {
          /**
           * Initialize a transaction to upgrade or creating a subscription.
           */
          upgrade: initializeTransaction,
          /**
           * Initialize a payment to create a subscription.
           */
          create: initializeTransaction,
          /**
           * Disable a subscription.
           */
          cancel: cancelSubscription,
          /**
           * Enable a subscription.
           */
          restore: restoreSubscription,
          /**
           * List subscriptions for the user.
           */
          list: listSubscriptions,
          /**
           * Get a link to manage the subscription on Paystack.
           */
          billingPortal: getSubscriptionManageLink,
          manageLink: getSubscriptionManageLink,
          disable: cancelSubscription,
          enable: restoreSubscription,
        },
        initializeTransaction,
        verifyTransaction,
        listTransactions,
        listSubscriptions,
        getSubscriptionManageLink,
        config: async (): Promise<BetterFetchResponse<Record<string, unknown>>> => {
          return fetch<Record<string, unknown>>("/paystack/config", {
            method: "GET",
          });
        },
        listProducts: async (
          options?: BetterFetchOption,
        ): Promise<
          BetterFetchResponse<{
            products: PaystackProduct[];
          }>
        > => {
          return fetch<{
            products: PaystackProduct[];
          }>("paystack/list-products", {
            method: "GET",
            ...options,
          });
        },
        listPlans: async (
          options?: BetterFetchOption,
        ): Promise<
          BetterFetchResponse<{
            plans: PaystackPlan[];
          }>
        > => {
          return fetch<{
            plans: PaystackPlan[];
          }>("paystack/list-plans", {
            method: "GET",
            ...options,
          });
        },
      };
    },
  } satisfies BetterAuthClientPlugin;
};
