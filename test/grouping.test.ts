import { describe, expect, it, vi } from "vite-plus/test";

import { createBillingStoreFromAdapter } from "../src/billing-store.ts";
import { getOrganizationEntitlements } from "../src/limits.ts";
import { scheduleSubscriptionLifecycleChange } from "../src/subscription-lifecycle.ts";
import type { PaystackOptions, Subscription } from "../src/types.ts";
import { normalizeSubscriptionGroup } from "../src/utils.ts";

function subscription(
  id: string,
  plan: string,
  groupId: string | null,
  status = "active",
): Subscription {
  const now = new Date();
  return {
    id,
    userId: "owner",
    plan,
    referenceId: "org_1",
    groupId,
    status,
    seats: 1,
    cancelAtPeriodEnd: false,
    createdAt: now,
    updatedAt: now,
  };
}

function createAdapter(rows: Subscription[]) {
  return {
    findMany: vi.fn(({ model }: { model: string }) =>
      Promise.resolve(model === "paystackSubscription" ? rows : []),
    ),
    findOne: vi.fn(({ model, where }: { model: string; where: { value: unknown }[] }) =>
      Promise.resolve(
        model === "paystackSubscription"
          ? (rows.find((candidate) => candidate.id === where[0]?.value) ?? null)
          : null,
      ),
    ),
    create: vi.fn(),
    update: vi.fn(({ where, update }) => {
      const id = where[0]?.value;
      const row = rows.find((candidate) => candidate.id === id);
      if (row) Object.assign(row, update);
      return Promise.resolve(row ?? null);
    }),
  } as any;
}

describe("subscription groups", () => {
  it("keeps missing groups in the legacy default group", async () => {
    const rows = [
      subscription("default", "starter", null),
      subscription("support", "support", "support"),
    ];
    const store = createBillingStoreFromAdapter(createAdapter(rows));

    expect(normalizeSubscriptionGroup(" Support ")).toBe("support");
    expect(normalizeSubscriptionGroup(" ")).toBeNull();
    expect((await store.findCurrentSubscription("org_1", null))?.id).toBe("default");
    expect((await store.findCurrentSubscription("org_1", "support"))?.id).toBe("support");
  });

  it("retires only active subscriptions in the same group", async () => {
    const rows = [
      subscription("old", "starter", "workspace"),
      subscription("new", "pro", "workspace"),
      subscription("support", "support", "support"),
    ];
    const store = createBillingStoreFromAdapter(createAdapter(rows));

    await store.retireCompetingSubscriptions("org_1", "workspace", "new");

    expect(rows.find((row) => row.id === "old")?.status).toBe("canceled");
    expect(rows.find((row) => row.id === "old")?.endedAt).toBeInstanceOf(Date);
    expect(rows.find((row) => row.id === "support")?.status).toBe("active");
  });

  it("treats an explicitly selected subscription as authoritative", async () => {
    const rows = [
      subscription("older", "starter", "workspace"),
      subscription("selected", "pro", "workspace"),
    ];
    const adapter = createAdapter(rows);
    const ctx = {
      context: {
        adapter,
        logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      },
    } as any;

    await scheduleSubscriptionLifecycleChange(ctx, {
      referenceId: "org_1",
      subscriptionId: "selected",
      plan: { name: "enterprise", group: "workspace" },
      scheduleAtPeriodEnd: true,
    });

    expect(rows.find((row) => row.id === "selected")?.pendingPlan).toBe("enterprise");
    expect(rows.find((row) => row.id === "older")?.pendingPlan).toBeUndefined();
  });

  it("merges organization entitlements using maximum limits and feature union", async () => {
    const rows = [
      subscription("workspace", "workspace", "workspace"),
      subscription("support", "support", "support", "trialing"),
    ];
    const adapter = createAdapter(rows);
    const ctx = {
      context: {
        adapter,
        logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      },
    } as any;
    const options = {
      secretKey: "sk_test",
      subscription: {
        enabled: true,
        plans: [
          { name: "workspace", limits: { teams: 3, storage: 10 }, features: ["projects"] },
          { name: "support", limits: { teams: 8 }, features: ["priority-support"] },
        ],
      },
    } as PaystackOptions;

    await expect(getOrganizationEntitlements(ctx, "org_1", options)).resolves.toEqual({
      limits: { teams: 8, storage: 10 },
      features: ["projects", "priority-support"],
    });
  });
});
