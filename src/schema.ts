import type { BetterAuthPluginDBSchema } from "@better-auth/core/db";
import { mergeSchema } from "better-auth/db";
import type { PaystackOptions } from "./types";

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
} satisfies BetterAuthPluginDBSchema;

export const user = {
    user: {
        fields: {
            paystackCustomerCode: {
                type: "string",
                required: false,
            },
        },
    },
} satisfies BetterAuthPluginDBSchema;

export const getSchema = (options: PaystackOptions) => {
    let baseSchema: BetterAuthPluginDBSchema;

    if (options.subscription?.enabled) {
        baseSchema = {
            ...subscriptions,
            ...user,
        };
    } else {
        baseSchema = {
            ...user,
        };
    }

    if (
        options.schema &&
        !options.subscription?.enabled &&
        "subscription" in options.schema
    ) {
        const { subscription: _subscription, ...restSchema } = options.schema as any;
        return mergeSchema(baseSchema, restSchema);
    }

    return mergeSchema(baseSchema, options.schema);
};
