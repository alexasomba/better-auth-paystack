export const paystackClient = (_options) => {
    return {
        id: "paystack",
        $InferServerPlugin: {},
        pathMethods: {
            "/paystack/transaction/initialize": "POST",
            "/paystack/transaction/verify": "POST",
            "/paystack/transaction/list": "GET",
            "/paystack/subscription/list-local": "GET",
            "/paystack/subscription/disable": "POST",
            "/paystack/subscription/enable": "POST",
        },
    };
};
