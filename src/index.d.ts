import type { PaystackNodeClient, PaystackClientLike, PaystackOptions, PaystackPlan, Subscription, SubscriptionOptions } from "./types";
export declare const paystack: <TPaystackClient extends PaystackClientLike = PaystackNodeClient, O extends PaystackOptions<TPaystackClient> = PaystackOptions<TPaystackClient>>(options: O) => {
    id: "paystack";
    endpoints: {
        paystackWebhook: import("better-auth").StrictEndpoint<"/paystack/webhook", {
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
    init(ctx: import("better-auth").AuthContext<import("better-auth").BetterAuthOptions>): {
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
                        } & Record<string, unknown>, hookCtx: import("better-auth").GenericEndpointContext<import("better-auth").BetterAuthOptions> | null): Promise<void>;
                    };
                };
            };
        };
    };
    schema: import("better-auth").BetterAuthPluginDBSchema;
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