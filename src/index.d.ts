import type { AuthContext, GenericEndpointContext } from "better-auth";
import type { PaystackNodeClient, PaystackClientLike, PaystackOptions, PaystackPlan, Subscription, SubscriptionOptions, PaystackProduct } from "./types";
export declare const paystack: <TPaystackClient extends PaystackClientLike = PaystackNodeClient, TMetadata = Record<string, unknown>, TLimits = Record<string, unknown>, O extends PaystackOptions<TPaystackClient, TMetadata, TLimits> = PaystackOptions<TPaystackClient, TMetadata, TLimits>>(options: O) => {
    id: string;
    endpoints: {
        initializeTransaction: import("better-call").StrictEndpoint<"/paystack/initialize-transaction", {
            method: "POST";
            body: import("zod").ZodObject<{
                plan: import("zod").ZodOptional<import("zod").ZodString>;
                product: import("zod").ZodOptional<import("zod").ZodString>;
                amount: import("zod").ZodOptional<import("zod").ZodNumber>;
                currency: import("zod").ZodOptional<import("zod").ZodString>;
                email: import("zod").ZodOptional<import("zod").ZodString>;
                metadata: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>>;
                referenceId: import("zod").ZodOptional<import("zod").ZodString>;
                callbackURL: import("zod").ZodOptional<import("zod").ZodString>;
                quantity: import("zod").ZodOptional<import("zod").ZodNumber>;
            }, import("better-auth").$strip>;
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
        verifyTransaction: import("better-call").StrictEndpoint<"/paystack/verify-transaction", {
            method: "POST";
            body: import("zod").ZodObject<{
                reference: import("zod").ZodString;
            }, import("better-auth").$strip>;
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
        listSubscriptions: import("better-call").StrictEndpoint<"/paystack/list-subscriptions", {
            method: "GET";
            query: import("zod").ZodObject<{
                referenceId: import("zod").ZodOptional<import("zod").ZodString>;
            }, import("better-auth").$strip>;
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
        }, any>;
        listTransactions: import("better-call").StrictEndpoint<"/paystack/list-transactions", {
            method: "GET";
            query: import("zod").ZodObject<{
                referenceId: import("zod").ZodOptional<import("zod").ZodString>;
            }, import("better-auth").$strip>;
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
        getConfig: import("better-call").StrictEndpoint<"/paystack/get-config", {
            method: "GET";
            metadata: {
                openapi: {
                    operationId: string;
                };
            };
        }, any>;
        disableSubscription: import("better-call").StrictEndpoint<"/paystack/disable-subscription", {
            method: "POST";
            body: import("zod").ZodObject<{
                referenceId: import("zod").ZodOptional<import("zod").ZodString>;
                subscriptionCode: import("zod").ZodString;
                emailToken: import("zod").ZodOptional<import("zod").ZodString>;
            }, import("better-auth").$strip>;
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
        enableSubscription: import("better-call").StrictEndpoint<"/paystack/enable-subscription", {
            method: "POST";
            body: import("zod").ZodObject<{
                referenceId: import("zod").ZodOptional<import("zod").ZodString>;
                subscriptionCode: import("zod").ZodString;
                emailToken: import("zod").ZodOptional<import("zod").ZodString>;
            }, import("better-auth").$strip>;
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
        getSubscriptionManageLink: import("better-call").StrictEndpoint<"/paystack/get-subscription-manage-link", {
            method: "GET";
            query: import("zod").ZodObject<{
                subscriptionCode: import("zod").ZodString;
            }, import("better-auth").$strip>;
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
        subscriptionManageLink: import("better-call").StrictEndpoint<"/paystack/subscription/manage-link", {
            method: "GET";
            query: import("zod").ZodObject<{
                subscriptionCode: import("zod").ZodString;
            }, import("better-auth").$strip>;
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
        createSubscription: import("better-call").StrictEndpoint<"/paystack/create-subscription", {
            method: "POST";
            body: import("zod").ZodObject<{
                plan: import("zod").ZodOptional<import("zod").ZodString>;
                product: import("zod").ZodOptional<import("zod").ZodString>;
                amount: import("zod").ZodOptional<import("zod").ZodNumber>;
                currency: import("zod").ZodOptional<import("zod").ZodString>;
                email: import("zod").ZodOptional<import("zod").ZodString>;
                metadata: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>>;
                referenceId: import("zod").ZodOptional<import("zod").ZodString>;
                callbackURL: import("zod").ZodOptional<import("zod").ZodString>;
                quantity: import("zod").ZodOptional<import("zod").ZodNumber>;
            }, import("better-auth").$strip>;
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
        upgradeSubscription: import("better-call").StrictEndpoint<"/paystack/upgrade-subscription", {
            method: "POST";
            body: import("zod").ZodObject<{
                plan: import("zod").ZodOptional<import("zod").ZodString>;
                product: import("zod").ZodOptional<import("zod").ZodString>;
                amount: import("zod").ZodOptional<import("zod").ZodNumber>;
                currency: import("zod").ZodOptional<import("zod").ZodString>;
                email: import("zod").ZodOptional<import("zod").ZodString>;
                metadata: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>>;
                referenceId: import("zod").ZodOptional<import("zod").ZodString>;
                callbackURL: import("zod").ZodOptional<import("zod").ZodString>;
                quantity: import("zod").ZodOptional<import("zod").ZodNumber>;
            }, import("better-auth").$strip>;
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
        cancelSubscription: import("better-call").StrictEndpoint<"/paystack/cancel-subscription", {
            method: "POST";
            body: import("zod").ZodObject<{
                referenceId: import("zod").ZodOptional<import("zod").ZodString>;
                subscriptionCode: import("zod").ZodString;
                emailToken: import("zod").ZodOptional<import("zod").ZodString>;
            }, import("better-auth").$strip>;
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
        restoreSubscription: import("better-call").StrictEndpoint<"/paystack/restore-subscription", {
            method: "POST";
            body: import("zod").ZodObject<{
                referenceId: import("zod").ZodOptional<import("zod").ZodString>;
                subscriptionCode: import("zod").ZodString;
                emailToken: import("zod").ZodOptional<import("zod").ZodString>;
            }, import("better-auth").$strip>;
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
        chargeRecurringSubscription: import("better-call").StrictEndpoint<"/paystack/charge-recurring", {
            method: "POST";
            body: import("zod").ZodObject<{
                subscriptionId: import("zod").ZodString;
                amount: import("zod").ZodOptional<import("zod").ZodNumber>;
            }, import("better-auth").$strip>;
        }, any>;
        syncProducts: import("better-call").StrictEndpoint<"/paystack/sync-products", {
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
        listProducts: import("better-call").StrictEndpoint<"/paystack/list-products", {
            method: "GET";
            metadata: {
                openapi: {
                    operationId: string;
                };
            };
        }, any>;
        syncPlans: import("better-call").StrictEndpoint<"/paystack/sync-plans", {
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
        listPlans: import("better-call").StrictEndpoint<"/paystack/list-plans", {
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
    };
    schema: import("@better-auth/core/db").BetterAuthPluginDBSchema;
    init: (ctx: AuthContext) => {
        options: {
            databaseHooks: {
                user: {
                    create: {
                        after(user: {
                            id: string;
                            email: string;
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
                };
            };
            invitation: {
                create: {
                    before: (invitation: {
                        organizationId: string;
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
    $ERROR_CODES: {
        [x: string]: import("@better-auth/core/utils/error-codes").RawError<string>;
    };
};
export type PaystackPlugin<O extends PaystackOptions<PaystackClientLike, any, any> = PaystackOptions> = ReturnType<typeof paystack<PaystackClientLike, any, any, O>>;
export type { Subscription, SubscriptionOptions, PaystackPlan, PaystackOptions, PaystackProduct };
//# sourceMappingURL=index.d.ts.map