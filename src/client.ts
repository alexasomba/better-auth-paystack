import type { BetterAuthClientPlugin } from "better-auth";
import type { paystack } from "./index";
import type { PaystackNodeClient, PaystackTransaction } from "./types";

export const paystackClient = <
    O extends {
        subscription: boolean;
    },
>(
    _options?: O | undefined,
) => {
    return {
        id: "paystack",
        $InferServerPlugin: {} as ReturnType<typeof paystack<any, any>>,
        pathMethods: {
            "/paystack/transaction/initialize": "POST",
            "/paystack/transaction/verify": "POST",
            "/paystack/transaction/list": "GET",
            "/paystack/get-config": "GET",
            "/paystack/subscription/list-local": "GET",
            "/paystack/subscription/disable": "POST",
            "/paystack/subscription/enable": "POST",
            "/paystack/subscription/manage-link": "GET",
        },
    } satisfies BetterAuthClientPlugin;
};
