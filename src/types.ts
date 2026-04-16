import type { GenericEndpointContext, Session, User } from "better-auth";
import type {
  PaystackPaths,
  PaystackResponse,
  PaystackWebhookEvent,
} from "@alexasomba/paystack-node";

/**
 * Valid Paystack currencies
 */
export type PaystackCurrency = "NGN" | "GHS" | "ZAR" | "USD" | "KES";

export type { PaystackPaths };

/**
 * Standard Better Auth Models
 */
export type { User, Session };

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  metadata?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Member {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Custom models for Paystack Plugin
 */
export interface PaystackTransaction {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  metadata?: string | null;
  paystackId?: string | null;
  referenceId: string;
  userId?: string | null;
  product?: string | null;
  quantity?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaystackProduct {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  paystackId?: string | null;
  slug?: string | null;
  quantity?: number | null;
  unlimited?: boolean | null;
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
  amount: number;
  currency: string;
  interval: string;
  planCode: string;
  paystackId: string;
  seatAmount?: number;
  seatPlanCode?: string;
  invoiceLimit?: number;
  freeTrial?: {
    days?: number;
    onTrialStart?: (subscription: Subscription) => Promise<void>;
  };
  limits?: Record<string, unknown>;
  metadata?: string;
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
export type PaystackTransactionResponse = Record<string, unknown>;
export type PaystackPlanResponse = Record<string, unknown>;
export type PaystackCustomerResponse = Record<string, unknown>;
export type PaystackSubscriptionResponse = Record<string, unknown>;
export type PaystackProductResponse = Record<string, unknown>;

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
    data: { event: Record<string, unknown>; subscription: Subscription; plan: PaystackPlan },
    ctx: GenericEndpointContext,
  ) => Promise<void>;
  onSubscriptionCreated?: (
    data: { event: Record<string, unknown>; subscription: Subscription; plan: PaystackPlan },
    ctx: GenericEndpointContext,
  ) => Promise<void>;
  onSubscriptionCancel?: (
    data: { event: Record<string, unknown>; subscription: Subscription },
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
    /**
     * Disable signature verification (not recommended for production)
     */
    disableVerification?: boolean;
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
  schema?: Record<string, string>;
}

export interface Subscription {
  id: string;
  userId: string;
  organizationId?: string;
  plan: string;
  pendingPlan?: string | null;
  paystackSubscriptionCode: string;
  paystackCustomerCode: string;
  paystackPlanCode: string;
  paystackAuthorizationCode: string;
  paystackTransactionReference: string;
  status: string;
  seats: number;
  referenceId: string;
  periodStart: Date;
  periodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialStart?: Date;
  trialEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type AnyPaystackOptions = PaystackOptions<PaystackClientLike>;

/**
 * A stricter PaystackClient interface based on the grouped SDK structure
 */
export interface PaystackClientLike {
  transaction?: {
    initialize: (
      init: Record<string, unknown>,
    ) => Promise<PaystackResponse<Record<string, unknown>>>;
    verify: (init: {
      params: { path: { reference: string } };
    }) => Promise<PaystackResponse<Record<string, unknown>>>;
    chargeAuthorization: (init: {
      body: Record<string, unknown>;
    }) => Promise<PaystackResponse<Record<string, unknown>>>;
  };
  customer?: {
    create: (init: Record<string, unknown>) => Promise<PaystackResponse<Record<string, unknown>>>;
    update: (init: {
      params: { path: { email_or_code: string } };
      body: Record<string, unknown>;
    }) => Promise<PaystackResponse<Record<string, unknown>>>;
    fetch: (init: {
      params: { path: { email_or_code: string } };
    }) => Promise<PaystackResponse<Record<string, unknown>>>;
  };
  subscription?: {
    create: (init: Record<string, unknown>) => Promise<PaystackResponse<Record<string, unknown>>>;
    update: (init: {
      params: { path: { code: string } };
      body: Record<string, unknown>;
    }) => Promise<PaystackResponse<Record<string, unknown>>>;
    fetch: (init: {
      params: { path: { id_or_code: string } };
    }) => Promise<PaystackResponse<Record<string, unknown>>>;
    disable: (init: {
      body: { code: string; token: string };
    }) => Promise<PaystackResponse<Record<string, unknown>>>;
    enable: (init: {
      body: { code: string; token: string };
    }) => Promise<PaystackResponse<Record<string, unknown>>>;
    manageLink: (
      code: string,
      init?: Record<string, unknown>,
    ) => Promise<PaystackResponse<Record<string, unknown>>>;
  };
  product?: {
    fetch: (init: {
      params: { path: { id_or_code: string } };
    }) => Promise<PaystackResponse<Record<string, unknown>>>;
    list: (init?: Record<string, unknown>) => Promise<PaystackResponse<Record<string, unknown>[]>>;
  };
  plan?: {
    list: (init?: Record<string, unknown>) => Promise<PaystackResponse<Record<string, unknown>[]>>;
    create: (init: Record<string, unknown>) => Promise<PaystackResponse<Record<string, unknown>>>;
  };
}
