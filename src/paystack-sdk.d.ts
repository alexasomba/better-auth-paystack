import type { PaystackClientLike, PaystackCustomerCreateInput, PaystackCustomerUpdateInput, PaystackSubscriptionCreateInput, PaystackSubscriptionToggleInput, PaystackTransactionInitializeInput } from "./types";
export declare function unwrapSdkResult<T = unknown>(result: unknown): T;
export declare function getPaystackOps(paystackClient: PaystackClientLike): {
    customerCreate: (params: PaystackCustomerCreateInput) => Promise<unknown> | undefined;
    customerUpdate: (code: string, params: PaystackCustomerUpdateInput) => Promise<unknown> | undefined;
    transactionInitialize: (body: PaystackTransactionInitializeInput) => Promise<unknown> | undefined;
    transactionVerify: (reference: string) => Promise<unknown> | undefined;
    subscriptionCreate: (body: PaystackSubscriptionCreateInput) => Promise<unknown> | undefined;
    subscriptionDisable: (body: PaystackSubscriptionToggleInput) => Promise<unknown> | undefined;
    subscriptionEnable: (body: PaystackSubscriptionToggleInput) => Promise<unknown> | undefined;
    subscriptionFetch: (idOrCode: string) => Promise<unknown>;
    subscriptionManageLink: (code: string) => Promise<unknown> | undefined;
    subscriptionManageEmail: (code: string, email: string) => Promise<unknown> | undefined;
};
//# sourceMappingURL=paystack-sdk.d.ts.map