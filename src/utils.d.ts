import type { GenericEndpointContext, PaystackClientLike, PaystackOptions, PaystackProduct } from "./types";
export declare function getPlans(subscriptionOptions: PaystackOptions["subscription"]): Promise<import("./types").PaystackPlan[]>;
export declare const getPlan: (options: PaystackOptions<PaystackClientLike>, planId: string) => Promise<import("./types").PaystackPlan | null>;
export declare function getPlanByName(options: PaystackOptions<PaystackClientLike>, name: string): Promise<import("./types").PaystackPlan | null>;
export declare function getPlanByPriceId(options: PaystackOptions<PaystackClientLike>, priceId: string): Promise<import("./types").PaystackPlan | null>;
export declare function getProducts(productOptions: PaystackOptions["products"]): Promise<PaystackProduct[]>;
export declare function getProductByName(options: PaystackOptions<PaystackClientLike>, name: string): Promise<PaystackProduct | null>;
export declare function getNextPeriodEnd(startDate: Date, interval: string): Date;
/**
 * Validates if the amount meets Paystack's minimum transaction requirements.
 * Amounts should be in the smallest currency unit (e.g., kobo, cents).
 */
export declare function validateMinAmount(amount: number, currency: string): boolean;
export declare function syncProductQuantityFromPaystack(ctx: GenericEndpointContext, productName: string, paystackClient: PaystackClientLike): Promise<void>;
/** @deprecated Use syncProductQuantityFromPaystack instead */
export declare function decrementProductQuantity(ctx: GenericEndpointContext, productName: string): Promise<void>;
//# sourceMappingURL=utils.d.ts.map