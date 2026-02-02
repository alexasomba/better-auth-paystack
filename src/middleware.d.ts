import type { SubscriptionOptions } from "./types";
export declare const referenceMiddleware: (subscriptionOptions: SubscriptionOptions, action: "initialize-transaction" | "verify-transaction" | "list-subscriptions" | "list-transactions" | "disable-subscription" | "enable-subscription" | "get-subscription-manage-link") => (inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
    context: {
        referenceId: any;
    };
}>;
//# sourceMappingURL=middleware.d.ts.map