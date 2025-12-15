import type { SubscriptionOptions } from "./types";
export declare const referenceMiddleware: (subscriptionOptions: SubscriptionOptions, action: "initialize-transaction" | "verify-transaction" | "list-subscriptions" | "disable-subscription" | "enable-subscription") => (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
    context: {
        referenceId: any;
    };
}>;
//# sourceMappingURL=middleware.d.ts.map