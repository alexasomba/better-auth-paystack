import type { BetterAuthPluginDBSchema } from "@better-auth/core/db";
import type { PaystackOptions } from "./types";
export declare const subscriptions: {
    subscription: {
        fields: {
            plan: {
                type: "string";
                required: true;
            };
            referenceId: {
                type: "string";
                required: true;
            };
            paystackCustomerCode: {
                type: "string";
                required: false;
            };
            paystackSubscriptionCode: {
                type: "string";
                required: false;
            };
            paystackTransactionReference: {
                type: "string";
                required: false;
            };
            status: {
                type: "string";
                defaultValue: string;
            };
            periodStart: {
                type: "date";
                required: false;
            };
            periodEnd: {
                type: "date";
                required: false;
            };
            trialStart: {
                type: "date";
                required: false;
            };
            trialEnd: {
                type: "date";
                required: false;
            };
            cancelAtPeriodEnd: {
                type: "boolean";
                required: false;
                defaultValue: false;
            };
            groupId: {
                type: "string";
                required: false;
            };
            seats: {
                type: "number";
                required: false;
            };
        };
    };
};
export declare const user: {
    user: {
        fields: {
            paystackCustomerCode: {
                type: "string";
                required: false;
            };
        };
    };
};
export declare const getSchema: (options: PaystackOptions) => BetterAuthPluginDBSchema;
//# sourceMappingURL=schema.d.ts.map