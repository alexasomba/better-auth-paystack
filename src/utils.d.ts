import type { PaystackOptions } from "./types";
export declare function getPlans(subscriptionOptions: PaystackOptions["subscription"]): Promise<import("./types").PaystackPlan[]>;
export declare function getPlanByName(options: PaystackOptions, name: string): Promise<import("./types").PaystackPlan | undefined>;
//# sourceMappingURL=utils.d.ts.map