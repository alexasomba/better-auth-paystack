export const paystackClient = (_options) => {
    return {
        id: "paystack-client",
        $InferServerPlugin: {},
        pathMethods: {
            "/paystack/webhook": "POST",
            "/paystack/transaction/initialize": "POST",
            "/paystack/transaction/verify": "GET",
            "/paystack/subscription/list": "GET",
            "/paystack/subscription/disable": "POST",
            "/paystack/subscription/enable": "POST",
        },
    };
};
