import type { BetterAuthPluginDBSchema } from "@better-auth/core/db";
import type { PaystackClientLike, PaystackOptions } from "./types";
export declare const transactions: {
    paystackTransaction: {
        fields: {
            reference: {
                type: "string";
                required: true;
                unique: true;
            };
            paystackId: {
                type: "string";
                required: false;
            };
            referenceId: {
                type: "string";
                required: true;
                index: true;
            };
            userId: {
                type: "string";
                required: true;
                index: true;
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
            product: {
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
                index: true;
            };
            referenceId: {
                type: "string";
                required: true;
                index: true;
            };
            paystackCustomerCode: {
                type: "string";
                required: false;
                index: true;
            };
            paystackSubscriptionCode: {
                type: "string";
                required: false;
                unique: true;
            };
            paystackTransactionReference: {
                type: "string";
                required: false;
                index: true;
            };
            paystackAuthorizationCode: {
                type: "string";
                required: false;
            };
            paystackEmailToken: {
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
                index: true;
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
                index: true;
            };
            email: {
                type: "string";
                required: false;
            };
        };
    };
};
export declare const products: {
    paystackProduct: {
        fields: {
            name: {
                type: "string";
                required: true;
            };
            description: {
                type: "string";
                required: false;
            };
            price: {
                type: "number";
                required: true;
            };
            currency: {
                type: "string";
                required: true;
            };
            quantity: {
                type: "number";
                required: false;
                defaultValue: number;
            };
            unlimited: {
                type: "boolean";
                required: false;
                defaultValue: true;
            };
            paystackId: {
                type: "string";
                required: false;
                unique: true;
            };
            slug: {
                type: "string";
                required: true;
                unique: true;
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
export declare const getSchema: (options: PaystackOptions<PaystackClientLike>) => BetterAuthPluginDBSchema;
//# sourceMappingURL=schema.d.ts.map