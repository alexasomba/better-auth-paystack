function isOpenApiFetchResponse(value) {
    return (!!value &&
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
    if (result && typeof result === "object" && "data" in result) {
        const data = result.data;
        return (data ?? result);
    }
    return result;
}
const normalizeMetadata = (value) => {
    if (!value)
        return undefined;
    return typeof value === "string" ? value : JSON.stringify(value);
};
const normalizeMetadataBody = (body) => {
    const { metadata, ...rest } = body;
    const normalized = normalizeMetadata(metadata);
    if (normalized === undefined) {
        return rest;
    }
    return { ...rest, metadata: normalized };
};
export function getPaystackOps(paystackClient) {
    return {
        customerCreate: async (params) => {
            if (paystackClient?.customer_create) {
                const body = normalizeMetadataBody(params);
                return paystackClient.customer_create({ body });
            }
            return paystackClient?.customer?.create?.(params);
        },
        customerUpdate: async (code, params) => {
            if (paystackClient?.customer_update) {
                // Determine if it's the flat client (OpenAPI style)
                const body = normalizeMetadataBody(params);
                return paystackClient.customer_update({
                    params: { path: { code } },
                    body,
                });
            }
            return paystackClient?.customer?.update?.(code, params);
        },
        transactionInitialize: async (body) => {
            if (paystackClient?.transaction_initialize) {
                return paystackClient.transaction_initialize({
                    body: body,
                });
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
        subscriptionCreate: async (body) => {
            if (paystackClient?.subscription_create) {
                return paystackClient.subscription_create({ body });
            }
            return paystackClient?.subscription?.create?.(body);
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
                try {
                    return await paystackClient.subscription_fetch({
                        params: { path: { code: idOrCode } },
                    });
                }
                catch {
                    const compatFetch = paystackClient.subscription_fetch;
                    return compatFetch({
                        params: { path: { id_or_code: idOrCode } },
                    });
                }
            }
            return paystackClient?.subscription?.fetch?.(idOrCode);
        },
        subscriptionManageLink: async (code) => {
            if (paystackClient?.subscription_manageLink) {
                return paystackClient.subscription_manageLink({
                    params: { path: { code } },
                });
            }
            // Fallback for snake_case if older SDK version or different generator
            if (paystackClient?.subscription_manage_link) {
                return paystackClient.subscription_manage_link({
                    params: { path: { code } },
                });
            }
            return paystackClient?.subscription?.manage?.link?.(code);
        },
        subscriptionManageEmail: async (code, email) => {
            if (paystackClient?.subscription_manageEmail) {
                return paystackClient.subscription_manageEmail({
                    params: { path: { code } },
                });
            }
            return paystackClient?.subscription?.manage?.email?.(code, email);
        },
    };
}
