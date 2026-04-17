import type { GenericEndpointContext, Session, User } from "better-auth";
import type { Organization, Member } from "better-auth/plugins/organization";
import type {
  PaystackPaths,
  PaystackResponse,
  PaystackWebhookEvent,
  PaystackClient,
  components,
} from "@alexasomba/paystack-node";

/**
 * Valid Paystack currencies
 */
export type PaystackCurrency = components["schemas"]["Currency"];

export type { PaystackPaths, PaystackClient, PaystackResponse };

/**
 * Standard Better Auth Models
 */
export type { User, Session, Organization, Member };

/**
 * Custom models for Paystack Plugin
 * These align with the database schema in src/schema.ts
 */
export interface PaystackTransaction {
  id: string;
  reference: string;
  paystackId?: string;
  referenceId: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  plan?: string | null;
  product?: string | null;
  metadata?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaystackProduct {
  id?: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  quantity?: number;
  unlimited?: boolean;
  paystackId?: string;
  slug?: string;
  metadata?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InputPaystackProduct {
  name: string;
  description?: string;
  amount: number;
  currency: string;
}

/**
 * Enhanced Better Auth Models with Paystack Fields
 */
export interface PaystackUser extends User {
  paystackCustomerCode?: string;
}

export interface PaystackOrganization extends Organization {
  paystackCustomerCode?: string;
}

export interface PaystackPlan {
  id?: string;
  name: string;
  description?: string;
  amount?: number;
  currency?: string;
  interval?: string;
  planCode?: string;
  paystackId?: string;
  seatAmount?: number;
  seatPlanCode?: string;
  invoiceLimit?: number;
  freeTrial?: {
    days?: number;
    onTrialStart?: (subscription: Subscription) => Promise<void>;
  };
  limits?: Record<string, unknown>;
  features?: string[];
  metadata?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Paystack Webhook Payload structure
 */
export type PaystackWebhookPayload = PaystackWebhookEvent;

/**
 * Paystack SDK Result types
 */
export type PaystackTransactionResponse = components["schemas"]["VerifyResponse"]["data"];
export type PaystackPlanResponse = components["schemas"]["PlanListResponseArray"];
export type PaystackCustomerResponse =
  components["schemas"]["ChargeAuthorizationResponse"]["data"]["customer"];
export type PaystackSubscriptionResponse = components["schemas"]["SubscriptionListResponseArray"];
export type PaystackProductResponse = components["schemas"]["ProductListsResponseArray"];

export interface SubscriptionOptions {
  /**
   * Enable subscriptions
   */
  enabled?: boolean;
  /**
   * Plans configuration
   */
  plans: PaystackPlan[] | (() => Promise<PaystackPlan[]>);
  /**
   * Automatically sync quantity from local DB to Paystack (if seats are used)
   */
  autoSyncQuantity?: boolean;
  /**
   * Handling of subscription cancellation
   * @default "at_period_end"
   */
  cancelBehavior?: "at_period_end" | "immediately";
  /**
   * Handlers for subscription events
   */
  onSubscriptionComplete?: (
    data: { event: PaystackWebhookPayload; subscription: Subscription; plan: PaystackPlan },
    ctx: GenericEndpointContext,
  ) => Promise<void>;
  onSubscriptionCreated?: (
    data: { event: PaystackWebhookPayload; subscription: Subscription; plan: PaystackPlan },
    ctx: GenericEndpointContext,
  ) => Promise<void>;
  onSubscriptionCancel?: (
    data: { event: PaystackWebhookPayload; subscription: Subscription },
    ctx: GenericEndpointContext,
  ) => Promise<void>;
  /**
   * Authorization handler for reference checks
   */
  authorizeReference?: (
    data: { user: User; session: Session; referenceId: string; action: string },
    ctx: GenericEndpointContext,
  ) => Promise<boolean>;
  /**
   * Require email verification before subscription
   */
  requireEmailVerification?: boolean;
}

export interface PaystackOptions<TPaystackClient extends PaystackClientLike = PaystackClientLike> {
  /**
   * Paystack Secret Key
   */
  secretKey: string;
  /**
   * Paystack Client Instance
   * If provided, will be used instead of creating a new one with secretKey
   */
  paystackClient?: TPaystackClient;
  /**
   * Webhook configuration
   */
  webhook?: {
    /**
     * Webhook secret for signature verification
     */
    secret?: string;
  };
  /**
   * Subscription configuration
   */
  subscription?: SubscriptionOptions;
  /**
   * Billing pattern
   * @default "native"
   */
  billingPattern?: "native" | "local";
  /**
   * Global event handler
   */
  onEvent?: (event: PaystackWebhookEvent) => Promise<void>;
  /**
   * Organization billing configuration
   */
  organization?: {
    enabled?: boolean;
    getCustomerCreateParams?: (
      org: { id: string; name: string; email?: string | null },
      ctx: GenericEndpointContext,
    ) => Promise<Record<string, unknown>>;
    onCustomerCreate?: (
      data: { paystackCustomer: Record<string, unknown>; organization: unknown },
      ctx: GenericEndpointContext,
    ) => Promise<void>;
  };
  /**
   * Products configuration
   */
  products?: {
    products?: PaystackProduct[] | (() => Promise<PaystackProduct[]>);
  };
  createCustomerOnSignUp?: boolean;
  onCustomerCreate?: (
    data: { paystackCustomer: Record<string, unknown>; user: unknown },
    ctx: GenericEndpointContext,
  ) => Promise<void>;
  /**
   * Custom database schema / model names
   */
  schema?: Record<
    string,
    {
      modelName?: string;
      fields?: Record<string, string>;
    }
  >;
}

export interface Subscription {
  id: string;
  userId: string;
  organizationId?: string;
  plan: string;
  pendingPlan?: string | null;
  paystackSubscriptionCode?: string;
  paystackCustomerCode?: string;
  paystackPlanCode?: string;
  paystackAuthorizationCode?: string;
  paystackTransactionReference?: string;
  paystackEmailToken?: string;
  status: string;
  seats: number;
  referenceId: string;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  cancelAtPeriodEnd: boolean;
  trialStart?: Date | null;
  trialEnd?: Date | null;
  groupId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChargeRecurringSubscriptionInput {
  subscriptionId: string;
  amount?: number;
}

export interface ChargeRecurringSubscriptionResult {
  status: "success" | "failed";
  data: PaystackTransactionResponse;
}

export interface PaystackSyncResult {
  status: "success";
  count: number;
}

export type AnyPaystackOptions = PaystackOptions<PaystackClientLike>;

/**
 * A stricter PaystackClient interface based on the grouped SDK structure
 */
export interface PaystackClientLike {
  transaction?: {
    initialize: (init: {
      body: Record<string, unknown>;
    }) => Promise<PaystackResponse<Record<string, unknown>>>;
    verify: (
      reference: string,
      init?: Record<string, unknown>,
    ) => Promise<PaystackResponse<components["schemas"]["VerifyResponse"]["data"]>>;
    chargeAuthorization: (init: {
      body: Record<string, unknown>;
    }) => Promise<PaystackResponse<components["schemas"]["ChargeAuthorizationResponse"]["data"]>>;
  };
  customer?: {
    create: (init: {
      body: Record<string, unknown>;
    }) => Promise<
      PaystackResponse<components["schemas"]["ChargeAuthorizationResponse"]["data"]["customer"]>
    >;
    update: (
      email_or_code: string,
      init: { body: Record<string, unknown> },
    ) => Promise<
      PaystackResponse<components["schemas"]["ChargeAuthorizationResponse"]["data"]["customer"]>
    >;
    fetch: (
      email_or_code: string,
      init?: Record<string, unknown>,
    ) => Promise<
      PaystackResponse<components["schemas"]["ChargeAuthorizationResponse"]["data"]["customer"]>
    >;
  };
  subscription?: {
    create: (init: {
      body: Record<string, unknown>;
    }) => Promise<PaystackResponse<components["schemas"]["SubscriptionListResponseArray"]>>;
    update: (
      code: string,
      init: { body: Record<string, unknown> },
    ) => Promise<PaystackResponse<components["schemas"]["SubscriptionListResponseArray"]>>;
    fetch: (
      id_or_code: string,
      init?: Record<string, unknown>,
    ) => Promise<PaystackResponse<components["schemas"]["SubscriptionListResponseArray"]>>;
    disable: (init: {
      body: { code: string; token: string };
    }) => Promise<PaystackResponse<Record<string, unknown>>>;
    enable: (init: {
      body: { code: string; token: string };
    }) => Promise<PaystackResponse<Record<string, unknown>>>;
    manageLink: (
      code: string,
      init?: Record<string, unknown>,
    ) => Promise<PaystackResponse<{ link: string }>>;
  };
  product?: {
    fetch: (
      id_or_code: string,
      init?: Record<string, unknown>,
    ) => Promise<PaystackResponse<components["schemas"]["ProductListsResponseArray"]>>;
    list: (init?: {
      query?: Record<string, unknown>;
    }) => Promise<PaystackResponse<components["schemas"]["ProductListsResponseArray"][]>>;
  };
  plan?: {
    list: (init?: {
      query?: Record<string, unknown>;
    }) => Promise<PaystackResponse<components["schemas"]["PlanListResponseArray"][]>>;
    create: (init: {
      body: Record<string, unknown>;
    }) => Promise<PaystackResponse<components["schemas"]["PlanListResponseArray"]>>;
  };
}
