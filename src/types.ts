import type {
    GenericEndpointContext,
    InferOptionSchema,
    Session,
    User,
} from "better-auth";
import type { createPaystack } from "@alexasomba/paystack-node";
import type { subscriptions, user } from "./schema";

export type PaystackNodeClient = ReturnType<typeof createPaystack>;

export type PaystackOpenApiFetchResponse<T = unknown> = {
    data?: T;
    error?: unknown;
    response?: Response;
};

export type PaystackApiResult<T = unknown> = Promise<T | PaystackOpenApiFetchResponse<T>>;

export type PaystackClientLike = {
    // Preferred (createPaystack) flat operations
    customer_create?: (init?: { body?: any } | undefined) => PaystackApiResult<any>;
    transaction_initialize?: (init?: { body?: any } | undefined) => PaystackApiResult<any>;
    transaction_verify?: (init: { params: { path: { reference: string } } }) => PaystackApiResult<any>;
    // `subscription_fetch` can accept either `{ params: { path: { code: string } } }`
    // (used by some SDKs) or `{ params: { path: { id_or_code: string } } }`
    // (used by others). Accept either shape for compatibility with both.
    // `subscription_fetch` init types vary across SDK generators (FetchOptions, etc).
    // Keep it permissive here and normalize in `getPaystackOps().subscriptionFetch()`.
    subscription_fetch?: (init: any) => PaystackApiResult<any>;
    subscription_disable?: (init?: { body?: { code: string; token: string } } | undefined) => PaystackApiResult<any>;
    subscription_enable?: (init?: { body?: { code: string; token: string } } | undefined) => PaystackApiResult<any>;
    subscription_manage_link?: (init: { params: { path: { code: string } } }) => PaystackApiResult<any>;

    // Legacy nested style support (kept for compatibility)
    customer?: {
        create?: (params: any) => Promise<any>;
    };
    transaction?: {
        initialize?: (params: any) => Promise<any>;
        verify?: (reference: string) => Promise<any>;
    };
    subscription?: {
        fetch?: (idOrCode: string) => Promise<any>;
        disable?: (params: any) => Promise<any>;
        enable?: (params: any) => Promise<any>;
        manage?: {
            link?: (code: string) => Promise<any>;
        };
    };
};

type NoInfer<T> = [T][T extends any ? 0 : never];

export type AuthSession = {
    user: User;
    session: Session;
} & Record<string, any>;

export type PaystackPlan = {
    /** Human name stored in DB (lowercased). */
    name: string;
    /** Paystack plan code (if you use Paystack plans). */
    planCode?: string | undefined;
    /** Amount in the smallest currency unit (e.g. kobo). */
    amount?: number | undefined;
    /** Currency ISO code (e.g. NGN). */
    currency?: string | undefined;
    /** Paystack interval keyword (when using Paystack plans). */
    interval?:
    | "daily"
    | "weekly"
    | "monthly"
    | "quarterly"
    | "biannually"
    | "annually"
    | undefined;
    /** Optional invoice limit; Paystack uses `invoice_limit` during init. */
    invoiceLimit?: number | undefined;
    /** Arbitrary limits (stored/consumed by your app). */
    limits?: Record<string, unknown> | undefined;
    /** Optional free trial config, if your app supports it. */
    freeTrial?:
    | {
        days: number;
    }
    | undefined;
};

export interface Subscription {
    id: string;
    plan: string;
    referenceId: string;
    paystackCustomerCode?: string | undefined;
    paystackSubscriptionCode?: string | undefined;
    paystackTransactionReference?: string | undefined;
    status:
    | "active"
    | "canceled"
    | "incomplete"
    | "incomplete_expired"
    | "paused"
    | "trialing"
    | "unpaid";
    periodStart?: Date | undefined;
    periodEnd?: Date | undefined;
    trialStart?: Date | undefined;
    trialEnd?: Date | undefined;
    cancelAtPeriodEnd?: boolean | undefined;
    groupId?: string | undefined;
    seats?: number | undefined;
}

export type SubscriptionOptions = {
    plans: PaystackPlan[] | (() => PaystackPlan[] | Promise<PaystackPlan[]>);
    requireEmailVerification?: boolean | undefined;
    authorizeReference?:
    | ((
        data: {
            user: User;
            session: AuthSession;
            referenceId: string;
            action:
            | "initialize-transaction"
            | "verify-transaction"
            | "list-subscriptions"
            | "disable-subscription"
            | "enable-subscription";
        },
        ctx: GenericEndpointContext,
    ) => Promise<boolean>)
    | undefined;
    onSubscriptionComplete?:
    | ((
        data: {
            event: any;
            subscription: Subscription;
            plan: PaystackPlan;
        },
        ctx: GenericEndpointContext,
    ) => Promise<void>)
    | undefined;
    onSubscriptionUpdate?:
    | ((
        data: {
            event: any;
            subscription: Subscription;
        },
        ctx: GenericEndpointContext,
    ) => Promise<void>)
    | undefined;
    onSubscriptionDelete?:
    | ((
        data: {
            event: any;
            subscription: Subscription;
        },
        ctx: GenericEndpointContext,
    ) => Promise<void>)
    | undefined;
};

export interface PaystackOptions<
    TPaystackClient extends PaystackClientLike = PaystackNodeClient,
> {
    /** Paystack SDK instance (recommended: `@alexasomba/paystack-node` via `createPaystack({ secretKey })`). */
    paystackClient: NoInfer<TPaystackClient>;
    /** Paystack webhook secret used to verify `x-paystack-signature`. */
    paystackWebhookSecret: string;
    /** Enable customer creation on Better Auth sign up. */
    createCustomerOnSignUp?: boolean | undefined;
    onCustomerCreate?:
    | ((
        data: {
            paystackCustomer: any;
            user: User & { paystackCustomerCode: string };
        },
        ctx: GenericEndpointContext,
    ) => Promise<void>)
    | undefined;
    getCustomerCreateParams?:
    | ((user: User, ctx: GenericEndpointContext) => Promise<Record<string, any>>)
    | undefined;
    subscription?:
    | (
        | {
            enabled: false;
        }
        | ({
            enabled: true;
        } & SubscriptionOptions)
    )
    | undefined;
    onEvent?: ((event: any) => Promise<void>) | undefined;
    schema?: InferOptionSchema<typeof subscriptions & typeof user> | undefined;
}

export interface InputSubscription extends Omit<Subscription, "id"> { }
