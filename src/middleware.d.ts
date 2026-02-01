import type { SubscriptionOptions } from "./types";
export declare const referenceMiddleware: (subscriptionOptions: SubscriptionOptions, action: "initialize-transaction" | "verify-transaction" | "list-subscriptions" | "disable-subscription" | "enable-subscription") => (inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
    context: {
        referenceId: any;
    };
}>;
//# sourceMappingURL=middleware.d.ts.map