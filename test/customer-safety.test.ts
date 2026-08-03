/* oxlint-disable typescript/require-await, typescript/strict-boolean-expressions */

import { APIError } from "better-auth/api";
import { describe, expect, it, vi } from "vite-plus/test";

import { paystack } from "../src/index";
import type { PaystackClientLike } from "../src/types";

function setup(options: Record<string, unknown> = {}) {
  const records = {
    user: new Map<string, Record<string, unknown>>(),
    organization: new Map<string, Record<string, unknown>>(),
    paystackSubscription: [] as Record<string, unknown>[],
    paystackCustomer: [] as Record<string, unknown>[],
    member: [] as Record<string, unknown>[],
  };
  const adapter = {
    findOne: vi.fn(async ({ model, where }: any) => {
      const values =
        model === "member" || model === "paystackSubscription" || model === "paystackCustomer"
          ? records[model as "member" | "paystackSubscription" | "paystackCustomer"]
          : [...records[model as "user" | "organization"].values()];
      return (
        values.find((row) => where.every((item: any) => row[item.field] === item.value)) ?? null
      );
    }),
    findMany: vi.fn(async ({ model, where }: any) => {
      const values =
        model === "member" || model === "paystackSubscription" || model === "paystackCustomer"
          ? records[model as "member" | "paystackSubscription" | "paystackCustomer"]
          : [...records[model as "user" | "organization"].values()];
      return where
        ? values.filter((row) => where.every((item: any) => row[item.field] === item.value))
        : values;
    }),
    update: vi.fn(async ({ model, where, update }: any) => {
      const record = await adapter.findOne({ model, where });
      if (record) Object.assign(record, update);
      return record;
    }),
    create: vi.fn(async ({ model, data }: any) => {
      const record = { id: data.id ?? `${model}_${Math.random()}`, ...data };
      records[model as "paystackCustomer" | "paystackSubscription"].push(record);
      return record;
    }),
  };
  const client = {
    transaction: {},
    customer: {
      create: vi.fn(),
      fetch: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      create: vi.fn(),
      fetch: vi.fn(),
      disable: vi.fn(),
      enable: vi.fn(),
      manageLink: vi.fn(),
    },
    product: { fetch: vi.fn(), list: vi.fn() },
    plan: { list: vi.fn(), create: vi.fn() },
  } as unknown as PaystackClientLike;
  const logger = { error: vi.fn() };
  const plugin = paystack({
    paystackClient: client,
    createCustomerOnSignUp: true,
    secretKey: "sk_test",
    ...options,
  } as any);
  const hooks = plugin.init?.({
    adapter,
    hasPlugin: () => true,
    logger,
  } as any).options.databaseHooks as any;
  return { adapter, client, hooks, logger, records };
}

describe("customer safety hooks", () => {
  it("does not call Paystack again when the local customer code is already linked", async () => {
    const { client, hooks, records } = setup();
    const user = {
      id: "user_1",
      email: "linked@example.com",
      emailVerified: true,
      paystackCustomerCode: "CUS_linked",
    };
    records.user.set(user.id, user);

    await hooks.user.create.after(user, {} as any);

    expect(client.customer.fetch).not.toHaveBeenCalled();
    expect(client.customer.create).not.toHaveBeenCalled();
  });

  it("reuses and claims an unowned Paystack customer for a verified user", async () => {
    const { client, hooks, records } = setup();
    records.user.set("user_1", {
      id: "user_1",
      email: "verified@example.com",
      emailVerified: true,
    });
    vi.mocked(client.customer.fetch).mockResolvedValue({
      status: true,
      data: {
        customer_code: "CUS_existing",
        email: "verified@example.com",
        metadata: null,
      },
    } as any);

    await hooks.user.create.after(records.user.get("user_1"), {} as any);

    expect(client.customer.create).not.toHaveBeenCalled();
    expect(client.customer.update).toHaveBeenCalledWith("CUS_existing", {
      body: {
        metadata: JSON.stringify({ customerType: "user", userId: "user_1" }),
      },
    });
    expect(records.paystackCustomer.find((row) => row.referenceId === "user_1")?.customerCode).toBe(
      "CUS_existing",
    );
  });

  it("does not link a Paystack customer owned by another reference", async () => {
    const { client, hooks, records, logger } = setup();
    const user = { id: "user_1", email: "same@example.com", emailVerified: true };
    records.user.set(user.id, user);
    vi.mocked(client.customer.fetch).mockResolvedValue({
      status: true,
      data: {
        customer_code: "CUS_other",
        metadata: { customerType: "user", userId: "user_2" },
      },
    } as any);

    await hooks.user.create.after(user, {} as any);

    expect(client.customer.create).not.toHaveBeenCalled();
    expect(records.paystackCustomer.find((row) => row.referenceId === user.id)).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("belongs to another billing reference"),
    );
  });

  it("reuses customers created by older plugin versions and upgrades ownership metadata", async () => {
    const { client, hooks, records } = setup();
    const user = { id: "user_1", email: "legacy@example.com", emailVerified: false };
    records.user.set(user.id, user);
    vi.mocked(client.customer.fetch).mockResolvedValue({
      status: true,
      data: {
        customer_code: "CUS_legacy",
        metadata: JSON.stringify({ userId: "user_1", source: "legacy" }),
      },
    } as any);

    await hooks.user.create.after(user, {} as any);

    expect(client.customer.create).not.toHaveBeenCalled();
    expect(client.customer.update).toHaveBeenCalledWith("CUS_legacy", {
      body: {
        metadata: JSON.stringify({
          userId: "user_1",
          source: "legacy",
          customerType: "user",
        }),
      },
    });
  });

  it("creates a customer after a not-found lookup, but stops on other lookup failures", async () => {
    const notFound = setup();
    const user = { id: "user_1", email: "new@example.com", emailVerified: false };
    notFound.records.user.set(user.id, user);
    vi.mocked(notFound.client.customer.fetch).mockRejectedValue(
      Object.assign(new Error("not found"), { statusCode: 404 }),
    );
    vi.mocked(notFound.client.customer.create).mockResolvedValue({
      status: true,
      data: { customer_code: "CUS_new", email: user.email },
    } as any);

    await notFound.hooks.user.create.after(user, {} as any);
    expect(notFound.client.customer.create).toHaveBeenCalledOnce();

    const failed = setup();
    failed.records.user.set(user.id, user);
    vi.mocked(failed.client.customer.fetch).mockRejectedValue(
      Object.assign(new Error("unavailable"), { statusCode: 503 }),
    );
    await failed.hooks.user.create.after(user, {} as any);
    expect(failed.client.customer.create).not.toHaveBeenCalled();
  });

  it("synchronizes user email changes after local persistence", async () => {
    const { client, hooks, records } = setup();
    records.paystackCustomer.push({
      id: "customer_1",
      referenceType: "user",
      referenceId: "user_1",
      referenceKey: "user:user_1",
      customerCode: "CUS_1",
    });
    await hooks.user.update.after({
      id: "user_1",
      email: "new@example.com",
    });
    expect(client.customer.update).toHaveBeenCalledWith("CUS_1", {
      body: { email: "new@example.com" },
    });
  });

  it("synchronizes organization details and blocks deletion with an active subscription", async () => {
    const { client, hooks, records } = setup({ organization: { enabled: true } });
    records.paystackSubscription.push({
      id: "sub_1",
      referenceId: "org_1",
      status: "active",
    });

    records.paystackCustomer.push({
      id: "customer_org",
      referenceType: "organization",
      referenceId: "org_1",
      referenceKey: "organization:org_1",
      customerCode: "CUS_org",
    });
    await hooks.organization.update.after({
      id: "org_1",
      name: "Renamed",
      email: "billing@example.com",
    });
    expect(client.customer.update).toHaveBeenCalledWith("CUS_org", {
      body: { email: "billing@example.com", first_name: "Renamed" },
    });

    await expect(hooks.organization.delete.before({ id: "org_1" })).rejects.toBeInstanceOf(
      APIError,
    );
    expect(client.customer.fetch).not.toHaveBeenCalled();
  });

  it("blocks organization deletion when Paystack reports an active subscription", async () => {
    const { client, hooks, records } = setup({ organization: { enabled: true } });
    records.paystackCustomer.push({
      id: "customer_org",
      referenceType: "organization",
      referenceId: "org_1",
      referenceKey: "organization:org_1",
      customerCode: "CUS_org",
    });
    vi.mocked(client.customer.fetch).mockResolvedValue({
      status: true,
      data: { customer_code: "CUS_org", subscriptions: [{ status: "trialing" }] },
    } as any);

    await expect(hooks.organization.delete.before({ id: "org_1" })).rejects.toBeInstanceOf(
      APIError,
    );
  });
});
