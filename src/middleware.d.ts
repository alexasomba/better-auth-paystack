import type { PaystackClientLike, PaystackOptions } from "./types";
export declare const referenceMiddleware: (options: PaystackOptions<PaystackClientLike>, action: "initialize-transaction" | "verify-transaction" | "list-subscriptions" | "list-transactions" | "disable-subscription" | "enable-subscription" | "get-subscription-manage-link") => (inputContext: import("better-call").MiddlewareInputContext<import("better-call").MiddlewareOptions>) => Promise<{
    referenceId: string;
}>;
//# sourceMappingURL=middleware.d.ts.map