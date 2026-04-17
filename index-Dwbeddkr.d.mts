import { AuthContext, BetterAuthPluginDBSchema, GenericEndpointContext, MiddlewareInputContext, MiddlewareOptions, RawError, Session, StrictEndpoint, User, ZodBoolean, ZodNumber, ZodObject, ZodOptional, ZodRecord, ZodString, ZodUnknown } from "better-auth";
import { PaystackResponse as PaystackResponse$1, PaystackWebhookEvent, components } from "@alexasomba/paystack-node";
import { $strip } from "zod/v4/core";

//#region src/types.d.ts
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
}
interface PaystackOptions<TPaystackClient extends PaystackClientLike = PaystackClientLike> {
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
 * A stricter PaystackClient interface based on the grouped SDK structure
 */
interface PaystackClientLike {
  transaction?: {
    initialize: (init: {
      body: Record<string, unknown>;
    }) => Promise<PaystackResponse$1<Record<string, unknown>>>;
    verify: (reference: string, init?: Record<string, unknown>) => Promise<PaystackResponse$1<components["schemas"]["VerifyResponse"]["data"]>>;
    chargeAuthorization: (init: {
      body: Record<string, unknown>;
    }) => Promise<PaystackResponse$1<components["schemas"]["ChargeAuthorizationResponse"]["data"]>>;
  };
  customer?: {
    create: (init: {
      body: Record<string, unknown>;
    }) => Promise<PaystackResponse$1<components["schemas"]["ChargeAuthorizationResponse"]["data"]["customer"]>>;
    update: (email_or_code: string, init: {
      body: Record<string, unknown>;
    }) => Promise<PaystackResponse$1<components["schemas"]["ChargeAuthorizationResponse"]["data"]["customer"]>>;
    fetch: (email_or_code: string, init?: Record<string, unknown>) => Promise<PaystackResponse$1<components["schemas"]["ChargeAuthorizationResponse"]["data"]["customer"]>>;
  };
  subscription?: {
    create: (init: {
      body: Record<string, unknown>;
    }) => Promise<PaystackResponse$1<components["schemas"]["SubscriptionListResponseArray"]>>;
    update: (code: string, init: {
      body: Record<string, unknown>;
    }) => Promise<PaystackResponse$1<components["schemas"]["SubscriptionListResponseArray"]>>;
    fetch: (id_or_code: string, init?: Record<string, unknown>) => Promise<PaystackResponse$1<components["schemas"]["SubscriptionListResponseArray"]>>;
    disable: (init: {
      body: {
        code: string;
        token: string;
      };
    }) => Promise<PaystackResponse$1<Record<string, unknown>>>;
    enable: (init: {
      body: {
        code: string;
        token: string;
      };
    }) => Promise<PaystackResponse$1<Record<string, unknown>>>;
    manageLink: (code: string, init?: Record<string, unknown>) => Promise<PaystackResponse$1<{
      link: string;
    }>>;
  };
  product?: {
    fetch: (id_or_code: string, init?: Record<string, unknown>) => Promise<PaystackResponse$1<components["schemas"]["ProductListsResponseArray"]>>;
    list: (init?: {
      query?: Record<string, unknown>;
    }) => Promise<PaystackResponse$1<components["schemas"]["ProductListsResponseArray"][]>>;
  };
  plan?: {
    list: (init?: {
      query?: Record<string, unknown>;
    }) => Promise<PaystackResponse$1<components["schemas"]["PlanListResponseArray"][]>>;
    create: (init: {
      body: Record<string, unknown>;
    }) => Promise<PaystackResponse$1<components["schemas"]["PlanListResponseArray"]>>;
  };
}
//#endregion
//#region src/operations.d.ts
declare function syncPaystackProducts(ctx: GenericEndpointContext, options: AnyPaystackOptions): Promise<PaystackSyncResult>;
declare function syncPaystackPlans(ctx: GenericEndpointContext, options: AnyPaystackOptions): Promise<PaystackSyncResult>;
declare function chargeSubscriptionRenewal(ctx: GenericEndpointContext, options: AnyPaystackOptions, input: ChargeRecurringSubscriptionInput): Promise<ChargeRecurringSubscriptionResult>;
//#endregion
//#region src/index.d.ts
declare module "@better-auth/core" {
  interface BetterAuthPluginRegistry<AuthOptions, Options> {
    paystack: {
      creator: typeof paystack;
    };
  }
}
declare const paystack: <TPaystackClient extends PaystackClientLike = PaystackClientLike, O extends PaystackOptions<TPaystackClient> = PaystackOptions<TPaystackClient>>(options: O) => {
  id: "paystack";
  endpoints: {
    initializeTransaction: StrictEndpoint<"/paystack/initialize-transaction", {
      method: "POST";
      body: ZodObject<{
        plan: ZodOptional<ZodString>;
        product: ZodOptional<ZodString>;
        amount: ZodOptional<ZodNumber>;
        currency: ZodOptional<ZodString>;
        email: ZodOptional<ZodString>;
        metadata: ZodOptional<ZodRecord<ZodString, ZodUnknown>>;
        referenceId: ZodOptional<ZodString>;
        callbackURL: ZodOptional<ZodString>;
        quantity: ZodOptional<ZodNumber>;
        scheduleAtPeriodEnd: ZodOptional<ZodBoolean>;
        cancelAtPeriodEnd: ZodOptional<ZodBoolean>;
        prorateAndCharge: ZodOptional<ZodBoolean>;
      }, $strip>;
      use: (((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>) | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>))[];
    }, {
      status: string;
      message: string;
      scheduled: boolean;
    } | {
      status: string;
      message: string;
      prorated: boolean;
    } | {
      url: string;
      reference: string;
      accessCode: string;
      redirect: boolean;
    } | undefined>;
    verifyTransaction: StrictEndpoint<"/paystack/verify-transaction", {
      method: "POST";
      body: ZodObject<{
        reference: ZodString;
      }, $strip>;
      use: (((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>) | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>))[];
    }, {
      status: string;
      reference: string;
      data: {
        id: number;
        domain: string;
        status: string;
        reference: string;
        receipt_number: string | null;
        amount: number;
        message: string | null;
        gateway_response: string;
        channel: string;
        currency: string;
        ip_address: string | null;
        metadata: (string | Record<string, never> | number) | null;
        log: {
          start_time: number;
          time_spent: number;
          attempts: number;
          errors: number;
          success: boolean;
          mobile: boolean;
          input: unknown[];
          history: {
            type: string;
            message: string;
            time: number;
          }[];
        } | null;
        fees: number | null;
        fees_split: unknown;
        authorization: {
          authorization_code?: string;
          bin?: string | null;
          last4?: string;
          exp_month?: string;
          exp_year?: string;
          channel?: string;
          card_type?: string;
          bank?: string;
          country_code?: string;
          brand?: string;
          reusable?: boolean;
          signature?: string;
          account_name?: string | null;
          receiver_bank_account_number?: string | null;
          receiver_bank?: string | null;
        };
        customer: {
          id: number;
          first_name: string | null;
          last_name: string | null;
          email: string;
          customer_code: string;
          phone: string | null;
          metadata: Record<string, never> | null;
          risk_action: string;
          international_format_phone?: string | null;
        };
        plan: (string | Record<string, never>) | null;
        split: Record<string, never> | null;
        order_id: unknown;
        paidAt: string | null;
        createdAt: string;
        requested_amount: number;
        pos_transaction_data: unknown;
        source: unknown;
        fees_breakdown: unknown;
        connect: unknown;
        transaction_date: string;
        plan_object: {
          id?: number;
          name?: string;
          plan_code?: string;
          description?: unknown;
          amount?: number;
          interval?: string;
          send_invoices?: boolean;
          send_sms?: boolean;
          currency?: string;
        };
        subaccount: Record<string, never> | null;
      };
    }>;
    listSubscriptions: StrictEndpoint<"/paystack/list-subscriptions", {
      method: "GET";
      query: ZodObject<{
        referenceId: ZodOptional<ZodString>;
      }, $strip>;
      use: (((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>) | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>))[];
    }, {
      subscriptions: Subscription[];
    }>;
    paystackWebhook: StrictEndpoint<"/paystack/webhook", {
      method: "POST";
      metadata: {
        openapi: {
          operationId: string;
        };
        scope: "server";
      };
      cloneRequest: true;
      disableBody: true;
    }, {
      received: boolean;
    }>;
    listTransactions: StrictEndpoint<"/paystack/list-transactions", {
      method: "GET";
      query: ZodObject<{
        referenceId: ZodOptional<ZodString>;
      }, $strip>;
      use: (((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>) | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>))[];
    }, {
      transactions: PaystackTransaction[];
    }>;
    getConfig: StrictEndpoint<"/paystack/config", {
      method: "GET";
      metadata: {
        openapi: {
          operationId: string;
        };
      };
    }, {
      plans: PaystackPlan[];
      products: PaystackProduct[];
    }>;
    disableSubscription: StrictEndpoint<"/paystack/disable-subscription", {
      method: "POST";
      body: ZodObject<{
        referenceId: ZodOptional<ZodString>;
        subscriptionCode: ZodString;
        emailToken: ZodOptional<ZodString>;
        atPeriodEnd: ZodOptional<ZodBoolean>;
      }, $strip>;
      use: (((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>) | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>))[];
    }, {
      status: string;
    }>;
    enableSubscription: StrictEndpoint<"/paystack/enable-subscription", {
      method: "POST";
      body: ZodObject<{
        referenceId: ZodOptional<ZodString>;
        subscriptionCode: ZodString;
        emailToken: ZodOptional<ZodString>;
        atPeriodEnd: ZodOptional<ZodBoolean>;
      }, $strip>;
      use: (((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>) | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>))[];
    }, {
      status: string;
    }>;
    getSubscriptionManageLink: StrictEndpoint<"/paystack/subscription-manage-link", {
      method: "GET";
      query: ZodObject<{
        subscriptionCode: ZodString;
      }, $strip>;
      use: (((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>) | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>))[];
    }, {
      link: string | null;
    }>;
    subscriptionManageLink: StrictEndpoint<"/paystack/subscription/manage-link", {
      method: "GET";
      query: ZodObject<{
        subscriptionCode: ZodString;
      }, $strip>;
      use: (((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>) | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>))[];
    }, {
      link: string | null;
    }>;
    createSubscription: StrictEndpoint<"/paystack/create-subscription", {
      method: "POST";
      body: ZodObject<{
        plan: ZodOptional<ZodString>;
        product: ZodOptional<ZodString>;
        amount: ZodOptional<ZodNumber>;
        currency: ZodOptional<ZodString>;
        email: ZodOptional<ZodString>;
        metadata: ZodOptional<ZodRecord<ZodString, ZodUnknown>>;
        referenceId: ZodOptional<ZodString>;
        callbackURL: ZodOptional<ZodString>;
        quantity: ZodOptional<ZodNumber>;
        scheduleAtPeriodEnd: ZodOptional<ZodBoolean>;
        cancelAtPeriodEnd: ZodOptional<ZodBoolean>;
        prorateAndCharge: ZodOptional<ZodBoolean>;
      }, $strip>;
      use: (((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>) | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>))[];
    }, {
      status: string;
      message: string;
      scheduled: boolean;
    } | {
      status: string;
      message: string;
      prorated: boolean;
    } | {
      url: string;
      reference: string;
      accessCode: string;
      redirect: boolean;
    } | undefined>;
    upgradeSubscription: StrictEndpoint<"/paystack/upgrade-subscription", {
      method: "POST";
      body: ZodObject<{
        plan: ZodOptional<ZodString>;
        product: ZodOptional<ZodString>;
        amount: ZodOptional<ZodNumber>;
        currency: ZodOptional<ZodString>;
        email: ZodOptional<ZodString>;
        metadata: ZodOptional<ZodRecord<ZodString, ZodUnknown>>;
        referenceId: ZodOptional<ZodString>;
        callbackURL: ZodOptional<ZodString>;
        quantity: ZodOptional<ZodNumber>;
        scheduleAtPeriodEnd: ZodOptional<ZodBoolean>;
        cancelAtPeriodEnd: ZodOptional<ZodBoolean>;
        prorateAndCharge: ZodOptional<ZodBoolean>;
      }, $strip>;
      use: (((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>) | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>))[];
    }, {
      status: string;
      message: string;
      scheduled: boolean;
    } | {
      status: string;
      message: string;
      prorated: boolean;
    } | {
      url: string;
      reference: string;
      accessCode: string;
      redirect: boolean;
    } | undefined>;
    cancelSubscription: StrictEndpoint<"/paystack/cancel-subscription", {
      method: "POST";
      body: ZodObject<{
        referenceId: ZodOptional<ZodString>;
        subscriptionCode: ZodString;
        emailToken: ZodOptional<ZodString>;
        atPeriodEnd: ZodOptional<ZodBoolean>;
      }, $strip>;
      use: (((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>) | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>))[];
    }, {
      status: string;
    }>;
    restoreSubscription: StrictEndpoint<"/paystack/restore-subscription", {
      method: "POST";
      body: ZodObject<{
        referenceId: ZodOptional<ZodString>;
        subscriptionCode: ZodString;
        emailToken: ZodOptional<ZodString>;
        atPeriodEnd: ZodOptional<ZodBoolean>;
      }, $strip>;
      use: (((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>) | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>))[];
    }, {
      status: string;
    }>;
    listProducts: StrictEndpoint<"/paystack/list-products", {
      method: "GET";
      metadata: {
        openapi: {
          operationId: string;
        };
      };
    }, {
      products: PaystackProduct[];
    }>;
    listPlans: StrictEndpoint<"/paystack/list-plans", {
      method: "GET";
      metadata: {
        scope: "server";
      };
      use: ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, unknown> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, unknown> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
    }, {
      plans: PaystackPlan[];
    }>;
  };
  schema: BetterAuthPluginDBSchema;
  init: (ctx: AuthContext) => {
    options: {
      databaseHooks: {
        user: {
          create: {
            after(user: {
              id: string;
              email?: string | null;
              name?: string | null;
            }, hookCtx?: GenericEndpointContext | null): Promise<void>;
          };
        };
        organization: {
          create: {
            after(org: {
              id: string;
              name: string;
              email?: string | null;
            }, hookCtx: GenericEndpointContext | null): Promise<void>;
          };
        } | undefined;
      };
      member: {
        create: {
          before: (member: {
            organizationId: string;
          }, ctx: GenericEndpointContext | null | undefined) => Promise<void>;
          after: (member: {
            organizationId: string | undefined;
          }, ctx: GenericEndpointContext | null | undefined) => Promise<void>;
        };
        delete: {
          after: (member: {
            organizationId: string | undefined;
          }, ctx: GenericEndpointContext | null | undefined) => Promise<void>;
        };
      };
      invitation: {
        create: {
          before: (invitation: {
            organizationId: string;
          }, ctx: GenericEndpointContext | null | undefined) => Promise<void>;
          after: (invitation: {
            organizationId: string | undefined;
          }, ctx: GenericEndpointContext | null | undefined) => Promise<void>;
        };
        delete: {
          after: (invitation: {
            organizationId: string | undefined;
          }, ctx: GenericEndpointContext | null | undefined) => Promise<void>;
        };
      };
      team: {
        create: {
          before: (team: {
            organizationId: string;
          }, ctx: GenericEndpointContext | null | undefined) => Promise<void>;
        };
      };
    };
  };
  $ERROR_CODES: Record<string, RawError<string>>;
  options: NoInfer<O>;
};
type PaystackPlugin<TPaystackClient extends PaystackClientLike = PaystackClientLike, O extends PaystackOptions<TPaystackClient> = PaystackOptions<TPaystackClient>> = ReturnType<typeof paystack<TPaystackClient, O>>;
//#endregion
export { syncPaystackProducts as a, PaystackOptions as c, PaystackTransaction as d, Subscription as f, syncPaystackPlans as i, PaystackPlan as l, paystack as n, AnyPaystackOptions as o, SubscriptionOptions as p, chargeSubscriptionRenewal as r, PaystackClientLike as s, PaystackPlugin as t, PaystackProduct as u };
//# sourceMappingURL=index-Dwbeddkr.d.mts.map