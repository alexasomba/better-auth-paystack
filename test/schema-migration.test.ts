import { describe, expect, it } from "vite-plus/test";

import { migratePaystackSubscriptionSchema } from "../src/migrations.ts";
import { readPaystackPaymentCredentials } from "../src/payment-credentials.ts";
import { getSchema } from "../src/schema.ts";

type Row = Record<string, any>;

function createAdapter(initial: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = { ...initial };
  const adapter = {
    findMany: ({
      model,
      where,
    }: {
      model: string;
      where?: { field: string; value: unknown }[];
    }) => {
      const rows = tables[model] ?? [];
      return where
        ? rows.filter((row) => where.every((clause) => row[clause.field] === clause.value))
        : rows;
    },
    findOne: ({ model, where }: { model: string; where: { field: string; value: unknown }[] }) => {
      const rows = tables[model] ?? [];
      return (
        rows.find((row) => where.every((clause) => row[clause.field] === clause.value)) ?? null
      );
    },
    create: ({
      model,
      data,
      forceAllowId,
    }: {
      model: string;
      data: Row;
      forceAllowId?: boolean;
    }) => {
      const row = {
        ...data,
        id:
          forceAllowId === true && data.id !== undefined
            ? data.id
            : (data.id ?? `${model}_${tables[model]?.length ?? 0}`),
      };
      (tables[model] ??= []).push(row);
      return row;
    },
    update: ({
      model,
      where,
      update,
    }: {
      model: string;
      where: { field: string; value: unknown }[];
      update: Row;
    }) => {
      const row = (tables[model] ?? []).find((candidate) =>
        where.every((clause) => candidate[clause.field] === clause.value),
      );
      if (row) Object.assign(row, update);
      return row ?? null;
    },
  };
  return { adapter, tables };
}

function context(adapter: unknown) {
  return { context: { adapter, logger: { error: () => undefined } } } as any;
}

describe("Paystack subscription schema migration", () => {
  it("exposes only provider-owned Paystack billing models by default", () => {
    const schema = getSchema({
      secretKey: "sk_test",
      subscription: { enabled: true, plans: [] },
    });

    expect(schema.subscription).toBeUndefined();
    expect(schema.paystackSubscription).toBeDefined();
    expect(schema.paystackCustomer).toBeDefined();
    expect(schema.paystackPaymentCredential).toBeDefined();
    expect(schema.paystackSubscription.fields.customerCode).toBeDefined();
    expect(schema.paystackSubscription.fields.userId).toBeDefined();
    expect(schema.paystackSubscription.fields.createdAt).toBeDefined();
    expect(schema.paystackSubscription.fields.updatedAt).toBeDefined();
    expect(schema.paystackSubscription.fields.paystackCustomerCode).toBeUndefined();
    expect(schema.user?.fields.paystackCustomerCode).toBeUndefined();
    expect(schema.organization?.fields.paystackCustomerCode).toBeUndefined();
  });

  it("migrates subscriptions, customers, and encrypted credentials idempotently", async () => {
    const now = new Date();
    const { adapter, tables } = createAdapter({
      subscription: [
        {
          id: "legacy_sub_1",
          plan: "pro",
          referenceId: "user_1",
          userId: "user_1",
          paystackCustomerCode: "CUS_user_1",
          paystackSubscriptionCode: "SUB_1",
          paystackTransactionReference: "ref_1",
          paystackPlanCode: "PLN_1",
          paystackAuthorizationCode: "AUTH_1",
          paystackEmailToken: "TOKEN_1",
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      ],
      user: [{ id: "user_1", email: "user@example.com", paystackCustomerCode: "CUS_user_1" }],
      organization: [{ id: "org_1", email: "org@example.com", paystackCustomerCode: "CUS_org_1" }],
    });
    const options = { secretKey: "sk_test", credentialEncryptionKey: "credential-key" } as any;

    const first = await migratePaystackSubscriptionSchema(context(adapter), options);
    expect(first.status).toBe("complete");
    expect(first.subscriptions.migrated).toBe(1);
    expect(first.customers.migrated).toBe(2);
    expect(first.credentials.migrated).toBe(1);
    expect(tables.paystackSubscription[0]).toMatchObject({
      id: "legacy_sub_1",
      customerCode: "CUS_user_1",
      subscriptionCode: "SUB_1",
      transactionReference: "ref_1",
      planCode: "PLN_1",
    });
    expect(tables.paystackSubscription[0].paystackAuthorizationCode).toBeUndefined();
    expect(tables.paystackPaymentCredential[0].authorizationCodeEncrypted).not.toContain("AUTH_1");
    await expect(
      readPaystackPaymentCredentials(adapter as any, options, "legacy_sub_1"),
    ).resolves.toEqual({ authorizationCode: "AUTH_1", emailToken: "TOKEN_1" });

    const second = await migratePaystackSubscriptionSchema(context(adapter), options);
    expect(second.status).toBe("complete");
    expect(second.subscriptions.skipped).toBe(1);
    expect(second.credentials.skipped).toBe(1);
    expect(tables.subscription).toHaveLength(1);
  });

  it("reports invalid keys without deleting legacy rows and retries credentials later", async () => {
    const { adapter, tables } = createAdapter({
      subscription: [
        {
          id: "legacy_sub_retry",
          plan: "pro",
          referenceId: "user_1",
          userId: "user_1",
          paystackAuthorizationCode: "AUTH_RETRY",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    const failed = await migratePaystackSubscriptionSchema(context(adapter), {
      secretKey: "",
    });
    expect(failed.status).toBe("partial");
    expect(failed.credentials.failed).toBe(1);
    expect(tables.subscription).toHaveLength(1);
    expect(tables.paystackSubscription).toHaveLength(1);

    const retried = await migratePaystackSubscriptionSchema(context(adapter), {
      secretKey: "sk_test",
    });
    expect(retried.status).toBe("complete");
    expect(retried.credentials.migrated).toBe(1);
    await expect(
      readPaystackPaymentCredentials(
        adapter as any,
        { secretKey: "sk_test" } as any,
        "legacy_sub_retry",
      ),
    ).resolves.toEqual({ authorizationCode: "AUTH_RETRY", emailToken: undefined });
  });
});
