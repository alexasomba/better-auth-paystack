import type { PaystackOptions } from "./types";
export declare function getPlans(subscriptionOptions: PaystackOptions["subscription"]): Promise<import("./types").PaystackPlan[]>;
export declare function getPlanByName(options: PaystackOptions<any>, name: string): Promise<import("./types").PaystackPlan | undefined>;
export declare function getProducts(productOptions: PaystackOptions["products"]): Promise<import("./types").PaystackProduct[]>;
export declare function getProductByName(options: PaystackOptions<any>, name: string): Promise<import("./types").PaystackProduct | undefined>;
//# sourceMappingURL=utils.d.ts.map