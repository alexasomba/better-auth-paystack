import type { PaystackOptions } from "./types";
export declare const referenceMiddleware: (options: PaystackOptions, action: "initialize-transaction" | "verify-transaction" | "list-subscriptions" | "list-transactions" | "disable-subscription" | "enable-subscription" | "get-subscription-manage-link") => (inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
    referenceId: any;
}>;
//# sourceMappingURL=middleware.d.ts.map