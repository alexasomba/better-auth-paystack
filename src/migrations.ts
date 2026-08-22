import type { GenericEndpointContext } from "better-auth";

import type { createBillingStoreFromAdapter } from "./billing-store";
import { LEGACY_PAYSTACK_MODELS, PAYSTACK_MODELS } from "./models";
import { savePaystackPaymentCredentials } from "./payment-credentials";
import type { AnyPaystackOptions } from "./types";

type Adapter = Parameters<typeof createBillingStoreFromAdapter>[0];
type LegacyRecord = Record<string, unknown> & { id?: string | number };

export interface PaystackSchemaMigrationFailure {
  kind: "subscription" | "customer" | "credential";
  id: string;
  message: string;
}

export interface PaystackSchemaMigrationReport {
  status: "complete" | "partial";
  subscriptions: { migrated: number; skipped: number; failed: number };
  customers: { migrated: number; skipped: number; failed: number };
  credentials: { migrated: number; skipped: number; failed: number };
  skipped: number;
  failures: PaystackSchemaMigrationFailure[];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function asIdentifier(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return asString(value);
}

function asDate(value: unknown, fallback: Date): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return fallback;
}

function asOptionalDate(value: unknown): Date | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return undefined;
}

async function findManySafely(adapter: Adapter, model: string): Promise<LegacyRecord[]> {
  try {
    return (await adapter.findMany<LegacyRecord>({ model })) ?? [];
  } catch {
    // The legacy table may already have been removed in a fresh installation.
    return [];
  }
}

function migrationData(legacy: LegacyRecord): Record<string, unknown> {
  const now = new Date();
  const referenceId = asIdentifier(legacy.referenceId) ?? asIdentifier(legacy.userId) ?? "";
  const id = asIdentifier(legacy.id);
  return {
    ...(id !== undefined ? { id } : {}),
    plan: asString(legacy.plan) ?? "",
    referenceId,
    userId: asIdentifier(legacy.userId) ?? referenceId,
    customerCode:
      asString(legacy.customerCode) ?? asString(legacy.paystackCustomerCode) ?? undefined,
    subscriptionCode:
      asString(legacy.subscriptionCode) ?? asString(legacy.paystackSubscriptionCode) ?? undefined,
    transactionReference:
      asString(legacy.transactionReference) ??
      asString(legacy.paystackTransactionReference) ??
      undefined,
    planCode: asString(legacy.planCode) ?? asString(legacy.paystackPlanCode) ?? undefined,
    status: asString(legacy.status) ?? "incomplete",
    periodStart: asDate(legacy.periodStart, now),
    periodEnd: asOptionalDate(legacy.periodEnd),
    trialStart: asOptionalDate(legacy.trialStart),
    trialEnd: asOptionalDate(legacy.trialEnd),
    cancelAtPeriodEnd: legacy.cancelAtPeriodEnd === true,
    cancelAt: asOptionalDate(legacy.cancelAt),
    canceledAt: asOptionalDate(legacy.canceledAt),
    endedAt: asOptionalDate(legacy.endedAt),
    billingInterval: asString(legacy.billingInterval) ?? undefined,
    groupId: asString(legacy.groupId) ?? undefined,
    seats: typeof legacy.seats === "number" ? legacy.seats : undefined,
    pendingPlan: asString(legacy.pendingPlan) ?? undefined,
    createdAt: asDate(legacy.createdAt, now),
    updatedAt: asDate(legacy.updatedAt, now),
  };
}

async function migrateCustomer(
  adapter: Adapter,
  referenceType: "user" | "organization",
  legacy: LegacyRecord,
  report: PaystackSchemaMigrationReport,
): Promise<void> {
  const customerCode = asString(legacy.paystackCustomerCode) ?? asString(legacy.customerCode);
  const referenceId = asIdentifier(legacy.id);
  if (customerCode === undefined || referenceId === undefined) return;
  const referenceKey = `${referenceType}:${referenceId}`;
  try {
    const existing = await adapter.findOne<LegacyRecord>({
      model: PAYSTACK_MODELS.customer,
      where: [{ field: "referenceKey", value: referenceKey }],
    });
    if (existing) {
      report.customers.skipped += 1;
      report.skipped += 1;
      return;
    }
    const now = new Date();
    const email = asString(legacy.email);
    await adapter.create({
      model: PAYSTACK_MODELS.customer,
      data: {
        referenceType,
        referenceId,
        referenceKey,
        customerCode,
        ...(email !== undefined ? { email } : {}),
        createdAt: asDate(legacy.createdAt, now),
        updatedAt: asDate(legacy.updatedAt, now),
      },
    });
    report.customers.migrated += 1;
  } catch (error) {
    report.customers.failed += 1;
    report.failures.push({
      kind: "customer",
      id: referenceKey,
      message: error instanceof Error ? error.message : "Failed to migrate customer",
    });
  }
}

export async function migratePaystackSubscriptionSchema(
  ctx: GenericEndpointContext,
  options: AnyPaystackOptions,
): Promise<PaystackSchemaMigrationReport> {
  const adapter = ctx.context.adapter;
  const report: PaystackSchemaMigrationReport = {
    status: "complete",
    subscriptions: { migrated: 0, skipped: 0, failed: 0 },
    customers: { migrated: 0, skipped: 0, failed: 0 },
    credentials: { migrated: 0, skipped: 0, failed: 0 },
    skipped: 0,
    failures: [],
  };

  for (const referenceType of ["user", "organization"] as const) {
    const records = await findManySafely(adapter, referenceType);
    for (const record of records) await migrateCustomer(adapter, referenceType, record, report);
  }

  const legacySubscriptions = await findManySafely(adapter, LEGACY_PAYSTACK_MODELS.subscription);
  for (const legacy of legacySubscriptions) {
    const id = asIdentifier(legacy.id);
    if (id === undefined) continue;
    try {
      const existing = await adapter.findOne<LegacyRecord>({
        model: PAYSTACK_MODELS.subscription,
        where: [{ field: "id", value: id }],
      });
      if (existing) {
        report.subscriptions.skipped += 1;
        report.skipped += 1;
      } else {
        await adapter.create({
          model: PAYSTACK_MODELS.subscription,
          data: migrationData(legacy),
          forceAllowId: true,
        });
        report.subscriptions.migrated += 1;
      }
    } catch (error) {
      report.subscriptions.failed += 1;
      report.failures.push({
        kind: "subscription",
        id,
        message: error instanceof Error ? error.message : "Failed to migrate subscription",
      });
    }

    const authorizationCode =
      asString(legacy.authorizationCode) ?? asString(legacy.paystackAuthorizationCode);
    const emailToken = asString(legacy.emailToken) ?? asString(legacy.paystackEmailToken);
    if (authorizationCode !== undefined || emailToken !== undefined) {
      try {
        const existingCredential = await adapter.findOne<LegacyRecord>({
          model: PAYSTACK_MODELS.paymentCredential,
          where: [{ field: "subscriptionId", value: id }],
        });
        if (existingCredential) {
          report.credentials.skipped += 1;
          report.skipped += 1;
        } else {
          await savePaystackPaymentCredentials(adapter, options, id, {
            authorizationCode,
            emailToken,
          });
          report.credentials.migrated += 1;
        }
      } catch (error) {
        report.credentials.failed += 1;
        report.failures.push({
          kind: "credential",
          id,
          message: error instanceof Error ? error.message : "Failed to migrate credential",
        });
      }
    }
  }

  report.status = report.failures.length > 0 ? "partial" : "complete";
  return report;
}
