import type { PaystackClientLike } from "./types";
export declare function unwrapSdkResult<T = any>(result: any): T;
export declare function getPaystackOps(paystackClient: PaystackClientLike | any): {
    customerCreate: (params: any) => Promise<any>;
    transactionInitialize: (body: any) => Promise<any>;
    transactionVerify: (reference: string) => Promise<any>;
    subscriptionDisable: (body: {
        code: string;
        token: string;
    }) => Promise<any>;
    subscriptionEnable: (body: {
        code: string;
        token: string;
    }) => Promise<any>;
};
//# sourceMappingURL=paystack-sdk.d.ts.map