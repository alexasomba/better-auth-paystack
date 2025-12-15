import type { PaystackClientLike, PaystackOpenApiFetchResponse } from "./types";

function isOpenApiFetchResponse(value: any): value is PaystackOpenApiFetchResponse {
    return (
        value &&
        typeof value === "object" &&
        ("data" in value || "error" in value || "response" in value)
    );
}

export function unwrapSdkResult<T = any>(result: any): T {
    if (isOpenApiFetchResponse(result)) {
        if (result.error) {
            throw result.error;
        }
        return result.data as T;
    }
    return (result?.data ?? result) as T;
}

export function getPaystackOps(paystackClient: PaystackClientLike | any) {
    return {
        customerCreate: async (params: any) => {
            if (paystackClient?.customer_create) {
                return paystackClient.customer_create({ body: params });
            }
            return paystackClient?.customer?.create?.(params);
        },
        transactionInitialize: async (body: any) => {
            if (paystackClient?.transaction_initialize) {
                return paystackClient.transaction_initialize({ body });
            }
            return paystackClient?.transaction?.initialize?.(body);
        },
        transactionVerify: async (reference: string) => {
            if (paystackClient?.transaction_verify) {
                return paystackClient.transaction_verify({
                    params: { path: { reference } },
                });
            }
            return paystackClient?.transaction?.verify?.(reference);
        },
        subscriptionDisable: async (body: { code: string; token: string }) => {
            if (paystackClient?.subscription_disable) {
                return paystackClient.subscription_disable({ body });
            }
            return paystackClient?.subscription?.disable?.(body);
        },
        subscriptionEnable: async (body: { code: string; token: string }) => {
            if (paystackClient?.subscription_enable) {
                return paystackClient.subscription_enable({ body });
            }
            return paystackClient?.subscription?.enable?.(body);
        },
        subscriptionFetch: async (idOrCode: string) => {
            if (paystackClient?.subscription_fetch) {
                try {
                    return await paystackClient.subscription_fetch({
                        params: { path: { code: idOrCode } },
                    });
                } catch {
                    return paystackClient.subscription_fetch({
                        params: { path: { id_or_code: idOrCode } },
                    });
                }
            }
            return paystackClient?.subscription?.fetch?.(idOrCode);
        },
        subscriptionManageLink: async (code: string) => {
            if (paystackClient?.subscription_manage_link) {
                return paystackClient.subscription_manage_link({
                    params: { path: { code } },
                });
            }
            return paystackClient?.subscription?.manage?.link?.(code);
        },
    };
}
