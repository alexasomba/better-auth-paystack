import type { GenericEndpointContext } from "better-auth";
import type { PaystackNodeClient, PaystackClientLike, PaystackOptions, PaystackPlan, Subscription, SubscriptionOptions } from "./types";
export declare const paystack: <TPaystackClient extends PaystackClientLike = PaystackNodeClient, O extends PaystackOptions<TPaystackClient> = PaystackOptions<TPaystackClient>>(options: O) => {
    id: "paystack";
    endpoints: O extends {
        subscription: {
            enabled: true;
        };
    } ? {
        initializeTransaction: import("better-call").StrictEndpoint<"/paystack/transaction/initialize", {
            method: "POST";
            body: import("zod").ZodObject<{
                plan: import("zod").ZodString;
                referenceId: import("zod").ZodOptional<import("zod").ZodString>;
                callbackURL: import("zod").ZodOptional<import("zod").ZodString>;
            }, import("better-auth").$strip>;
            use: (((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
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
        verifyTransaction: import("better-call").StrictEndpoint<"/paystack/transaction/verify", {
            method: "POST";
            body: import("zod").ZodObject<{
                reference: import("zod").ZodString;
            }, import("better-auth").$strip>;
            use: (((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
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
        listSubscriptions: import("better-call").StrictEndpoint<"/paystack/subscription/list-local", {
            method: "GET";
            query: import("zod").ZodObject<{
                referenceId: import("zod").ZodOptional<import("zod").ZodString>;
            }, import("better-auth").$strip>;
            use: (((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
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
        disablePaystackSubscription: import("better-call").StrictEndpoint<"/paystack/subscription/disable", {
            method: "POST";
            body: import("zod").ZodObject<{
                referenceId: import("zod").ZodOptional<import("zod").ZodString>;
                subscriptionCode: import("zod").ZodString;
                emailToken: import("zod").ZodOptional<import("zod").ZodString>;
            }, import("better-auth").$strip>;
            use: (((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
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
        enablePaystackSubscription: import("better-call").StrictEndpoint<"/paystack/subscription/enable", {
            method: "POST";
            body: import("zod").ZodObject<{
                referenceId: import("zod").ZodOptional<import("zod").ZodString>;
                subscriptionCode: import("zod").ZodString;
                emailToken: import("zod").ZodOptional<import("zod").ZodString>;
            }, import("better-auth").$strip>;
            use: (((inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
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
        paystackWebhook: import("better-call").StrictEndpoint<"/paystack/webhook", {
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
    } : {
        paystackWebhook: import("better-call").StrictEndpoint<"/paystack/webhook", {
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
    };
    init(ctx: import("better-auth").AuthContext): {
        options: {
            databaseHooks: {
                user: {
                    create: {
                        after(user: {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            email: string;
                            emailVerified: boolean;
                            name: string;
                            image?: string | null | undefined;
                        } & Record<string, unknown>, hookCtx?: GenericEndpointContext | null): Promise<void>;
                    };
                };
            };
        };
    };
    schema: import("@better-auth/core/db").BetterAuthPluginDBSchema;
    $ERROR_CODES: {
        readonly SUBSCRIPTION_NOT_FOUND: "Subscription not found";
        readonly SUBSCRIPTION_PLAN_NOT_FOUND: "Subscription plan not found";
        readonly UNABLE_TO_CREATE_CUSTOMER: "Unable to create customer";
        readonly FAILED_TO_INITIALIZE_TRANSACTION: "Failed to initialize transaction";
        readonly FAILED_TO_VERIFY_TRANSACTION: "Failed to verify transaction";
        readonly FAILED_TO_DISABLE_SUBSCRIPTION: "Failed to disable subscription";
        readonly FAILED_TO_ENABLE_SUBSCRIPTION: "Failed to enable subscription";
        readonly EMAIL_VERIFICATION_REQUIRED: "Email verification is required before you can subscribe to a plan";
    };
};
type PaystackClientFromOptions<O extends PaystackOptions<any>> = O extends PaystackOptions<infer TClient> ? TClient : PaystackNodeClient;
export type PaystackPlugin<O extends PaystackOptions<any> = PaystackOptions> = ReturnType<typeof paystack<PaystackClientFromOptions<O>, O>>;
export type { Subscription, SubscriptionOptions, PaystackPlan, PaystackOptions };
//# sourceMappingURL=index.d.ts.map