function isOpenApiFetchResponse(value) {
    return (value !== null &&
        value !== undefined &&
        typeof value === "object" &&
        ("data" in value || "error" in value || "response" in value));
}
export function unwrapSdkResult(result) {
    if (isOpenApiFetchResponse(result)) {
        if (result.error !== undefined && result.error !== null) {
            throw new Error(typeof result.error === "string" ? result.error : JSON.stringify(result.error));
        }
        return result.data;
    }
    if (result !== null && result !== undefined && typeof result === "object" && "data" in result) {
        const data = result.data;
        return (data ?? result);
    }
    return result;
}
const normalizeMetadata = (value) => {
    if (value === undefined || value === null || value === "")
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
        customerCreate: (params) => {
            if (paystackClient?.customer_create !== undefined) {
                const body = normalizeMetadataBody(params);
                return paystackClient.customer_create({ body });
            }
            return paystackClient?.customer?.create?.(params);
        },
        customerUpdate: (code, params) => {
            if (paystackClient?.customer_update !== undefined) {
                // Determine if it's the flat client (OpenAPI style)
                const body = normalizeMetadataBody(params);
                return paystackClient.customer_update({
                    params: { path: { code } },
                    body,
                });
            }
            return paystackClient?.customer?.update?.(code, params);
        },
        transactionInitialize: (body) => {
            if (paystackClient?.transaction_initialize !== undefined) {
                return paystackClient.transaction_initialize({
                    body: body,
                });
            }
            return paystackClient?.transaction?.initialize?.(body);
        },
        transactionVerify: (reference) => {
            if (paystackClient?.transaction_verify !== undefined) {
                return paystackClient.transaction_verify({
                    params: { path: { reference } },
                });
            }
            return paystackClient?.transaction?.verify?.(reference);
        },
        subscriptionCreate: (body) => {
            if (paystackClient?.subscription_create !== undefined) {
                return paystackClient.subscription_create({ body });
            }
            return paystackClient?.subscription?.create?.(body);
        },
        subscriptionDisable: (body) => {
            if (paystackClient?.subscription_disable !== undefined) {
                return paystackClient.subscription_disable({ body });
            }
            return paystackClient?.subscription?.disable?.(body);
        },
        subscriptionEnable: (body) => {
            if (paystackClient?.subscription_enable !== undefined) {
                return paystackClient.subscription_enable({ body });
            }
            return paystackClient?.subscription?.enable?.(body);
        },
        subscriptionFetch: async (idOrCode) => {
            if (paystackClient?.subscription_fetch !== undefined) {
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
        subscriptionManageLink: (code) => {
            if (paystackClient?.subscription_manageLink !== undefined) {
                return paystackClient.subscription_manageLink({
                    params: { path: { code } },
                });
            }
            // Fallback for snake_case if older SDK version or different generator
            if (paystackClient?.subscription_manage_link !== undefined) {
                return paystackClient.subscription_manage_link({
                    params: { path: { code } },
                });
            }
            return paystackClient?.subscription?.manage?.link?.(code);
        },
        subscriptionManageEmail: (code, email) => {
            if (paystackClient?.subscription_manageEmail !== undefined) {
                return paystackClient.subscription_manageEmail({
                    params: { path: { code } },
                });
            }
            return paystackClient?.subscription?.manage?.email?.(code, email);
        },
        transactionChargeAuthorization: (body) => {
            if (paystackClient?.transaction_chargeAuthorization !== undefined) {
                return paystackClient.transaction_chargeAuthorization({
                    // casting to avoid deep type issues with metadata
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    body: body, // casting to avoid deep type issues with metadata
                });
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return paystackClient?.transaction?.chargeAuthorization?.(body);
        },
    };
}
