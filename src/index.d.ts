import type { AuthContext, GenericEndpointContext } from "better-auth";
import type { PaystackNodeClient, PaystackClientLike, PaystackOptions, PaystackPlan, Subscription, SubscriptionOptions, PaystackProduct } from "./types";
export declare const paystack: <TPaystackClient extends PaystackClientLike = PaystackNodeClient, TMetadata extends Record<string, unknown> = Record<string, unknown>, TLimits extends Record<string, unknown> = Record<string, unknown>, O extends PaystackOptions<TPaystackClient, TMetadata, TLimits> = PaystackOptions<TPaystackClient, TMetadata, TLimits>>(options: O) => {
    id: string;
    endpoints: {
        initializeTransaction: StrictEndpoint<Path, Options, R>;
        verifyTransaction: StrictEndpoint<Path, Options, R>;
        listSubscriptions: StrictEndpoint<Path, Options, R>;
        paystackWebhook: StrictEndpoint<Path, Options, R>;
        listTransactions: StrictEndpoint<Path, Options, R>;
        getConfig: StrictEndpoint<Path, Options, R>;
        disableSubscription: StrictEndpoint<Path, Options, R>;
        enableSubscription: StrictEndpoint<Path, Options, R>;
        getSubscriptionManageLink: StrictEndpoint<Path, Options, R>;
        subscriptionManageLink: StrictEndpoint<Path, Options, R>;
        createSubscription: StrictEndpoint<Path, Options, R>;
        upgradeSubscription: StrictEndpoint<Path, Options, R>;
        cancelSubscription: StrictEndpoint<Path, Options, R>;
        restoreSubscription: StrictEndpoint<Path, Options, R>;
        chargeRecurringSubscription: StrictEndpoint<Path, Options, R>;
        syncProducts: StrictEndpoint<Path, Options, R>;
        listProducts: StrictEndpoint<Path, Options, R>;
        syncPlans: StrictEndpoint<Path, Options, R>;
        listPlans: StrictEndpoint<Path, Options, R>;
    };
    schema: import("@better-auth/core/db").BetterAuthPluginDBSchema;
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
    $ERROR_CODES: {
        [x: string]: import("@better-auth/core/utils/error-codes").RawError<string>;
    };
};
export type PaystackPlugin<TPaystackClient extends PaystackClientLike = PaystackNodeClient, TMetadata extends Record<string, unknown> = Record<string, unknown>, TLimits extends Record<string, unknown> = Record<string, unknown>, O extends PaystackOptions<TPaystackClient, TMetadata, TLimits> = PaystackOptions<TPaystackClient, TMetadata, TLimits>> = ReturnType<typeof paystack<TPaystackClient, TMetadata, TLimits, O>>;
export type { Subscription, SubscriptionOptions, PaystackPlan, PaystackOptions, PaystackProduct };
//# sourceMappingURL=index.d.ts.map