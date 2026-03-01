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
	PaystackTransactionChargeAuthorizationInput,
} from "./types";

function isOpenApiFetchResponse(
	value: unknown,
): value is PaystackOpenApiFetchResponse {
	return (
		value !== null &&
		value !== undefined &&
		typeof value === "object" &&
		("data" in value || "error" in value || "response" in value)
	);
}

export function unwrapSdkResult<T = unknown>(result: unknown): T {
	if (isOpenApiFetchResponse(result)) {
		if (result.error !== undefined && result.error !== null) {
			throw new Error(typeof result.error === "string" ? result.error : JSON.stringify(result.error));
		}
		return (result.data as T) ?? (result as T);
	}
	if (result !== null && result !== undefined && typeof result === "object" && "data" in result) {
		const data = (result as { data: unknown }).data;
		// If data is also an object with a data property, unwrap it (legacy SDK style)
		if (data !== null && typeof data === "object" && "data" in data) {
			return (data as { data: T }).data;
		}
		return data as T;
	}
	return result as T;
}





type TransactionInitializeBody = Parameters<PaystackNodeClient["transaction_initialize"]>[0] extends {
	body?: infer B;
}
	? B
	: never;

export function getPaystackOps(
	paystackClient: PaystackClientLike,
) {
	return {
		customerCreate: (params: PaystackCustomerCreateInput) => {
			if (paystackClient?.customer_create !== undefined) {
				return paystackClient.customer_create({ body: params as unknown as NonNullable<Parameters<PaystackNodeClient["customer_create"]>[0]>["body"] });
			}
			return paystackClient?.customer?.create?.(params);
		},
		customerUpdate: (code: string, params: PaystackCustomerUpdateInput) => {
			if (paystackClient?.customer_update !== undefined) {
				return paystackClient.customer_update({
					params: { path: { code } },
					body: params as unknown as NonNullable<Parameters<PaystackNodeClient["customer_update"]>[0]>["body"],
				});
			}
			return paystackClient?.customer?.update?.(code, params);
		},
		transactionInitialize: (body: PaystackTransactionInitializeInput) => {
			if (paystackClient?.transaction_initialize !== undefined) {
				return paystackClient.transaction_initialize({
					body: body as TransactionInitializeBody,
				});
			}
			return paystackClient?.transaction?.initialize?.(body);
		},
		transactionVerify: (reference: string) => {
			if (paystackClient?.transaction_verify !== undefined) {
				return paystackClient.transaction_verify({
					params: { path: { reference } },
				});
			}
			return paystackClient?.transaction?.verify?.(reference);
		},
		subscriptionCreate: (body: PaystackSubscriptionCreateInput) => {
			if (paystackClient?.subscription_create !== undefined) {
				return paystackClient.subscription_create({ body });
			}
			return paystackClient?.subscription?.create?.(body);
		},
		subscriptionDisable: (body: PaystackSubscriptionToggleInput) => {
			if (paystackClient?.subscription_disable !== undefined) {
				return paystackClient.subscription_disable({ body });
			}
			return paystackClient?.subscription?.disable?.(body);
		},
		subscriptionEnable: (body: PaystackSubscriptionToggleInput) => {
			if (paystackClient?.subscription_enable !== undefined) {
				return paystackClient.subscription_enable({ body });
			}
			return paystackClient?.subscription?.enable?.(body);
		},
		subscriptionFetch: async (idOrCode: string) => {
			if (paystackClient?.subscription_fetch !== undefined) {
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
		subscriptionManageLink: (code: string) => {
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
		subscriptionManageEmail: (code: string, email: string) => {
			if (paystackClient?.subscription_manageEmail !== undefined) {
				return paystackClient.subscription_manageEmail({
					params: { path: { code } },
				});
			}
			return paystackClient?.subscription?.manage?.email?.(code, email);
		},
		subscriptionUpdate: (params: { code: string; plan?: string; authorization?: string; amount?: number }) => {
			if (paystackClient?.subscription_update !== undefined) {
				return (paystackClient.subscription_update as any)({
					params: { path: { code: params.code } },
					body: {
						plan: params.plan,
						authorization: params.authorization,
						amount: params.amount,
					},
				});
			}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return (paystackClient as any)?.subscription?.update?.(params.code, params);
		},
		transactionChargeAuthorization: (body: PaystackTransactionChargeAuthorizationInput) => {
			if (paystackClient?.transaction_chargeAuthorization !== undefined) {
				return paystackClient.transaction_chargeAuthorization({

					// casting to avoid deep type issues with metadata
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					body: body as any, // casting to avoid deep type issues with metadata
				});
			}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return paystackClient?.transaction?.chargeAuthorization?.(body as any);
		},
		productList: () => {
			if (paystackClient?.product_list !== undefined) {
				return paystackClient.product_list();
			}
			return paystackClient?.product?.list?.();
		},
		productFetch: (idOrCode: string) => {
			if (paystackClient?.product_fetch !== undefined) {
				return paystackClient.product_fetch({
					params: { path: { id_or_code: idOrCode } },
				});
			}
			return paystackClient?.product?.fetch?.(idOrCode);
		},
		productCreate: (params: Record<string, unknown>) => {
			if (paystackClient?.product_create !== undefined) {
				return paystackClient.product_create({ body: params });
			}
			return paystackClient?.product?.create?.(params);
		},
		productUpdate: (idOrCode: string, params: Record<string, unknown>) => {
			if (paystackClient?.product_update !== undefined) {
				return paystackClient.product_update({
					params: { path: { id_or_code: idOrCode } },
					body: params,
				});
			}
			return paystackClient?.product?.update?.(idOrCode, params);
		},
		productDelete: (idOrCode: string) => {
			if (paystackClient?.product_delete !== undefined) {
				return paystackClient.product_delete({
					params: { path: { id_or_code: idOrCode } },
				});
			}
			return paystackClient?.product?.delete?.(idOrCode);
		},
		planList: () => {
			if (paystackClient?.plan_list !== undefined) {
				return paystackClient.plan_list();
			}
			return paystackClient?.plan?.list?.();
		},
	};
}
