import { mergeSchema, type BetterAuthPluginDBSchema, type DBFieldAttribute } from "better-auth/db";

import type { PaystackOptions } from "./types";

type PluginSchemaTable<TableName extends string, FieldName extends string> = Record<
  TableName,
  {
    fields: Record<FieldName, DBFieldAttribute>;
    disableMigration?: boolean;
    modelName?: string;
  }
>;

type TransactionsSchema = PluginSchemaTable<
  "paystackTransaction",
  | "reference"
  | "paystackId"
  | "referenceId"
  | "userId"
  | "amount"
  | "currency"
  | "status"
  | "plan"
  | "product"
  | "metadata"
  | "createdAt"
  | "updatedAt"
>;

type SubscriptionsSchema = PluginSchemaTable<
  "subscription",
  | "plan"
  | "referenceId"
  | "paystackCustomerCode"
  | "paystackSubscriptionCode"
  | "paystackTransactionReference"
  | "paystackAuthorizationCode"
  | "paystackEmailToken"
  | "status"
  | "periodStart"
  | "periodEnd"
  | "trialStart"
  | "trialEnd"
  | "cancelAtPeriodEnd"
  | "cancelAt"
  | "canceledAt"
  | "endedAt"
  | "billingInterval"
  | "groupId"
  | "seats"
  | "pendingPlan"
>;

type UserSchema = PluginSchemaTable<"user", "paystackCustomerCode">;

type OrganizationSchema = PluginSchemaTable<"organization", "paystackCustomerCode" | "email">;

type ProductsSchema = PluginSchemaTable<
  "paystackProduct",
  | "name"
  | "description"
  | "price"
  | "currency"
  | "quantity"
  | "unlimited"
  | "paystackId"
  | "slug"
  | "metadata"
  | "createdAt"
  | "updatedAt"
>;

type PlansSchema = PluginSchemaTable<
  "paystackPlan",
  | "name"
  | "description"
  | "amount"
  | "currency"
  | "interval"
  | "group"
  | "planCode"
  | "paystackId"
  | "metadata"
  | "createdAt"
  | "updatedAt"
>;

export type PaystackPluginSchema = SubscriptionsSchema &
  TransactionsSchema &
  UserSchema &
  OrganizationSchema &
  ProductsSchema &
  PlansSchema;

const transactionsSchema: TransactionsSchema = {
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

export const transactions: typeof transactionsSchema = transactionsSchema;

const subscriptionsSchema: SubscriptionsSchema = {
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
      cancelAt: {
        type: "date",
        required: false,
      },
      canceledAt: {
        type: "date",
        required: false,
      },
      endedAt: {
        type: "date",
        required: false,
      },
      billingInterval: {
        type: "string",
        required: false,
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

export const subscriptions: typeof subscriptionsSchema = subscriptionsSchema;

const userSchema: UserSchema = {
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

export const user: typeof userSchema = userSchema;

const organizationSchema: OrganizationSchema = {
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

export const organization: typeof organizationSchema = organizationSchema;

const productsSchema: ProductsSchema = {
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

export const products: typeof productsSchema = productsSchema;

const plansSchema: PlansSchema = {
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
      group: {
        type: "string",
        required: false,
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

export const plans: typeof plansSchema = plansSchema;

const paystackPluginSchemaDefinition: PaystackPluginSchema = {
  ...subscriptions,
  ...transactions,
  ...user,
  ...organization,
  ...products,
  ...plans,
} satisfies BetterAuthPluginDBSchema;

export const paystackPluginSchema: typeof paystackPluginSchemaDefinition =
  paystackPluginSchemaDefinition;

export const getSchema = (options: PaystackOptions): BetterAuthPluginDBSchema => {
  let baseSchema: BetterAuthPluginDBSchema;
  const optionSchema = options.schema as Parameters<typeof mergeSchema>[1];

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
    const { subscription: _subscription, ...restSchema } = optionSchema ?? {};
    return mergeSchema(baseSchema, restSchema);
  }

  return mergeSchema(baseSchema, optionSchema);
};
