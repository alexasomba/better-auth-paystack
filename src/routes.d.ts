import * as z from "zod/v4";
import type { GenericEndpointContext } from "better-auth";
import type { PaystackOptions, PaystackClientLike } from "./types";
type AnyPaystackOptions = PaystackOptions<PaystackClientLike>;
declare const PAYSTACK_ERROR_CODES: {
    SUBSCRIPTION_NOT_FOUND: import("@better-auth/core/utils/error-codes").RawError<"SUBSCRIPTION_NOT_FOUND">;
    SUBSCRIPTION_PLAN_NOT_FOUND: import("@better-auth/core/utils/error-codes").RawError<"SUBSCRIPTION_PLAN_NOT_FOUND">;
    UNABLE_TO_CREATE_CUSTOMER: import("@better-auth/core/utils/error-codes").RawError<"UNABLE_TO_CREATE_CUSTOMER">;
    FAILED_TO_INITIALIZE_TRANSACTION: import("@better-auth/core/utils/error-codes").RawError<"FAILED_TO_INITIALIZE_TRANSACTION">;
    FAILED_TO_VERIFY_TRANSACTION: import("@better-auth/core/utils/error-codes").RawError<"FAILED_TO_VERIFY_TRANSACTION">;
    FAILED_TO_DISABLE_SUBSCRIPTION: import("@better-auth/core/utils/error-codes").RawError<"FAILED_TO_DISABLE_SUBSCRIPTION">;
    FAILED_TO_ENABLE_SUBSCRIPTION: import("@better-auth/core/utils/error-codes").RawError<"FAILED_TO_ENABLE_SUBSCRIPTION">;
    EMAIL_VERIFICATION_REQUIRED: import("@better-auth/core/utils/error-codes").RawError<"EMAIL_VERIFICATION_REQUIRED">;
};
export declare const paystackWebhook: (options: AnyPaystackOptions) => import("better-call").StrictEndpoint<"/paystack/webhook", {
    method: "POST";
    metadata: {
        openapi: {
            operationId: string;
        };
        scope: "server";
    };
    cloneRequest: true;
    disableBody: true;
}, any>;
export declare const initializeTransaction: <P extends string = "/paystack/initialize-transaction">(options: AnyPaystackOptions, path?: P) => import("better-call").StrictEndpoint<P, {
    method: "POST";
    body: z.ZodObject<{
        plan: z.ZodOptional<z.ZodString>;
        product: z.ZodOptional<z.ZodString>;
        amount: z.ZodOptional<z.ZodNumber>;
        currency: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        referenceId: z.ZodOptional<z.ZodString>;
        callbackURL: z.ZodOptional<z.ZodString>;
        quantity: z.ZodOptional<z.ZodNumber>;
        scheduleAtPeriodEnd: z.ZodOptional<z.ZodBoolean>;
        cancelAtPeriodEnd: z.ZodOptional<z.ZodBoolean>;
        prorateAndCharge: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>;
    use: (((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        referenceId: string;
    }>) | ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
        session: {
            session: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined;
                userAgent?: string | null | undefined;
            };
            user: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
            };
        };
    }>) | ((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<void>))[];
}, any>;
export declare const createSubscription: (options: AnyPaystackOptions) => import("better-call").StrictEndpoint<"/paystack/create-subscription", {
    method: "POST";
    body: z.ZodObject<{
        plan: z.ZodOptional<z.ZodString>;
        product: z.ZodOptional<z.ZodString>;
        amount: z.ZodOptional<z.ZodNumber>;
        currency: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        referenceId: z.ZodOptional<z.ZodString>;
        callbackURL: z.ZodOptional<z.ZodString>;
        quantity: z.ZodOptional<z.ZodNumber>;
        scheduleAtPeriodEnd: z.ZodOptional<z.ZodBoolean>;
        cancelAtPeriodEnd: z.ZodOptional<z.ZodBoolean>;
        prorateAndCharge: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>;
    use: (((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        referenceId: string;
    }>) | ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
        session: {
            session: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined;
                userAgent?: string | null | undefined;
            };
            user: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
            };
        };
    }>) | ((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<void>))[];
}, any>;
export declare const upgradeSubscription: (options: AnyPaystackOptions) => import("better-call").StrictEndpoint<"/paystack/upgrade-subscription", {
    method: "POST";
    body: z.ZodObject<{
        plan: z.ZodOptional<z.ZodString>;
        product: z.ZodOptional<z.ZodString>;
        amount: z.ZodOptional<z.ZodNumber>;
        currency: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        referenceId: z.ZodOptional<z.ZodString>;
        callbackURL: z.ZodOptional<z.ZodString>;
        quantity: z.ZodOptional<z.ZodNumber>;
        scheduleAtPeriodEnd: z.ZodOptional<z.ZodBoolean>;
        cancelAtPeriodEnd: z.ZodOptional<z.ZodBoolean>;
        prorateAndCharge: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>;
    use: (((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        referenceId: string;
    }>) | ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
        session: {
            session: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined;
                userAgent?: string | null | undefined;
            };
            user: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
            };
        };
    }>) | ((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<void>))[];
}, any>;
export declare const restoreSubscription: (options: AnyPaystackOptions) => import("better-call").StrictEndpoint<"/paystack/restore-subscription", {
    method: "POST";
    body: z.ZodObject<{
        referenceId: z.ZodOptional<z.ZodString>;
        subscriptionCode: z.ZodString;
        emailToken: z.ZodOptional<z.ZodString>;
        atPeriodEnd: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>;
    use: (((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        referenceId: string;
    }>) | ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
        session: {
            session: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined;
                userAgent?: string | null | undefined;
            };
            user: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
            };
        };
    }>) | ((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<void>))[];
}, any>;
export declare const cancelSubscription: (options: AnyPaystackOptions) => import("better-call").StrictEndpoint<"/paystack/cancel-subscription", {
    method: "POST";
    body: z.ZodObject<{
        referenceId: z.ZodOptional<z.ZodString>;
        subscriptionCode: z.ZodString;
        emailToken: z.ZodOptional<z.ZodString>;
        atPeriodEnd: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>;
    use: (((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        referenceId: string;
    }>) | ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
        session: {
            session: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined;
                userAgent?: string | null | undefined;
            };
            user: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
            };
        };
    }>) | ((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<void>))[];
}, any>;
export declare const verifyTransaction: <P extends string = "/paystack/verify-transaction">(options: AnyPaystackOptions, path?: P) => import("better-call").StrictEndpoint<P, {
    method: "POST";
    body: z.ZodObject<{
        reference: z.ZodString;
    }, z.core.$strip>;
    use: (((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        referenceId: string;
    }>) | ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
        session: {
            session: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined;
                userAgent?: string | null | undefined;
            };
            user: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
            };
        };
    }>) | ((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<void>))[];
}, any>;
export declare const listSubscriptions: (options: AnyPaystackOptions) => import("better-call").StrictEndpoint<"/paystack/list-subscriptions", {
    method: "GET";
    query: z.ZodObject<{
        referenceId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    use: (((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        referenceId: string;
    }>) | ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
        session: {
            session: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined;
                userAgent?: string | null | undefined;
            };
            user: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
            };
        };
    }>) | ((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<void>))[];
}, any>;
export declare const listTransactions: <P extends string = "/paystack/list-transactions">(options: AnyPaystackOptions, path?: P) => import("better-call").StrictEndpoint<P, {
    method: "GET";
    query: z.ZodObject<{
        referenceId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    use: (((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        referenceId: string;
    }>) | ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
        session: {
            session: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined;
                userAgent?: string | null | undefined;
            };
            user: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
            };
        };
    }>) | ((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<void>))[];
}, any>;
export declare const disablePaystackSubscription: <P extends string = "/paystack/disable-subscription">(options: AnyPaystackOptions, path?: P) => import("better-call").StrictEndpoint<P, {
    method: "POST";
    body: z.ZodObject<{
        referenceId: z.ZodOptional<z.ZodString>;
        subscriptionCode: z.ZodString;
        emailToken: z.ZodOptional<z.ZodString>;
        atPeriodEnd: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>;
    use: (((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        referenceId: string;
    }>) | ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
        session: {
            session: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined;
                userAgent?: string | null | undefined;
            };
            user: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
            };
        };
    }>) | ((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<void>))[];
}, any>;
export declare const enablePaystackSubscription: <P extends string = "/paystack/enable-subscription">(options: AnyPaystackOptions, path?: P) => import("better-call").StrictEndpoint<P, {
    method: "POST";
    body: z.ZodObject<{
        referenceId: z.ZodOptional<z.ZodString>;
        subscriptionCode: z.ZodString;
        emailToken: z.ZodOptional<z.ZodString>;
        atPeriodEnd: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>;
    use: (((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        referenceId: string;
    }>) | ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
        session: {
            session: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined;
                userAgent?: string | null | undefined;
            };
            user: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
            };
        };
    }>) | ((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<void>))[];
}, any>;
export declare const getSubscriptionManageLink: <P extends string = "/paystack/get-subscription-manage-link">(options: AnyPaystackOptions, path?: P) => import("better-call").StrictEndpoint<P, {
    method: "GET";
    query: z.ZodObject<{
        subscriptionCode: z.ZodString;
    }, z.core.$strip>;
    use: (((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
        referenceId: string;
    }>) | ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
        session: {
            session: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined;
                userAgent?: string | null | undefined;
            };
            user: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
            };
        };
    }>) | ((getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<void>))[];
}, any>;
export declare const syncProducts: (options: AnyPaystackOptions) => import("better-call").StrictEndpoint<"/paystack/sync-products", {
    method: "POST";
    metadata: {
        scope: "server";
    };
    disableBody: true;
    use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
        session: {
            session: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined;
                userAgent?: string | null | undefined;
            };
            user: Record<string, any> & {
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
}, any>;
export declare const listProducts: (_options: AnyPaystackOptions) => import("better-call").StrictEndpoint<"/paystack/list-products", {
    method: "GET";
    metadata: {
        openapi: {
            operationId: string;
        };
    };
}, any>;
export declare const syncPlans: (options: AnyPaystackOptions) => import("better-call").StrictEndpoint<"/paystack/sync-plans", {
    method: "POST";
    metadata: {
        scope: "server";
    };
    disableBody: true;
    use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
        session: {
            session: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined;
                userAgent?: string | null | undefined;
            };
            user: Record<string, any> & {
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
}, any>;
export declare const listPlans: (_options: AnyPaystackOptions) => import("better-call").StrictEndpoint<"/paystack/list-plans", {
    method: "GET";
    metadata: {
        scope: "server";
    };
    use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
        session: {
            session: Record<string, any> & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined;
                userAgent?: string | null | undefined;
            };
            user: Record<string, any> & {
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
}, any>;
export declare const getConfig: (options: AnyPaystackOptions) => import("better-call").StrictEndpoint<"/paystack/get-config", {
    method: "GET";
    metadata: {
        openapi: {
            operationId: string;
        };
    };
}, any>;
export { PAYSTACK_ERROR_CODES };
export declare const chargeRecurringSubscription: (options: AnyPaystackOptions) => import("better-call").StrictEndpoint<"/paystack/charge-recurring", {
    method: "POST";
    body: z.ZodObject<{
        subscriptionId: z.ZodString;
        amount: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
}, any>;
//# sourceMappingURL=routes.d.ts.map