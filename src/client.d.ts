import type { paystack } from "./index";
export declare const paystackClient: <O extends {
    subscription: boolean;
}>(_options?: O | undefined) => {
    id: "paystack-client";
    $InferServerPlugin: ReturnType<typeof paystack<O["subscription"] extends true ? {
        paystackClient: any;
        paystackWebhookSecret: string;
        subscription: {
            enabled: true;
            plans: [];
        };
    } : {
        paystackClient: any;
        paystackWebhookSecret: string;
    }>>;
    pathMethods: {
        "/paystack/webhook": "POST";
        "/paystack/transaction/initialize": "POST";
        "/paystack/transaction/verify": "GET";
        "/paystack/subscription/list": "GET";
        "/paystack/subscription/disable": "POST";
        "/paystack/subscription/enable": "POST";
    };
};
//# sourceMappingURL=client.d.ts.map