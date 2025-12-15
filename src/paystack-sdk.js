function isOpenApiFetchResponse(value) {
    return (value &&
        typeof value === "object" &&
        ("data" in value || "error" in value || "response" in value));
}
export function unwrapSdkResult(result) {
    if (isOpenApiFetchResponse(result)) {
        if (result.error) {
            throw result.error;
        }
        return result.data;
    }
    return (result?.data ?? result);
}
export function getPaystackOps(paystackClient) {
    return {
        customerCreate: async (params) => {
            if (paystackClient?.customer_create) {
                return paystackClient.customer_create({ body: params });
            }
            return paystackClient?.customer?.create?.(params);
        },
        transactionInitialize: async (body) => {
            if (paystackClient?.transaction_initialize) {
                return paystackClient.transaction_initialize({ body });
            }
            return paystackClient?.transaction?.initialize?.(body);
        },
        transactionVerify: async (reference) => {
            if (paystackClient?.transaction_verify) {
                return paystackClient.transaction_verify({
                    params: { path: { reference } },
                });
            }
            return paystackClient?.transaction?.verify?.(reference);
        },
        subscriptionDisable: async (body) => {
            if (paystackClient?.subscription_disable) {
                return paystackClient.subscription_disable({ body });
            }
            return paystackClient?.subscription?.disable?.(body);
        },
        subscriptionEnable: async (body) => {
            if (paystackClient?.subscription_enable) {
                return paystackClient.subscription_enable({ body });
            }
            return paystackClient?.subscription?.enable?.(body);
        },
        subscriptionFetch: async (idOrCode) => {
            if (paystackClient?.subscription_fetch) {
                return paystackClient.subscription_fetch({
                    params: { path: { id_or_code: idOrCode } },
                });
            }
            return paystackClient?.subscription?.fetch?.(idOrCode);
        },
        subscriptionManageLink: async (code) => {
            if (paystackClient?.subscription_manage_link) {
                return paystackClient.subscription_manage_link({
                    params: { path: { code } },
                });
            }
            return paystackClient?.subscription?.manage?.link?.(code);
        },
    };
}
