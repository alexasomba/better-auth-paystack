import type { BetterAuthClientPlugin } from "better-auth";
import type { paystack } from "./index";
import type { PaystackNodeClient } from "./types";

export const paystackClient = <
    O extends {
        subscription: boolean;
    },
>(
    _options?: O | undefined,
) => {
    return {
        id: "paystack-client",
        $InferServerPlugin: {} as ReturnType<
            typeof paystack<
                PaystackNodeClient,
                O["subscription"] extends true
                ? {
                    paystackClient: PaystackNodeClient;
                    paystackWebhookSecret: string;
                    subscription: {
                        enabled: true;
                        plans: [];
                    };
                }
                : {
                    paystackClient: PaystackNodeClient;
                    paystackWebhookSecret: string;
                }
            >
        >,
        pathMethods: {
            "/paystack/webhook": "POST",
            "/paystack/transaction/initialize": "POST",
            "/paystack/transaction/verify": "GET",
            "/paystack/subscription/list-local": "GET",
            "/paystack/subscription/disable": "POST",
            "/paystack/subscription/enable": "POST",
        },
    } satisfies BetterAuthClientPlugin;
};
