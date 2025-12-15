import type { GenericEndpointContext, InferOptionSchema, Session, User } from "better-auth";
import type { subscriptions, user } from "./schema";
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
    /** Arbitrary limits (stored/consumed by your app). */
    limits?: Record<string, unknown> | undefined;
    /** Optional free trial config, if your app supports it. */
    freeTrial?: {
        days: number;
    } | undefined;
};
export interface Subscription {
    id: string;
    plan: string;
    referenceId: string;
    paystackCustomerCode?: string | undefined;
    paystackSubscriptionCode?: string | undefined;
    paystackTransactionReference?: string | undefined;
    status: "active" | "canceled" | "incomplete" | "incomplete_expired" | "paused" | "trialing" | "unpaid";
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
    authorizeReference?: ((data: {
        user: User;
        session: AuthSession;
        referenceId: string;
        action: "initialize-transaction" | "verify-transaction" | "list-subscriptions" | "disable-subscription" | "enable-subscription";
    }, ctx: GenericEndpointContext) => Promise<boolean>) | undefined;
    onSubscriptionComplete?: ((data: {
        event: any;
        subscription: Subscription;
        plan: PaystackPlan;
    }, ctx: GenericEndpointContext) => Promise<void>) | undefined;
    onSubscriptionUpdate?: ((data: {
        event: any;
        subscription: Subscription;
    }, ctx: GenericEndpointContext) => Promise<void>) | undefined;
    onSubscriptionDelete?: ((data: {
        event: any;
        subscription: Subscription;
    }, ctx: GenericEndpointContext) => Promise<void>) | undefined;
};
export interface PaystackOptions {
    /** Paystack SDK instance (recommended: `@alexasomba/paystack-node`). */
    paystackClient: any;
    /** Paystack webhook secret used to verify `x-paystack-signature`. */
    paystackWebhookSecret: string;
    /** Enable customer creation on Better Auth sign up. */
    createCustomerOnSignUp?: boolean | undefined;
    onCustomerCreate?: ((data: {
        paystackCustomer: any;
        user: User & {
            paystackCustomerCode: string;
        };
    }, ctx: GenericEndpointContext) => Promise<void>) | undefined;
    getCustomerCreateParams?: ((user: User, ctx: GenericEndpointContext) => Promise<Record<string, any>>) | undefined;
    subscription?: ({
        enabled: false;
    } | ({
        enabled: true;
    } & SubscriptionOptions)) | undefined;
    onEvent?: ((event: any) => Promise<void>) | undefined;
    schema?: InferOptionSchema<typeof subscriptions & typeof user> | undefined;
}
export interface InputSubscription extends Omit<Subscription, "id"> {
}
//# sourceMappingURL=types.d.ts.map