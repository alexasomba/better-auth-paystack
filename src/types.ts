import type { GenericEndpointContext, Session, User } from "better-auth";
import type { Organization, Member } from "better-auth/plugins/organization";
import type {
  Paystack,
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
  /**
   * Deprecated legacy alias for `seatAmount`.
   * If used, it must still be a numeric amount in the smallest currency unit.
   */
  seatPriceId?: number | string;
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
   * Deprecated alias for `webhook.secret`.
   * Use `webhook.secret` for new code.
   */
  paystackWebhookSecret?: string;
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
     * Whether to verify the request origin IP address
     * @default false
     */
    verifyIP?: boolean;
    /**
     * List of trusted IP addresses for webhooks.
     * Defaults to official Paystack IPs if verifyIP is true and this is empty.
     */
    trustedIPs?: string[];
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
 * The grouped subset of the SDK surface used by this plugin.
 * Request payloads stay intentionally loose for plugin internals and mocks,
 * while return types are sourced from the official SDK so injected clients
 * retain concrete response payload types.
 */
export interface PaystackClientLike {
  transaction?: {
    initialize(...args: unknown[]): ReturnType<Paystack["transaction"]["initialize"]>;
    verify(...args: unknown[]): ReturnType<Paystack["transaction"]["verify"]>;
    chargeAuthorization(
      ...args: unknown[]
    ): ReturnType<Paystack["transaction"]["chargeAuthorization"]>;
  };
  customer?: {
    create(...args: unknown[]): ReturnType<Paystack["customer"]["create"]>;
    update(...args: unknown[]): ReturnType<Paystack["customer"]["update"]>;
    fetch(...args: unknown[]): ReturnType<Paystack["customer"]["fetch"]>;
  };
  subscription?: {
    create(...args: unknown[]): ReturnType<Paystack["subscription"]["create"]>;
    fetch(...args: unknown[]): ReturnType<Paystack["subscription"]["fetch"]>;
    disable(...args: unknown[]): ReturnType<Paystack["subscription"]["disable"]>;
    enable(...args: unknown[]): ReturnType<Paystack["subscription"]["enable"]>;
    manageLink(...args: unknown[]): ReturnType<Paystack["subscription"]["manageLink"]>;
    update?(...args: unknown[]): Promise<PaystackResponse<Record<string, unknown>>>;
  };
  product?: {
    fetch(...args: unknown[]): ReturnType<Paystack["product"]["fetch"]>;
    list(...args: unknown[]): ReturnType<Paystack["product"]["list"]>;
  };
  plan?: {
    list(...args: unknown[]): ReturnType<Paystack["plan"]["list"]>;
    create(...args: unknown[]): ReturnType<Paystack["plan"]["create"]>;
  };
}
