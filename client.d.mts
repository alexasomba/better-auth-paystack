import { d as Subscription, l as PaystackTransaction, o as PaystackPlan, s as PaystackProduct, u as PaystackTransactionResponse } from "./types-B5ZnlFrq.mjs";
import { BetterAuthClientPlugin } from "better-auth";
import { BetterFetch, BetterFetchOption, BetterFetchResponse } from "@better-fetch/fetch";

//#region src/client.d.ts
/**
 * Helper type to handle the conditional return type based on 'throw' option.
 */
type FetchResult<T, O extends BetterFetchOption | undefined> = O extends {
  throw: true;
} ? T : BetterFetchResponse<T>;
/**
 * Paystack Client Action Definitions
 */
interface PaystackActions {
  /**
   * Initialize a transaction.
   */
  initializeTransaction: <O extends BetterFetchOption | undefined = undefined>(data: Record<string, unknown> & {
    callbackUrl?: string;
    callbackURL?: string;
    product?: string;
    referenceId?: string;
  }, options?: O) => Promise<FetchResult<{
    url: string;
    reference: string;
    accessCode: string;
    redirect: boolean;
  }, O>>;
  /**
   * Verify a transaction by reference.
   */
  verifyTransaction: <O extends BetterFetchOption | undefined = undefined>(data: {
    reference: string;
  }, options?: O) => Promise<FetchResult<{
    status: string;
    reference: string;
    data: PaystackTransactionResponse;
  }, O>>;
  /**
   * List transactions for the current user/reference.
   */
  listTransactions: <O extends BetterFetchOption | undefined = undefined>(data?: {
    query?: Record<string, unknown>;
  }, options?: O) => Promise<FetchResult<{
    transactions: PaystackTransaction[];
  }, O>>;
  /**
   * List subscriptions for the current user/reference.
   */
  listSubscriptions: <O extends BetterFetchOption | undefined = undefined>(data?: {
    query?: Record<string, unknown>;
  }, options?: O) => Promise<FetchResult<{
    subscriptions: Subscription[];
  }, O>>;
  /**
   * Get a manage link/billing portal link for a subscription.
   */
  getSubscriptionManageLink: <O extends BetterFetchOption | undefined = undefined>(data: {
    subscriptionCode: string;
  }, options?: O) => Promise<FetchResult<{
    link: string;
  }, O>>;
  /**
   * Get the plugin configuration (plans and products).
   */
  config: () => Promise<BetterFetchResponse<Record<string, unknown>>>;
  /**
   * List available products.
   */
  listProducts: <O extends BetterFetchOption | undefined = undefined>(options?: O) => Promise<FetchResult<{
    products: PaystackProduct[];
  }, O>>;
  /**
   * List available plans.
   */
  listPlans: <O extends BetterFetchOption | undefined = undefined>(options?: O) => Promise<FetchResult<{
    plans: PaystackPlan[];
  }, O>>;
}
/**
 * Paystack Client Plugin Actions including namespaces
 */
interface PaystackClientActions extends PaystackActions {
  transaction: {
    initialize: PaystackActions["initializeTransaction"];
    verify: PaystackActions["verifyTransaction"];
    list: PaystackActions["listTransactions"];
  };
  subscription: {
    upgrade: PaystackActions["initializeTransaction"];
    create: PaystackActions["initializeTransaction"];
    cancel: <O extends BetterFetchOption | undefined = undefined>(data: {
      subscriptionCode: string;
      emailToken?: string;
      atPeriodEnd?: boolean;
    }, options?: O) => Promise<FetchResult<{
      status: string;
    }, O>>;
    restore: <O extends BetterFetchOption | undefined = undefined>(data: {
      subscriptionCode: string;
      emailToken?: string;
    }, options?: O) => Promise<FetchResult<{
      status: string;
    }, O>>;
    list: PaystackActions["listSubscriptions"];
    billingPortal: PaystackActions["getSubscriptionManageLink"];
    manageLink: PaystackActions["getSubscriptionManageLink"];
    disable: PaystackClientActions["subscription"]["cancel"];
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
 * Better Auth Paystack Client Plugin
 */
declare const paystackClient: <O extends {
  subscription?: boolean;
} = {
  subscription?: boolean;
}>(_options?: O) => BetterAuthClientPlugin & {
  getActions: ($fetch: BetterFetch, $store: unknown, options: unknown) => PaystackClientActions;
};
declare const paystack: typeof paystackClient;
//#endregion
export { FetchResult, PaystackActions, PaystackClientActions, paystack, paystackClient };
//# sourceMappingURL=client.d.mts.map