import type { paystack } from "./index";
import type { PaystackNodeClient } from "./types";
export declare const paystackClient: <O extends {
    subscription: boolean;
}>(_options?: O | undefined) => {
    id: "paystack";
    $InferServerPlugin: ReturnType<typeof paystack<PaystackNodeClient, O["subscription"] extends true ? {
        paystackClient: PaystackNodeClient;
        paystackWebhookSecret: string;
        subscription: {
            enabled: true;
            plans: [];
        };
    } : {
        paystackClient: PaystackNodeClient;
        paystackWebhookSecret: string;
    }>>;
    pathMethods: {
        "/paystack/transaction/initialize": "POST";
        "/paystack/transaction/verify": "POST";
        "/paystack/subscription/list-local": "GET";
        "/paystack/subscription/disable": "POST";
        "/paystack/subscription/enable": "POST";
    };
};
//# sourceMappingURL=client.d.ts.map