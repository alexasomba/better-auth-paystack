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
) => {
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
          /**
           * Aliases for legacy/demo usage.
           */
          listLocal: listSubscriptions,
          manageLink: getSubscriptionManageLink,
          disable: cancelSubscription,
          enable: restoreSubscription,
        },
        initializeTransaction,
        verifyTransaction,
        listTransactions,
        listSubscriptions,
        getSubscriptionManageLink,
        getConfig: async (): Promise<BetterFetchResponse<Record<string, unknown>>> => {
          return fetch<Record<string, unknown>>("/paystack/config", {
            method: "GET",
          });
        },
        syncProducts: async (): Promise<BetterFetchResponse<{ status: string; count: number }>> => {
          return fetch<{ status: string; count: number }>("/paystack/sync-products", {
            method: "POST",
          });
        },
        syncPlans: async (): Promise<BetterFetchResponse<{ status: string; count: number }>> => {
          return fetch<{ status: string; count: number }>("/paystack/sync-plans", {
            method: "POST",
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
