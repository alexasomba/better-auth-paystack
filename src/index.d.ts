import type { AuthContext, GenericEndpointContext } from "better-auth";
import type { PaystackNodeClient, PaystackClientLike, PaystackOptions, PaystackPlan, Subscription, SubscriptionOptions, PaystackProduct } from "./types";
export declare const paystack: <TPaystackClient extends PaystackClientLike = PaystackNodeClient, O extends PaystackOptions<TPaystackClient> = PaystackOptions<TPaystackClient>>(options: O) => {
    readonly id: "paystack";
    readonly endpoints: {
        readonly initializeTransaction: import("better-call").StrictEndpoint<"/paystack/initialize-transaction", {
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
        }, {
            url: string | undefined;
            reference: string | undefined;
            accessCode: string | undefined;
            redirect: boolean;
        }>;
        readonly verifyTransaction: import("better-call").StrictEndpoint<"/paystack/verify-transaction", {
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
        }, {
            status: string | undefined;
            reference: string;
            data: unknown;
        }>;
        readonly listSubscriptions: import("better-call").StrictEndpoint<"/paystack/list-subscriptions", {
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
        }, {
            subscriptions: Subscription[];
        }>;
        readonly paystackWebhook: import("better-call").StrictEndpoint<"/paystack/webhook", {
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
        readonly listTransactions: import("better-call").StrictEndpoint<"/paystack/list-transactions", {
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
        }, {
            transactions: import("./types").PaystackTransaction[];
        }>;
        readonly getConfig: import("better-call").StrictEndpoint<"/paystack/get-config", {
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
        readonly disableSubscription: import("better-call").StrictEndpoint<"/paystack/disable-subscription", {
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
        }, {
            status: string;
        }>;
        readonly enableSubscription: import("better-call").StrictEndpoint<"/paystack/enable-subscription", {
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
        }, {
            status: string;
        }>;
        readonly getSubscriptionManageLink: import("better-call").StrictEndpoint<"/paystack/get-subscription-manage-link", {
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
        }, {
            link: unknown;
        }>;
        readonly createSubscription: import("better-call").StrictEndpoint<"/paystack/create-subscription", {
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
        }, {
            url: string | undefined;
            reference: string | undefined;
            accessCode: string | undefined;
            redirect: boolean;
        }>;
        readonly upgradeSubscription: import("better-call").StrictEndpoint<"/paystack/upgrade-subscription", {
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
        }, {
            url: string | undefined;
            reference: string | undefined;
            accessCode: string | undefined;
            redirect: boolean;
        }>;
        readonly cancelSubscription: import("better-call").StrictEndpoint<"/paystack/cancel-subscription", {
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
        }, {
            status: string;
        }>;
        readonly restoreSubscription: import("better-call").StrictEndpoint<"/paystack/restore-subscription", {
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
        }, {
            status: string;
        }>;
        readonly chargeRecurringSubscription: import("better-call").StrictEndpoint<"/paystack/charge-recurring", {
            method: "POST";
            body: import("zod").ZodObject<{
                subscriptionId: import("zod").ZodString;
            }, import("better-auth").$strip>;
        }, {
            status: string;
            data: Record<string, unknown>;
        }>;
    };
    readonly schema: import("@better-auth/core/db").BetterAuthPluginDBSchema;
    readonly init: (ctx: AuthContext) => {
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
    readonly $ERROR_CODES: {
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
export type PaystackPlugin<O extends PaystackOptions<PaystackClientLike> = PaystackOptions> = ReturnType<typeof paystack<PaystackClientLike, O>>;
export type { Subscription, SubscriptionOptions, PaystackPlan, PaystackOptions, PaystackProduct };
//# sourceMappingURL=index.d.ts.map