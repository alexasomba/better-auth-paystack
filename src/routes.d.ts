import type { GenericEndpointContext } from "better-auth";
import * as z from "zod/v4";
import type { PaystackOptions, Subscription } from "./types";
type AnyPaystackOptions = PaystackOptions<any>;
declare const PAYSTACK_ERROR_CODES: {
    readonly SUBSCRIPTION_NOT_FOUND: "Subscription not found";
    readonly SUBSCRIPTION_PLAN_NOT_FOUND: "Subscription plan not found";
    readonly UNABLE_TO_CREATE_CUSTOMER: "Unable to create customer";
    readonly FAILED_TO_INITIALIZE_TRANSACTION: "Failed to initialize transaction";
    readonly FAILED_TO_VERIFY_TRANSACTION: "Failed to verify transaction";
    readonly FAILED_TO_DISABLE_SUBSCRIPTION: "Failed to disable subscription";
    readonly FAILED_TO_ENABLE_SUBSCRIPTION: "Failed to enable subscription";
    readonly EMAIL_VERIFICATION_REQUIRED: "Email verification is required before you can subscribe to a plan";
};
export declare const paystackWebhook: (options: AnyPaystackOptions) => import("better-auth").StrictEndpoint<"/paystack/webhook", {
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
export declare const initializeTransaction: (options: AnyPaystackOptions) => import("better-auth").StrictEndpoint<"/paystack/transaction/initialize", {
    method: "POST";
    body: z.ZodObject<{
        plan: z.ZodString;
        referenceId: z.ZodOptional<z.ZodString>;
        callbackURL: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    use: (((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
        context: {
            referenceId: any;
        };
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
}, {
    url: string | undefined;
    reference: string | undefined;
    accessCode: string | undefined;
    redirect: boolean;
}>;
export declare const verifyTransaction: (options: AnyPaystackOptions) => import("better-auth").StrictEndpoint<"/paystack/transaction/verify", {
    method: "POST";
    body: z.ZodObject<{
        reference: z.ZodString;
    }, z.core.$strip>;
    use: (((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
        context: {
            referenceId: any;
        };
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
}, {
    status: any;
    reference: any;
    data: any;
}>;
export declare const listSubscriptions: (options: AnyPaystackOptions) => import("better-auth").StrictEndpoint<"/paystack/subscription/list-local", {
    method: "GET";
    query: z.ZodObject<{
        referenceId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    use: (((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
        context: {
            referenceId: any;
        };
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
}, {
    subscriptions: Subscription[];
}>;
export declare const disablePaystackSubscription: (options: AnyPaystackOptions) => import("better-auth").StrictEndpoint<"/paystack/subscription/disable", {
    method: "POST";
    body: z.ZodObject<{
        referenceId: z.ZodOptional<z.ZodString>;
        subscriptionCode: z.ZodString;
        emailToken: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    use: (((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
        context: {
            referenceId: any;
        };
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
}, {
    result: any;
}>;
export declare const enablePaystackSubscription: (options: AnyPaystackOptions) => import("better-auth").StrictEndpoint<"/paystack/subscription/enable", {
    method: "POST";
    body: z.ZodObject<{
        referenceId: z.ZodOptional<z.ZodString>;
        subscriptionCode: z.ZodString;
        emailToken: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    use: (((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
        context: {
            referenceId: any;
        };
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
}, {
    result: any;
}>;
export { PAYSTACK_ERROR_CODES };
//# sourceMappingURL=routes.d.ts.map