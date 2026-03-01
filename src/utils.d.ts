import type { PaystackClientLike, PaystackOptions } from "./types";
export declare function getPlans(subscriptionOptions: PaystackOptions["subscription"]): Promise<import("./types").PaystackPlan<Record<string, unknown>>[]>;
export declare const getPlan: (options: PaystackOptions<PaystackClientLike, any, any>, planId: string) => Promise<import("./types").PaystackPlan<Record<string, unknown>> | null>;
export declare function getPlanByName(options: PaystackOptions<PaystackClientLike, any, any>, name: string): Promise<import("./types").PaystackPlan<Record<string, unknown>> | null>;
export declare function getPlanByPriceId(options: PaystackOptions<PaystackClientLike, any, any>, priceId: string): Promise<import("./types").PaystackPlan<Record<string, unknown>> | null>;
export declare function getProducts(productOptions: PaystackOptions["products"]): Promise<import("./types").InputPaystackProduct[]>;
export declare function getProductByName(options: PaystackOptions<PaystackClientLike, any, any>, name: string): Promise<import("./types").InputPaystackProduct | null>;
export declare function getNextPeriodEnd(startDate: Date, interval: string): Date;
/**
 * Validates if the amount meets Paystack's minimum transaction requirements.
 * Amounts should be in the smallest currency unit (e.g., kobo, cents).
 */
export declare function validateMinAmount(amount: number, currency: string): boolean;
export declare function syncProductQuantityFromPaystack(ctx: any, productName: string, paystackClient: PaystackClientLike): Promise<void>;
/** @deprecated Use syncProductQuantityFromPaystack instead */
export declare function decrementProductQuantity(ctx: any, productName: string): Promise<void>;
export declare function syncSubscriptionSeats(ctx: any, organizationId: string, options: PaystackOptions<PaystackClientLike, any, any>): Promise<void>;
//# sourceMappingURL=utils.d.ts.map