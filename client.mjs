//#region src/client.ts
const paystackClient = (_options) => {
	return {
		id: "paystack",
		version: "1.0.0",
		$InferServerPlugin: {},
		getActions: ($fetch, _$store, _options) => {
			const fetch = $fetch;
			const initializeTransaction = async (data, options) => {
				return fetch("paystack/initialize-transaction", {
					method: "POST",
					body: data,
					...options
				});
			};
			const verifyTransaction = async (data, options) => {
				return fetch("paystack/verify-transaction", {
					method: "POST",
					body: data,
					...options
				});
			};
			const listTransactions = async (data = {}, options) => {
				return fetch("paystack/list-transactions", {
					method: "GET",
					query: data.query,
					...options
				});
			};
			const listSubscriptions = async (data = {}, options) => {
				return fetch("paystack/list-subscriptions", {
					method: "GET",
					query: data.query,
					...options
				});
			};
			const getSubscriptionManageLink = async (data, options) => {
				return fetch("paystack/subscription-manage-link", {
					method: "GET",
					query: data,
					...options
				});
			};
			const cancelSubscription = async (data, options) => {
				return fetch("paystack/disable-subscription", {
					method: "POST",
					body: data,
					...options
				});
			};
			const restoreSubscription = async (data, options) => {
				return fetch("paystack/enable-subscription", {
					method: "POST",
					body: data,
					...options
				});
			};
			return {
				transaction: {
					initialize: initializeTransaction,
					verify: verifyTransaction,
					list: listTransactions
				},
				subscription: {
					upgrade: initializeTransaction,
					create: initializeTransaction,
					cancel: cancelSubscription,
					restore: restoreSubscription,
					list: listSubscriptions,
					billingPortal: getSubscriptionManageLink,
					manageLink: getSubscriptionManageLink,
					disable: cancelSubscription,
					enable: restoreSubscription
				},
				initializeTransaction,
				verifyTransaction,
				listTransactions,
				listSubscriptions,
				getSubscriptionManageLink,
				config: async () => {
					return fetch("/paystack/config", { method: "GET" });
				},
				listProducts: async (options) => {
					return fetch("paystack/list-products", {
						method: "GET",
						...options
					});
				},
				listPlans: async (options) => {
					return fetch("paystack/list-plans", {
						method: "GET",
						...options
					});
				}
			};
		}
	};
};
//#endregion
export { paystackClient };

//# sourceMappingURL=client.mjs.map