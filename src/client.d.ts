import type { BetterFetchResponse, BetterFetchOption, BetterFetch } from "@better-fetch/fetch";
import type { PaystackTransaction, Subscription } from "./types";
import type { paystack } from "./index";
export declare const paystackClient: <O extends {
    subscription: boolean;
}>(_options?: O) => {
    id: "paystack";
    $InferServerPlugin: ReturnType<typeof paystack>;
    getActions: ($fetch: BetterFetch) => {
        subscription: {
            /**
             * Initialize a transaction to upgrade or creating a subscription.
             */
            upgrade: (data: {
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
            }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                url: string;
                reference: string;
                accessCode: string;
                redirect: boolean;
            }>>;
            /**
             * Initialize a payment to create a subscription.
             */
            create: (data: {
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
            }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                url: string;
                reference: string;
                accessCode: string;
                redirect: boolean;
            }>>;
            /**
             * Disable a subscription.
             */
            cancel: (data: {
                subscriptionCode: string;
                emailToken?: string;
            }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                status: string;
            }>>;
            /**
             * Enable a subscription.
             */
            restore: (data: {
                subscriptionCode: string;
                emailToken?: string;
            }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                status: string;
            }>>;
            /**
             * List subscriptions for the user.
             */
            list: (data?: {
                query?: Record<string, unknown>;
            }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                subscriptions: Subscription[];
            }>>;
            /**
             * Get a link to manage the subscription on Paystack.
             */
            billingPortal: (data: {
                subscriptionCode: string;
            }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                link: string;
            }>>;
            /**
             * Aliases for legacy/demo usage.
             */
            listLocal: (data?: {
                query?: Record<string, unknown>;
            }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                subscriptions: Subscription[];
            }>>;
            manageLink: (data: {
                subscriptionCode: string;
            }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                link: string;
            }>>;
            disable: (data: {
                subscriptionCode: string;
                emailToken?: string;
            }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                status: string;
            }>>;
            enable: (data: {
                subscriptionCode: string;
                emailToken?: string;
            }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                status: string;
            }>>;
        };
        paystack: {
            transaction: {
                initialize: (data: {
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
                }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                    url: string;
                    reference: string;
                    accessCode: string;
                    redirect: boolean;
                }>>;
                verify: (data: {
                    reference: string;
                }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                    status: string;
                    reference: string;
                    data: unknown;
                }>>;
                list: (data?: {
                    query?: Record<string, unknown>;
                }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                    transactions: PaystackTransaction[];
                }>>;
            };
            subscription: {
                create: (data: {
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
                }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                    url: string;
                    reference: string;
                    accessCode: string;
                    redirect: boolean;
                }>>;
                upgrade: (data: {
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
                }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                    url: string;
                    reference: string;
                    accessCode: string;
                    redirect: boolean;
                }>>;
                cancel: (data: {
                    subscriptionCode: string;
                    emailToken?: string;
                }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                    status: string;
                }>>;
                restore: (data: {
                    subscriptionCode: string;
                    emailToken?: string;
                }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                    status: string;
                }>>;
                list: (data?: {
                    query?: Record<string, unknown>;
                }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                    subscriptions: Subscription[];
                }>>;
                billingPortal: (data: {
                    subscriptionCode: string;
                }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                    link: string;
                }>>;
                listLocal: (data?: {
                    query?: Record<string, unknown>;
                }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                    subscriptions: Subscription[];
                }>>;
                manageLink: (data: {
                    subscriptionCode: string;
                }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                    link: string;
                }>>;
                disable: (data: {
                    subscriptionCode: string;
                    emailToken?: string;
                }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                    status: string;
                }>>;
                enable: (data: {
                    subscriptionCode: string;
                    emailToken?: string;
                }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                    status: string;
                }>>;
            };
            initializeTransaction: (data: {
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
            }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                url: string;
                reference: string;
                accessCode: string;
                redirect: boolean;
            }>>;
            verifyTransaction: (data: {
                reference: string;
            }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                status: string;
                reference: string;
                data: unknown;
            }>>;
            listTransactions: (data?: {
                query?: Record<string, unknown>;
            }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                transactions: PaystackTransaction[];
            }>>;
            listSubscriptions: (data?: {
                query?: Record<string, unknown>;
            }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                subscriptions: Subscription[];
            }>>;
            getSubscriptionManageLink: (data: {
                subscriptionCode: string;
            }, options?: BetterFetchOption) => Promise<BetterFetchResponse<{
                link: string;
            }>>;
            getConfig: () => Promise<BetterFetchResponse<Record<string, unknown>>>;
        };
    };
};
//# sourceMappingURL=client.d.ts.map