import type { PaystackClientLike, PaystackCustomerCreateInput, PaystackCustomerUpdateInput, PaystackSubscriptionCreateInput, PaystackSubscriptionToggleInput, PaystackTransactionInitializeInput } from "./types";
export declare function unwrapSdkResult<T = unknown>(result: unknown): T;
export declare function getPaystackOps(paystackClient: PaystackClientLike | null | undefined): {
    customerCreate: (params: PaystackCustomerCreateInput) => Promise<unknown>;
    customerUpdate: (code: string, params: PaystackCustomerUpdateInput) => Promise<unknown>;
    transactionInitialize: (body: PaystackTransactionInitializeInput) => Promise<unknown>;
    transactionVerify: (reference: string) => Promise<unknown>;
    subscriptionCreate: (body: PaystackSubscriptionCreateInput) => Promise<unknown>;
    subscriptionDisable: (body: PaystackSubscriptionToggleInput) => Promise<unknown>;
    subscriptionEnable: (body: PaystackSubscriptionToggleInput) => Promise<unknown>;
    subscriptionFetch: (idOrCode: string) => Promise<unknown>;
    subscriptionManageLink: (code: string) => Promise<unknown>;
    subscriptionManageEmail: (code: string, email: string) => Promise<unknown>;
};
//# sourceMappingURL=paystack-sdk.d.ts.map