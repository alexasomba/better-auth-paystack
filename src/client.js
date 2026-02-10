export const paystackClient = (_options) => {
    return {
        id: "paystack",
        $InferServerPlugin: {},
        getActions: ($fetch) => {
            const initializeTransaction = async (data, options) => {
                return $fetch("paystack/initialize-transaction", {
                    method: "POST",
                    body: data,
                    ...options,
                });
            };
            const verifyTransaction = async (data, options) => {
                return $fetch("paystack/verify-transaction", {
                    method: "POST",
                    body: data,
                    ...options,
                });
            };
            const listTransactions = async (data = {}, options) => {
                return $fetch("paystack/list-transactions", {
                    method: "GET",
                    query: data.query,
                    ...options,
                });
            };
            const listSubscriptions = async (data = {}, options) => {
                return $fetch("paystack/list-subscriptions", {
                    method: "GET",
                    query: data.query,
                    ...options,
                });
            };
            const getSubscriptionManageLink = async (data, options) => {
                return $fetch("paystack/get-subscription-manage-link", {
                    method: "GET",
                    query: data,
                    ...options,
                });
            };
            const cancelSubscription = async (data, options) => {
                return $fetch("paystack/disable-subscription", {
                    method: "POST",
                    body: data,
                    ...options,
                });
            };
            const restoreSubscription = async (data, options) => {
                return $fetch("paystack/enable-subscription", {
                    method: "POST",
                    body: data,
                    ...options,
                });
            };
            return {
                subscription: {
                    /**
                     * Initialize a transaction to upgrade or creating a subscription.
                     */
                    upgrade: initializeTransaction,
                    /**
                     * Initialize a payment to create a subscription.
                     */
                    create: initializeTransaction,
                    /**
                     * Disable a subscription.
                     */
                    cancel: cancelSubscription,
                    /**
                     * Enable a subscription.
                     */
                    restore: restoreSubscription,
                    /**
                     * List subscriptions for the user.
                     */
                    list: listSubscriptions,
                    /**
                     * Get a link to manage the subscription on Paystack.
                     */
                    billingPortal: getSubscriptionManageLink,
                    /**
                     * Aliases for legacy/demo usage.
                     */
                    listLocal: listSubscriptions,
                    manageLink: getSubscriptionManageLink,
                    disable: cancelSubscription,
                    enable: restoreSubscription,
                },
                paystack: {
                    transaction: {
                        initialize: initializeTransaction,
                        verify: verifyTransaction,
                        list: listTransactions,
                    },
                    subscription: {
                        create: initializeTransaction,
                        upgrade: initializeTransaction,
                        cancel: cancelSubscription,
                        restore: restoreSubscription,
                        list: listSubscriptions,
                        billingPortal: getSubscriptionManageLink,
                        listLocal: listSubscriptions,
                        manageLink: getSubscriptionManageLink,
                        disable: cancelSubscription,
                        enable: restoreSubscription,
                    },
                    initializeTransaction,
                    verifyTransaction,
                    listTransactions,
                    listSubscriptions,
                    getSubscriptionManageLink,
                    getConfig: async () => {
                        return $fetch("paystack/get-config", {
                            method: "GET",
                        });
                    },
                },
            };
        }
    };
};
