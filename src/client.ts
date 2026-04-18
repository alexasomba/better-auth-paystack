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

import type { paystack as paystackServer } from "./index";

declare module "better-auth/client" {
  interface BetterAuthClient {
    paystack: ReturnType<typeof paystackClient>["getActions"] extends (...args: any[]) => infer R
      ? R extends { paystack: infer P }
        ? P
        : R
      : never;
    subscription: ReturnType<typeof paystackClient>["getActions"] extends (
      ...args: any[]
    ) => infer R
      ? R extends { subscription: infer S }
        ? S
        : never
      : never;
    transaction: ReturnType<typeof paystackClient>["getActions"] extends (...args: any[]) => infer R
      ? R extends { transaction: infer T }
        ? T
        : never
      : never;
  }
}

declare module "better-auth" {
  interface BetterAuthClientPlugins {
    paystack: ReturnType<typeof paystackClient>;
  }
}

/**
 * Better Auth Paystack Client Plugin
 */
export const paystackClient = <
  O extends {
    subscription?: boolean;
  } = { subscription?: boolean },
>(
  _options?: O,
): BetterAuthClientPlugin & {
  getActions: ($fetch: BetterFetch, $store: any, options: any) => any;
} => {
  return {
    id: "paystack",
    version: "1.0.0",
    $InferServerPlugin: {} as ReturnType<
      typeof paystackServer<PaystackClientLike, AnyPaystackOptions>
    >,
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

      const listProducts = async (
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
      };

      const listPlans = async (
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
      };

      const config = async (): Promise<BetterFetchResponse<Record<string, unknown>>> => {
        return fetch<Record<string, unknown>>("/paystack/config", {
          method: "GET",
        });
      };

      const actions = {
        transaction: {
          initialize: initializeTransaction,
          verify: verifyTransaction,
          list: listTransactions,
        },
        subscription: {
          upgrade: initializeTransaction,
          create: initializeTransaction,
          cancel: cancelSubscription,
          restore: restoreSubscription,
          list: listSubscriptions,
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
        config,
        listProducts,
        listPlans,
      };

      return {
        ...actions,
        paystack: actions,
      };
    },
  } satisfies BetterAuthClientPlugin;
};

export const paystack: typeof paystackClient = paystackClient;
