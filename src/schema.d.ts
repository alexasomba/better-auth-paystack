import type { BetterAuthPluginDBSchema } from "@better-auth/core/db";
import type { PaystackOptions } from "./types";
export declare const transactions: {
    paystackTransaction: {
        fields: {
            reference: {
                type: "string";
                required: true;
            };
            paystackId: {
                type: "string";
                required: false;
            };
            referenceId: {
                type: "string";
                required: true;
            };
            userId: {
                type: "string";
                required: true;
            };
            amount: {
                type: "number";
                required: true;
            };
            currency: {
                type: "string";
                required: true;
            };
            status: {
                type: "string";
                required: true;
            };
            plan: {
                type: "string";
                required: false;
            };
            metadata: {
                type: "string";
                required: false;
            };
            createdAt: {
                type: "date";
                required: true;
            };
            updatedAt: {
                type: "date";
                required: true;
            };
        };
    };
};
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
export declare const organization: {
    organization: {
        fields: {
            paystackCustomerCode: {
                type: "string";
                required: false;
            };
            email: {
                type: "string";
                required: false;
            };
        };
    };
};
export declare const getSchema: (options: PaystackOptions<any>) => BetterAuthPluginDBSchema;
//# sourceMappingURL=schema.d.ts.map