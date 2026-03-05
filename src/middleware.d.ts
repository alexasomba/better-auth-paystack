import type { PaystackClientLike, PaystackOptions } from "./types";
export declare const referenceMiddleware: (options: PaystackOptions<PaystackClientLike>, action: "initialize-transaction" | "verify-transaction" | "list-subscriptions" | "list-transactions" | "disable-subscription" | "enable-subscription" | "get-subscription-manage-link") => (inputContext: better_call0.MiddlewareInputContext<Options>) => Promise<{
    referenceId: string;
}>;
//# sourceMappingURL=middleware.d.ts.map