import { GenericEndpointContext, Session, User } from "better-auth";
import { PaystackCustomerClient, PaystackPlanClient, PaystackProductClient, PaystackSubscriptionClient, PaystackTransactionClient, PaystackWebhookEvent, components } from "@alexasomba/paystack-node";
//#region src/types.d.ts
type PaystackCheckoutChannel = "card" | "bank" | "ussd" | "qr" | "mobile_money" | "bank_transfer" | "eft" | "apple_pay";
/**
 * Custom models for Paystack Plugin
 * These align with the database schema in src/schema.ts
 */
interface PaystackTransaction {
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
interface PaystackProduct {
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
interface PaystackPlan {
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
type PaystackWebhookPayload = PaystackWebhookEvent;
/**
 * Paystack SDK Result types
 */
type PaystackTransactionResponse = components["schemas"]["VerifyResponse"]["data"];
interface SubscriptionOptions {
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
  onSubscriptionComplete?: (data: {
    event: PaystackWebhookPayload;
    subscription: Subscription;
    plan: PaystackPlan;
  }, ctx: GenericEndpointContext) => Promise<void>;
  onSubscriptionCreated?: (data: {
    event: PaystackWebhookPayload;
    subscription: Subscription;
    plan: PaystackPlan;
  }, ctx: GenericEndpointContext) => Promise<void>;
  onSubscriptionCancel?: (data: {
    event: PaystackWebhookPayload;
    subscription: Subscription;
  }, ctx: GenericEndpointContext) => Promise<void>;
  /**
   * Authorization handler for reference checks
   */
  authorizeReference?: (data: {
    user: User;
    session: Session;
    referenceId: string;
    action: string;
  }, ctx: GenericEndpointContext) => Promise<boolean>;
  /**
   * Require email verification before subscription
   */
  requireEmailVerification?: boolean;
  /**
   * Restrict checkout to specific Paystack channels for subscription flows.
   * Use `["card"]` to enforce card-only subscriptions.
   */
  allowedPaymentChannels?: PaystackCheckoutChannel[];
}
interface PaystackOptions<TPaystackClient extends PaystackClientLike = PaystackClientLike> {
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
    getCustomerCreateParams?: (org: {
      id: string;
      name: string;
      email?: string | null;
    }, ctx: GenericEndpointContext) => Promise<Record<string, unknown>>;
    onCustomerCreate?: (data: {
      paystackCustomer: Record<string, unknown>;
      organization: unknown;
    }, ctx: GenericEndpointContext) => Promise<void>;
  };
  /**
   * Products configuration
   */
  products?: {
    products?: PaystackProduct[] | (() => Promise<PaystackProduct[]>);
  };
  createCustomerOnSignUp?: boolean;
  onCustomerCreate?: (data: {
    paystackCustomer: Record<string, unknown>;
    user: unknown;
  }, ctx: GenericEndpointContext) => Promise<void>;
  /**
   * Custom database schema / model names
   */
  schema?: Record<string, {
    modelName?: string;
    fields?: Record<string, string>;
  }>;
}
interface Subscription {
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
interface ChargeRecurringSubscriptionInput {
  subscriptionId: string;
  amount?: number;
}
interface ChargeRecurringSubscriptionResult {
  status: "success" | "failed";
  data: PaystackTransactionResponse;
}
interface PaystackSyncResult {
  status: "success";
  count: number;
}
type AnyPaystackOptions = PaystackOptions<PaystackClientLike>;
/**
 * Exact grouped SDK slices used by this plugin.
 * This deliberately matches the official SDK surface instead of a handwritten approximation.
 */
interface PaystackClientLike {
  transaction: Pick<PaystackTransactionClient, "initialize" | "verify" | "chargeAuthorization">;
  customer: Pick<PaystackCustomerClient, "create" | "update" | "fetch">;
  subscription: Pick<PaystackSubscriptionClient, "create" | "fetch" | "disable" | "enable" | "manageLink">;
  product: Pick<PaystackProductClient, "fetch" | "list">;
  plan: Pick<PaystackPlanClient, "list" | "create">;
}
//#endregion
export { PaystackOptions as a, PaystackSyncResult as c, Subscription as d, SubscriptionOptions as f, PaystackClientLike as i, PaystackTransaction as l, ChargeRecurringSubscriptionInput as n, PaystackPlan as o, ChargeRecurringSubscriptionResult as r, PaystackProduct as s, AnyPaystackOptions as t, PaystackTransactionResponse as u };
//# sourceMappingURL=types-B5ZnlFrq.d.mts.map