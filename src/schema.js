import { mergeSchema } from "better-auth/db";
export const transactions = {
    paystackTransaction: {
        fields: {
            reference: {
                type: "string",
                required: true,
            },
            paystackId: {
                type: "string",
                required: false,
            },
            referenceId: {
                type: "string",
                required: true,
            },
            userId: {
                type: "string",
                required: true,
            },
            amount: {
                type: "number",
                required: true,
            },
            currency: {
                type: "string",
                required: true,
            },
            status: {
                type: "string",
                required: true,
            },
            plan: {
                type: "string",
                required: false,
            },
            metadata: {
                type: "string",
                required: false,
            },
            createdAt: {
                type: "date",
                required: true,
            },
            updatedAt: {
                type: "date",
                required: true,
            },
        },
    },
};
export const subscriptions = {
    subscription: {
        fields: {
            plan: {
                type: "string",
                required: true,
            },
            referenceId: {
                type: "string",
                required: true,
            },
            paystackCustomerCode: {
                type: "string",
                required: false,
            },
            paystackSubscriptionCode: {
                type: "string",
                required: false,
            },
            paystackTransactionReference: {
                type: "string",
                required: false,
            },
            status: {
                type: "string",
                defaultValue: "incomplete",
            },
            periodStart: {
                type: "date",
                required: false,
            },
            periodEnd: {
                type: "date",
                required: false,
            },
            trialStart: {
                type: "date",
                required: false,
            },
            trialEnd: {
                type: "date",
                required: false,
            },
            cancelAtPeriodEnd: {
                type: "boolean",
                required: false,
                defaultValue: false,
            },
            groupId: {
                type: "string",
                required: false,
            },
            seats: {
                type: "number",
                required: false,
            },
        },
    },
};
export const user = {
    user: {
        fields: {
            paystackCustomerCode: {
                type: "string",
                required: false,
            },
        },
    },
};
export const getSchema = (options) => {
    let baseSchema;
    if (options.subscription?.enabled) {
        baseSchema = {
            ...subscriptions,
            ...transactions,
            ...user,
        };
    }
    else {
        baseSchema = {
            ...user,
            ...transactions,
        };
    }
    if (options.schema &&
        !options.subscription?.enabled &&
        "subscription" in options.schema) {
        const { subscription: _subscription, ...restSchema } = options.schema;
        return mergeSchema(baseSchema, restSchema);
    }
    return mergeSchema(baseSchema, options.schema);
};
