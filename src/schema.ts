import type { BetterAuthPluginDBSchema } from "@better-auth/core/db";
import { mergeSchema } from "better-auth/db";

import type { PaystackClientLike, PaystackOptions } from "./types";

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
} satisfies BetterAuthPluginDBSchema;

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

export const organization = {
	organization: {
		fields: {
			paystackCustomerCode: {
				type: "string",
				required: false,
			},
			email: {
				type: "string",
				required: false,
			},
		},
	},
} satisfies BetterAuthPluginDBSchema;

export const getSchema = (options: PaystackOptions<PaystackClientLike>) => {
	let baseSchema: BetterAuthPluginDBSchema;

	if (options.subscription?.enabled === true) {
		baseSchema = {
			...subscriptions,
			...transactions,
			...user,
		};
	} else {
		baseSchema = {
			...user,
			...transactions,
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
		const { subscription: _subscription, ...restSchema } = options.schema as Record<string, unknown>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return mergeSchema(baseSchema, restSchema as any);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return mergeSchema(baseSchema, options.schema as any);
};
