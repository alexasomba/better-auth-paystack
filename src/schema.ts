import type { BetterAuthPluginDBSchema } from "@better-auth/core/db";
import { mergeSchema } from "better-auth/db";

import type { PaystackOptions } from "./types";

export const transactions: BetterAuthPluginDBSchema = {
  paystackTransaction: {
    fields: {
      reference: {
        type: "string",
        required: true,
        unique: true,
      },
      paystackId: {
        type: "string",
        required: false,
      },
      referenceId: {
        type: "string",
        required: true,
        index: true,
      },
      userId: {
        type: "string",
        required: true,
        index: true,
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
      product: {
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
} satisfies BetterAuthPluginDBSchema;

export const subscriptions: BetterAuthPluginDBSchema = {
  subscription: {
    fields: {
      plan: {
        type: "string",
        required: true,
        index: true,
      },
      referenceId: {
        type: "string",
        required: true,
        index: true,
      },
      paystackCustomerCode: {
        type: "string",
        required: false,
        index: true,
      },
      paystackSubscriptionCode: {
        type: "string",
        required: false,
        unique: true,
      },
      paystackTransactionReference: {
        type: "string",
        required: false,
        index: true,
      },
      paystackAuthorizationCode: {
        type: "string",
        required: false,
      },
      paystackEmailToken: {
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
      pendingPlan: {
        type: "string",
        required: false,
      },
    },
  },
} satisfies BetterAuthPluginDBSchema;

export const user: BetterAuthPluginDBSchema = {
  user: {
    fields: {
      paystackCustomerCode: {
        type: "string",
        required: false,
        index: true,
      },
    },
  },
} satisfies BetterAuthPluginDBSchema;

export const organization: BetterAuthPluginDBSchema = {
  organization: {
    fields: {
      paystackCustomerCode: {
        type: "string",
        required: false,
        index: true,
      },
      email: {
        type: "string",
        required: false,
      },
    },
  },
} satisfies BetterAuthPluginDBSchema;

export const products: BetterAuthPluginDBSchema = {
  paystackProduct: {
    fields: {
      name: {
        type: "string",
        required: true,
      },
      description: {
        type: "string",
        required: false,
      },
      price: {
        type: "number",
        required: true,
      },
      currency: {
        type: "string",
        required: true,
      },
      quantity: {
        type: "number",
        required: false,
        defaultValue: 0,
      },
      unlimited: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      paystackId: {
        type: "string",
        required: false,
        unique: true,
      },
      slug: {
        type: "string",
        required: true,
        unique: true,
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
} satisfies BetterAuthPluginDBSchema;

export const plans: BetterAuthPluginDBSchema = {
  paystackPlan: {
    fields: {
      name: {
        type: "string",
        required: true,
      },
      description: {
        type: "string",
        required: false,
      },
      amount: {
        type: "number",
        required: true,
      },
      currency: {
        type: "string",
        required: true,
      },
      interval: {
        type: "string",
        required: true,
      },
      planCode: {
        type: "string",
        required: true,
        unique: true,
      },
      paystackId: {
        type: "string",
        required: true,
        unique: true,
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
} satisfies BetterAuthPluginDBSchema;

export const getSchema = (options: PaystackOptions): BetterAuthPluginDBSchema => {
  let baseSchema: BetterAuthPluginDBSchema;

  if (options.subscription?.enabled === true) {
    baseSchema = {
      ...subscriptions,
      ...transactions,
      ...user,
      ...products,
      ...plans,
    };
  } else {
    baseSchema = {
      ...user,
      ...transactions,
      ...products,
      ...plans,
    };
  }

  // Add organization schema if organization support is enabled
  if (options.organization?.enabled === true) {
    baseSchema = {
      ...baseSchema,
      ...organization,
    };
  }

  if (
    options.schema !== undefined &&
    options.subscription?.enabled !== true &&
    "subscription" in options.schema
  ) {
    const { subscription: _subscription, ...restSchema } = options.schema;
    return mergeSchema(baseSchema, restSchema);
  }

  return mergeSchema(baseSchema, options.schema);
};
