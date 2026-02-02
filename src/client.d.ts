import type { paystack } from "./index";
export declare const paystackClient: <O extends {
    subscription: boolean;
}>(_options?: O | undefined) => {
    id: "paystack";
    $InferServerPlugin: ReturnType<typeof paystack<any, any>>;
    pathMethods: {
        "/paystack/transaction/initialize": "POST";
        "/paystack/transaction/verify": "POST";
        "/paystack/transaction/list": "GET";
        "/paystack/get-config": "GET";
        "/paystack/subscription/list-local": "GET";
        "/paystack/subscription/disable": "POST";
        "/paystack/subscription/enable": "POST";
        "/paystack/subscription/manage-link": "GET";
    };
};
//# sourceMappingURL=client.d.ts.map