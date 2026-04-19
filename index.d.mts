import { a as PaystackOptions, c as PaystackSyncResult, d as Subscription, f as SubscriptionOptions, i as PaystackClientLike, l as PaystackTransaction, n as ChargeRecurringSubscriptionInput, o as PaystackPlan, r as ChargeRecurringSubscriptionResult, s as PaystackProduct, t as AnyPaystackOptions } from "./types-B5ZnlFrq.mjs";
import { AuthContext, BetterAuthPluginDBSchema, GenericEndpointContext, MiddlewareInputContext, MiddlewareOptions, RawError, StrictEndpoint, ZodBoolean, ZodNumber, ZodObject, ZodOptional, ZodRecord, ZodString, ZodUnknown } from "better-auth";
import { $strip } from "zod/v4/core";

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
export { type ChargeRecurringSubscriptionResult, type PaystackClientLike, type PaystackOptions, type PaystackPlan, PaystackPlugin, type PaystackProduct, type PaystackSyncResult, type Subscription, type SubscriptionOptions, chargeSubscriptionRenewal, paystack, syncPaystackPlans, syncPaystackProducts };
//# sourceMappingURL=index.d.mts.map