import type {
    PaystackClientLike,
    PaystackCustomerCreateInput,
    PaystackCustomerUpdateInput,
    PaystackNodeClient,
    PaystackOpenApiFetchResponse,
    PaystackSubscriptionFetchInit,
    PaystackSubscriptionCreateInput,
    PaystackSubscriptionToggleInput,
    PaystackTransactionInitializeInput,
} from "./types";

function isOpenApiFetchResponse(
    value: unknown,
): value is PaystackOpenApiFetchResponse {
    return (
        !!value &&
        typeof value === "object" &&
        ("data" in value || "error" in value || "response" in value)
    );
}

export function unwrapSdkResult<T = unknown>(result: unknown): T {
    if (isOpenApiFetchResponse(result)) {
        if (result.error) {
            throw result.error;
        }
        return result.data as T;
    }
    if (result && typeof result === "object" && "data" in result) {
        const data = (result as { data?: unknown }).data;
        return (data ?? result) as T;
    }
    return result as T;
}

type MetadataValue = string | Record<string, unknown> | undefined;

const normalizeMetadata = (value: MetadataValue): string | undefined => {
    if (!value) return undefined;
    return typeof value === "string" ? value : JSON.stringify(value);
};

const normalizeMetadataBody = <T extends { metadata?: MetadataValue }>(
    body: T,
): Omit<T, "metadata"> & { metadata?: string } => {
    const { metadata, ...rest } = body;
    const normalized = normalizeMetadata(metadata);
    if (normalized === undefined) {
        return rest as Omit<T, "metadata"> & { metadata?: string };
    }
    return { ...rest, metadata: normalized } as Omit<T, "metadata"> & {
        metadata?: string;
    };
};

type TransactionInitializeBody =
    Parameters<PaystackNodeClient["transaction_initialize"]>[0] extends {
        body?: infer B;
    }
        ? B
        : never;

export function getPaystackOps(
    paystackClient: PaystackClientLike | null | undefined,
) {
    return {
        customerCreate: async (params: PaystackCustomerCreateInput) => {
            if (paystackClient?.customer_create) {
                const body = normalizeMetadataBody(params);
                return paystackClient.customer_create({ body });
            }
            return paystackClient?.customer?.create?.(params);
        },
        customerUpdate: async (code: string, params: PaystackCustomerUpdateInput) => {
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
        transactionInitialize: async (body: PaystackTransactionInitializeInput) => {
            if (paystackClient?.transaction_initialize) {
                return paystackClient.transaction_initialize({
                    body: body as TransactionInitializeBody,
                });
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
        subscriptionCreate: async (body: PaystackSubscriptionCreateInput) => {
            if (paystackClient?.subscription_create) {
                return paystackClient.subscription_create({ body });
            }
            return paystackClient?.subscription?.create?.(body);
        },
        subscriptionDisable: async (body: PaystackSubscriptionToggleInput) => {
            if (paystackClient?.subscription_disable) {
                return paystackClient.subscription_disable({ body });
            }
            return paystackClient?.subscription?.disable?.(body);
        },
        subscriptionEnable: async (body: PaystackSubscriptionToggleInput) => {
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
                    const compatFetch = paystackClient.subscription_fetch as unknown as (
                        init: PaystackSubscriptionFetchInit,
                    ) => Promise<unknown>;
                    return compatFetch({
                        params: { path: { id_or_code: idOrCode } },
                    });
                }
            }
            return paystackClient?.subscription?.fetch?.(idOrCode);
        },
        subscriptionManageLink: async (code: string) => {
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
        subscriptionManageEmail: async (code: string, email: string) => {
            if (paystackClient?.subscription_manageEmail) {
                return paystackClient.subscription_manageEmail({
                    params: { path: { code } },
                });
            }
            return paystackClient?.subscription?.manage?.email?.(code, email);
        },
    };
}
