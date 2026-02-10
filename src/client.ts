import type { BetterAuthClientPlugin } from "better-auth";
import type { BetterFetchResponse, BetterFetchOption, BetterFetch } from "@better-fetch/fetch";

import type { PaystackTransaction, Subscription } from "./types";

import type { paystack } from "./index";

export const paystackClient = <
	O extends {
		subscription: boolean;
	},
>(
		_options?: O,
	) => {
	return {
		id: "paystack",
		$InferServerPlugin: {} as ReturnType<typeof paystack>,
		getActions: ($fetch: BetterFetch) => {
			const initializeTransaction = async (data: {
				plan?: string;
				email?: string;
				amount?: number;
				reference?: string;
				metadata?: Record<string, unknown>;
				callbackUrl?: string;
				callbackURL?: string;
				currency?: string;
				quantity?: number;
				referenceId?: string;
				product?: string;
			}, options?: BetterFetchOption): Promise<BetterFetchResponse<{
				url: string;
				reference: string;
				accessCode: string;
				redirect: boolean;
			}>> => {
				return $fetch<{
					url: string;
					reference: string;
					accessCode: string;
					redirect: boolean;
				}>("paystack/initialize-transaction", {
					method: "POST",
					body: data,
					...options,
				});
			};

			const verifyTransaction = async (data: { reference: string }, options?: BetterFetchOption): Promise<BetterFetchResponse<{
				status: string;
				reference: string;
				data: unknown;
			}>> => {
				return $fetch<{
					status: string;
					reference: string;
					data: unknown;
				}>("paystack/verify-transaction", {
					method: "POST",
					body: data,
					...options,
				});
			};

			const listTransactions = async (data: { query?: Record<string, unknown> } = {}, options?: BetterFetchOption): Promise<BetterFetchResponse<{
				transactions: PaystackTransaction[];
			}>> => {
				return $fetch<{
					transactions: PaystackTransaction[];
				}>("paystack/list-transactions", {
					method: "GET",
					query: data.query,
					...options,
				});
			};

			const listSubscriptions = async (data: { query?: Record<string, unknown> } = {}, options?: BetterFetchOption): Promise<BetterFetchResponse<{
				subscriptions: Subscription[];
			}>> => {
				return $fetch<{
					subscriptions: Subscription[];
				}>("paystack/list-subscriptions", {
					method: "GET",
					query: data.query,
					...options,
				});
			};

			const getSubscriptionManageLink = async (data: { subscriptionCode: string }, options?: BetterFetchOption): Promise<BetterFetchResponse<{
				link: string;
			}>> => {
				return $fetch<{
					link: string;
				}>("paystack/get-subscription-manage-link", {
					method: "GET",
					query: data,
					...options,
				});
			};

			const cancelSubscription = async (data: {
				subscriptionCode: string;
				emailToken?: string;
			}, options?: BetterFetchOption): Promise<BetterFetchResponse<{
				status: string;
			}>> => {
				return $fetch<{
					status: string;
				}>("paystack/disable-subscription", {
					method: "POST",
					body: data,
					...options,
				});
			};

			const restoreSubscription = async (data: {
				subscriptionCode: string;
				emailToken?: string;
			}, options?: BetterFetchOption): Promise<BetterFetchResponse<{
				status: string;
			}>> => {
				return $fetch<{
					status: string;
				}>("paystack/enable-subscription", {
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
					getConfig: async (): Promise<BetterFetchResponse<Record<string, unknown>>> => {
						return $fetch<Record<string, unknown>>("paystack/get-config", {
							method: "GET",
						});
					},
				},
			};
		}
	} satisfies BetterAuthClientPlugin;
};
