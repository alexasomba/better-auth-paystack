import type { GenericEndpointContext } from "better-auth";
import type { AnyPaystackOptions, PaystackClientLike } from "./types";
export declare function getPlans(subscriptionOptions: AnyPaystackOptions["subscription"]): Promise<import("./types").PaystackPlan<any>[]>;
export declare const getPlan: (options: AnyPaystackOptions, planId: string) => Promise<import("./types").PaystackPlan<any> | null>;
export declare function getPlanByName(options: AnyPaystackOptions, name: string): Promise<import("./types").PaystackPlan<any> | null>;
export declare function getPlanByPriceId(options: AnyPaystackOptions, priceId: string): Promise<import("./types").PaystackPlan<any> | null>;
export declare function getProducts(productOptions: AnyPaystackOptions["products"]): Promise<import("./types").InputPaystackProduct[]>;
export declare function getProductByName(options: AnyPaystackOptions, name: string): Promise<import("./types").InputPaystackProduct | null>;
export declare function getNextPeriodEnd(startDate: Date, interval: string): Date;
/**
 * Validates if the amount meets Paystack's minimum transaction requirements.
 * Amounts should be in the smallest currency unit (e.g., kobo, cents).
 */
export declare function validateMinAmount(amount: number, currency: string): boolean;
export declare function syncProductQuantityFromPaystack(ctx: GenericEndpointContext, productName: string, paystackClient: PaystackClientLike): Promise<void>;
export declare function decrementProductQuantity(ctx: GenericEndpointContext, productName: string): Promise<void>;
export declare function syncSubscriptionSeats(ctx: GenericEndpointContext, organizationId: string, options: AnyPaystackOptions): Promise<void>;
//# sourceMappingURL=utils.d.ts.map