//#region src/client.ts
/**
* Better Auth Paystack Client Plugin
*/
const paystackClient = (_options) => {
	return {
		id: "paystack",
		version: "2.1.1",
		$InferServerPlugin: {},
		getActions: ($fetch, _store, _options) => {
			const fetch = $fetch;
			const actions = {
				transaction: {
					initialize: (data, options) => fetch("paystack/initialize-transaction", {
						method: "POST",
						body: data,
						...options
					}),
					verify: (data, options) => fetch("paystack/verify-transaction", {
						method: "POST",
						body: data,
						...options
					}),
					list: (data, options) => fetch("paystack/list-transactions", {
						method: "GET",
						query: data?.query,
						...options
					})
				},
				subscription: {
					upgrade: (data, options) => fetch("paystack/initialize-transaction", {
						method: "POST",
						body: data,
						...options
					}),
					create: (data, options) => fetch("paystack/initialize-transaction", {
						method: "POST",
						body: data,
						...options
					}),
					cancel: (data, options) => fetch("paystack/disable-subscription", {
						method: "POST",
						body: data,
						...options
					}),
					restore: (data, options) => fetch("paystack/enable-subscription", {
						method: "POST",
						body: data,
						...options
					}),
					list: (data, options) => fetch("paystack/list-subscriptions", {
						method: "GET",
						query: data?.query,
						...options
					}),
					billingPortal: (data, options) => fetch("paystack/subscription-manage-link", {
						method: "GET",
						query: data,
						...options
					}),
					manageLink: (data, options) => fetch("paystack/subscription-manage-link", {
						method: "GET",
						query: data,
						...options
					}),
					disable: function(data, options) {
						return this.cancel(data, options);
					},
					enable: function(data, options) {
						return this.restore(data, options);
					}
				},
				initializeTransaction: (data, options) => fetch("paystack/initialize-transaction", {
					method: "POST",
					body: data,
					...options
				}),
				verifyTransaction: (data, options) => fetch("paystack/verify-transaction", {
					method: "POST",
					body: data,
					...options
				}),
				listTransactions: (data, options) => fetch("paystack/list-transactions", {
					method: "GET",
					query: data?.query,
					...options
				}),
				listSubscriptions: (data, options) => fetch("paystack/list-subscriptions", {
					method: "GET",
					query: data?.query,
					...options
				}),
				getSubscriptionManageLink: (data, options) => fetch("paystack/subscription-manage-link", {
					method: "GET",
					query: data,
					...options
				}),
				config: () => fetch("/paystack/config", { method: "GET" }),
				listProducts: (options) => fetch("paystack/list-products", {
					method: "GET",
					...options
				}),
				listPlans: (options) => fetch("paystack/list-plans", {
					method: "GET",
					...options
				}),
				paystack: {}
			};
			actions.paystack = actions;
			return actions;
		}
	};
};
const paystack = paystackClient;
//#endregion
export { paystack, paystackClient };

//# sourceMappingURL=client.mjs.map