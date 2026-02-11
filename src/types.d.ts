import type { GenericEndpointContext, InferOptionSchema, Session, User } from "better-auth";
import type { createPaystack } from "@alexasomba/paystack-node";
import type { organization, subscriptions, user } from "./schema";
export type { GenericEndpointContext, InferOptionSchema, Session, User, };
export type PaystackNodeClient = ReturnType<typeof createPaystack>;
export interface PaystackOpenApiFetchResponse<T = unknown> {
    data?: T;
    error?: unknown;
    response?: Response;
}
export type PaystackApiResult<T = unknown> = Promise<T | PaystackOpenApiFetchResponse<T>>;
type NonNullableInit<T> = Exclude<T, undefined>;
type ExtractBody<T> = T extends {
    body?: infer B;
} ? B : never;
type WithMetadataStringOrObject<T> = T extends object ? Omit<T, "metadata"> & {
    metadata?: string | Record<string, unknown>;
} : T;
type WithMetadataObject<T> = T extends object ? Omit<T, "metadata"> & {
    metadata?: Record<string, unknown>;
} : T;
type WithEmail<T> = T extends object ? Omit<T, "email"> & {
    email?: string;
} : T;
type CustomerCreateInit = NonNullableInit<Parameters<PaystackNodeClient["customer_create"]>[0]>;
type CustomerUpdateInit = NonNullableInit<Parameters<PaystackNodeClient["customer_update"]>[0]>;
type TransactionInitializeInit = NonNullableInit<Parameters<PaystackNodeClient["transaction_initialize"]>[0]>;
type SubscriptionCreateInit = NonNullableInit<Parameters<PaystackNodeClient["subscription_create"]>[0]>;
type SubscriptionToggleInit = NonNullableInit<Parameters<PaystackNodeClient["subscription_disable"]>[0]>;
type TransactionChargeAuthorizationInit = NonNullableInit<Parameters<PaystackNodeClient["transaction_chargeAuthorization"]>[0]>;
export type PaystackCustomerCreateInput = WithMetadataStringOrObject<ExtractBody<CustomerCreateInit>>;
export type PaystackCustomerUpdateInput = WithMetadataStringOrObject<WithEmail<ExtractBody<CustomerUpdateInit>>>;
export type PaystackTransactionInitializeInput = WithMetadataObject<ExtractBody<TransactionInitializeInit>>;
export type PaystackTransactionChargeAuthorizationInput = WithMetadataObject<ExtractBody<TransactionChargeAuthorizationInit>>;
export type PaystackSubscriptionCreateInput = ExtractBody<SubscriptionCreateInit>;
export type PaystackSubscriptionToggleInput = ExtractBody<SubscriptionToggleInit>;
export type PaystackSubscriptionFetchInit = {
    params: {
        path: {
            code: string;
        };
    };
} | {
    params: {
        path: {
            id_or_code: string;
        };
    };
};
export type PaystackClientLike = Partial<PaystackNodeClient> & {
    subscription_manage_link?: PaystackNodeClient["subscription_manageLink"];
    customer?: {
        create?: (params: PaystackCustomerCreateInput) => Promise<unknown>;
        update?: (code: string, params: PaystackCustomerUpdateInput) => Promise<unknown>;
    };
    transaction?: {
        initialize?: (params: PaystackTransactionInitializeInput) => Promise<unknown>;
        verify?: (reference: string) => Promise<unknown>;
        chargeAuthorization?: (params: PaystackTransactionChargeAuthorizationInput) => Promise<unknown>;
    };
    subscription?: {
        fetch?: (idOrCode: string) => Promise<unknown>;
        create?: (params: PaystackSubscriptionCreateInput) => Promise<unknown>;
        disable?: (params: PaystackSubscriptionToggleInput) => Promise<unknown>;
        enable?: (params: PaystackSubscriptionToggleInput) => Promise<unknown>;
        manage?: {
            link?: (code: string) => Promise<unknown>;
            email?: (code: string, email: string) => Promise<unknown>;
        };
    };
};
type NoInfer<T> = [T][T extends unknown ? 0 : never];
export type AuthSession = {
    user: User;
    session: Session;
} & Record<string, unknown>;
export interface PaystackPlan {
    /** Human name stored in DB (lowercased). */
    name: string;
    /** Paystack plan code (if you use Paystack plans). */
    planCode?: string | undefined;
    /** Amount in the smallest currency unit (e.g. kobo). */
    amount?: number | undefined;
    /** Currency ISO code (e.g. NGN). */
    currency?: string | undefined;
    /** Paystack interval keyword (when using Paystack plans). */
    interval?: "daily" | "weekly" | "monthly" | "quarterly" | "biannually" | "annually" | undefined;
    /** Optional description of the plan. */
    description?: string | undefined;
    /** Optional list of features for the plan. */
    features?: string[] | undefined;
    /** Optional invoice limit; Paystack uses `invoice_limit` during init. */
    invoiceLimit?: number | undefined;
    /** Arbitrary limits (stored/consumed by your app). */
    limits?: Record<string, unknown> | undefined;
    /** Optional free trial config, if your app supports it. */
    freeTrial?: {
        days: number;
        onTrialStart?: (subscription: Subscription) => Promise<void>;
        onTrialEnd?: (data: {
            subscription: Subscription;
        }, ctx: GenericEndpointContext) => Promise<void>;
        onTrialExpired?: (subscription: Subscription, ctx: GenericEndpointContext) => Promise<void>;
    } | undefined;
}
export interface PaystackProduct {
    /** Human-readable name of the product. */
    name: string;
    /** Amount in the smallest currency unit (e.g., kobo). */
    amount: number;
    /** Currency ISO code (e.g., NGN). */
    currency: string;
    /** Optional metadata to include with the transaction. */
    metadata?: Record<string, unknown> | undefined;
    /** Optional description of the product. */
    description?: string | undefined;
    /** Optional list of features for the product. */
    features?: string[] | undefined;
}
export interface PaystackTransaction {
    id: string;
    reference: string;
    paystackId?: string | undefined;
    referenceId: string;
    userId: string;
    amount: number;
    currency: string;
    status: string;
    plan?: string | undefined;
    metadata?: string | undefined;
    createdAt: Date;
    updatedAt: Date;
}
export interface InputPaystackTransaction extends Omit<PaystackTransaction, "id"> {
}
export interface Subscription {
    id: string;
    plan: string;
    referenceId: string;
    paystackCustomerCode?: string | undefined;
    paystackSubscriptionCode?: string | undefined;
    paystackTransactionReference?: string | undefined;
    paystackAuthorizationCode?: string | undefined;
    paystackEmailToken?: string | undefined;
    status: "active" | "canceled" | "incomplete" | "incomplete_expired" | "paused" | "trialing" | "unpaid";
    periodStart?: Date | undefined;
    periodEnd?: Date | undefined;
    trialStart?: Date | undefined;
    trialEnd?: Date | undefined;
    cancelAtPeriodEnd?: boolean | undefined;
    groupId?: string | undefined;
    seats?: number | undefined;
}
export interface InputSubscription extends Omit<Subscription, "id"> {
}
export interface SubscriptionOptions {
    plans: PaystackPlan[] | (() => PaystackPlan[] | Promise<PaystackPlan[]>);
    requireEmailVerification?: boolean | undefined;
    authorizeReference?: ((data: {
        user: User;
        session: Session;
        referenceId: string;
        action: "initialize-transaction" | "verify-transaction" | "list-subscriptions" | "list-transactions" | "disable-subscription" | "enable-subscription" | "get-subscription-manage-link";
    }, ctx: GenericEndpointContext) => Promise<boolean>) | undefined;
    onSubscriptionComplete?: ((data: {
        event: unknown;
        subscription: Subscription;
        plan: PaystackPlan;
    }, ctx: GenericEndpointContext) => Promise<void>) | undefined;
    onSubscriptionUpdate?: ((data: {
        event: unknown;
        subscription: Subscription;
        plan?: PaystackPlan;
    }, ctx: GenericEndpointContext) => Promise<void>) | undefined;
    onSubscriptionCreated?: ((data: {
        event: unknown;
        subscription: Subscription;
        plan: PaystackPlan;
    }, ctx: GenericEndpointContext) => Promise<void>) | undefined;
    onSubscriptionCancel?: ((data: {
        event: unknown;
        subscription: Subscription;
    }, ctx: GenericEndpointContext) => Promise<void>) | undefined;
    onSubscriptionDelete?: ((data: {
        event: unknown;
        subscription: Subscription;
    }, ctx: GenericEndpointContext) => Promise<void>) | undefined;
}
export interface ProductOptions {
    products: PaystackProduct[] | (() => PaystackProduct[] | Promise<PaystackProduct[]>);
}
export interface OrganizationOptions {
    enabled: boolean;
    createCustomerOnOrganizationCreate?: boolean | undefined;
    onCustomerCreate?: ((data: {
        paystackCustomer: Record<string, unknown>;
        organization: Record<string, unknown> & {
            paystackCustomerCode: string;
        };
    }, ctx: GenericEndpointContext) => Promise<void>) | undefined;
    getCustomerCreateParams?: ((organization: unknown, ctx: GenericEndpointContext) => Promise<Record<string, unknown>>) | undefined;
}
export interface PaystackOptions<TPaystackClient extends PaystackClientLike = PaystackNodeClient> {
    /** Paystack SDK instance (recommended: `@alexasomba/paystack-node` via `createPaystack({ secretKey })`). */
    paystackClient: NoInfer<TPaystackClient>;
    /** Paystack webhook secret used to verify `x-paystack-signature`. */
    paystackWebhookSecret: string;
    /** Enable customer creation on Better Auth sign up. */
    createCustomerOnSignUp?: boolean | undefined;
    onCustomerCreate?: ((data: {
        paystackCustomer: Record<string, unknown>;
        user: User & {
            paystackCustomerCode: string;
        };
    }, ctx: GenericEndpointContext) => Promise<void>) | undefined;
    getCustomerCreateParams?: ((user: User, ctx: GenericEndpointContext) => Promise<Record<string, unknown>>) | undefined;
    subscription?: ({
        enabled: false;
    } | ({
        enabled: true;
    } & SubscriptionOptions)) | undefined;
    products?: ProductOptions | undefined;
    organization?: OrganizationOptions | undefined;
    onEvent?: ((event: unknown) => Promise<void>) | undefined;
    schema?: InferOptionSchema<typeof subscriptions & typeof user & typeof organization> | undefined;
}
export interface Organization {
    id: string;
    name: string;
    slug: string;
    paystackCustomerCode?: string | undefined;
    email?: string | undefined;
    createdAt: Date;
    updatedAt: Date;
    metadata?: unknown;
    [key: string]: unknown;
}
export interface Member {
    id: string;
    organizationId: string;
    userId: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
    [key: string]: unknown;
}
//# sourceMappingURL=types.d.ts.map