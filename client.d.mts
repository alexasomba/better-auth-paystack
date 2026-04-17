import { d as PaystackTransaction, f as Subscription, l as PaystackPlan, n as paystack, o as AnyPaystackOptions, s as PaystackClientLike, u as PaystackProduct } from "./index-Dwbeddkr.mjs";
import { BetterFetch, BetterFetchOption, BetterFetchResponse } from "@better-fetch/fetch";

//#region src/client.d.ts
declare const paystackClient: <O extends {
  subscription?: boolean;
}>(_options?: O) => {
  id: "paystack";
  version: string;
  $InferServerPlugin: ReturnType<typeof paystack<PaystackClientLike, AnyPaystackOptions>>;
  getActions: ($fetch: BetterFetch, _$store: unknown, _options: unknown) => {
    transaction: {
      initialize: (data: Record<string, unknown> & {
        callbackUrl?: string;
        callbackURL?: string;
        product?: string;
        referenceId?: string;
      }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
        url: string;
        reference: string;
        accessCode: string;
        redirect: boolean;
      }>>;
      verify: (data: {
        reference: string;
      }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
        status: string;
        reference: string;
        data: unknown;
      }>>;
      list: (data?: {
        query?: Record<string, unknown>;
      }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
        transactions: PaystackTransaction[];
      }>>;
    };
    subscription: {
      /**
       * Initialize a transaction to upgrade or creating a subscription.
       */
      upgrade: (data: Record<string, unknown> & {
        callbackUrl?: string;
        callbackURL?: string;
        product?: string;
        referenceId?: string;
      }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
        url: string;
        reference: string;
        accessCode: string;
        redirect: boolean;
      }>>;
      /**
       * Initialize a payment to create a subscription.
       */
      create: (data: Record<string, unknown> & {
        callbackUrl?: string;
        callbackURL?: string;
        product?: string;
        referenceId?: string;
      }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
        url: string;
        reference: string;
        accessCode: string;
        redirect: boolean;
      }>>;
      /**
       * Disable a subscription.
       */
      cancel: (data: {
        subscriptionCode: string;
        emailToken?: string;
        atPeriodEnd?: boolean;
      }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
        status: string;
      }>>;
      /**
       * Enable a subscription.
       */
      restore: (data: {
        subscriptionCode: string;
        emailToken?: string;
      }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
        status: string;
      }>>;
      /**
       * List subscriptions for the user.
       */
      list: (data?: {
        query?: Record<string, unknown>;
      }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
        subscriptions: Subscription[];
      }>>;
      /**
       * Get a link to manage the subscription on Paystack.
       */
      billingPortal: (data: {
        subscriptionCode: string;
      }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
        link: string;
      }>>;
      manageLink: (data: {
        subscriptionCode: string;
      }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
        link: string;
      }>>;
      disable: (data: {
        subscriptionCode: string;
        emailToken?: string;
        atPeriodEnd?: boolean;
      }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
        status: string;
      }>>;
      enable: (data: {
        subscriptionCode: string;
        emailToken?: string;
      }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
        status: string;
      }>>;
    };
    initializeTransaction: (data: Record<string, unknown> & {
      callbackUrl?: string;
      callbackURL?: string;
      product?: string;
      referenceId?: string;
    }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
      url: string;
      reference: string;
      accessCode: string;
      redirect: boolean;
    }>>;
    verifyTransaction: (data: {
      reference: string;
    }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
      status: string;
      reference: string;
      data: unknown;
    }>>;
    listTransactions: (data?: {
      query?: Record<string, unknown>;
    }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
      transactions: PaystackTransaction[];
    }>>;
    listSubscriptions: (data?: {
      query?: Record<string, unknown>;
    }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
      subscriptions: Subscription[];
    }>>;
    getSubscriptionManageLink: (data: {
      subscriptionCode: string;
    }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
      link: string;
    }>>;
    config: () => Promise<BetterFetchResponse<Record<string, unknown>>>;
    listProducts: (options?: BetterFetchOption) => Promise<BetterFetchResponse<{
      products: PaystackProduct[];
    }>>;
    listPlans: (options?: BetterFetchOption) => Promise<BetterFetchResponse<{
      plans: PaystackPlan[];
    }>>;
  };
};
//#endregion
export { paystackClient };
//# sourceMappingURL=client.d.mts.map