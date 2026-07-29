/* oxlint-disable no-restricted-imports */
import { z } from "zod";

export const initializeTransactionBodySchema: z.ZodObject<{
  plan: z.ZodOptional<z.ZodString>;
  product: z.ZodOptional<z.ZodString>;
  amount: z.ZodOptional<z.ZodNumber>;
  currency: z.ZodOptional<z.ZodString>;
  email: z.ZodOptional<z.ZodString>;
  metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
  referenceId: z.ZodOptional<z.ZodString>;
  subscriptionId: z.ZodOptional<z.ZodString>;
  callbackURL: z.ZodOptional<z.ZodString>;
  quantity: z.ZodOptional<z.ZodNumber>;
  scheduleAtPeriodEnd: z.ZodOptional<z.ZodBoolean>;
  cancelAtPeriodEnd: z.ZodOptional<z.ZodBoolean>;
  prorateAndCharge: z.ZodOptional<z.ZodBoolean>;
}> = z.object({
  plan: z.string().optional(),
  product: z.string().optional(),
  amount: z.number().int().positive().optional(),
  currency: z.string().optional(),
  email: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  referenceId: z.string().optional(),
  subscriptionId: z.string().optional(),
  callbackURL: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  scheduleAtPeriodEnd: z.boolean().optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  prorateAndCharge: z.boolean().optional(),
});
