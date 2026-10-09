/* oxlint-disable typescript/no-explicit-any, typescript/strict-boolean-expressions */
import { createHmac } from "node:crypto";

import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, it, vi } from "vite-plus/test";

import { paystack, reconcilePaystackTransaction } from "../src/index.ts";

async function setup(extra: any = {}) {
  const data: Record<string, any[]> = Object.fromEntries(
    [
      "user",
      "session",
      "verification",
      "account",
      "paystackSubscription",
      "paystackTransaction",
      "paystackWebhookEvent",
      "paystackCustomer",
      "paystackProduct",
      "paystackPlan",
      "paystackPaymentCredential",
    ].map((k) => [k, []]),
  );
  const client = {
    transaction: {
      verify: vi.fn(),
      initialize: vi.fn().mockResolvedValue({
        data: {
          status: true,
          data: {
            authorization_url: "https://paystack.test/pay",
            reference: "new-ref",
            access_code: "code",
          },
        },
      }),
    },
  };
  const options = { secretKey: "sk_test", paystackClient: client, ...extra };
  const plugin = paystack(options);
  const auth = betterAuth({
    baseURL: "http://localhost:3000",
    database: memoryAdapter(data),
    emailAndPassword: { enabled: true },
    plugins: [plugin],
  });
  const context = await auth.$context;
  const user = {
    id: "u1",
    name: "Buyer",
    email: "buyer@test.com",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  data.user.push(user);
  const ctx = {
    context: { ...context, session: { user, session: { id: "s1", userId: "u1" } } },
    headers: new Headers(),
  } as any;
  const deliver = (reference = "ref") => {
    const payload = JSON.stringify({ event: "charge.success", data: { reference, id: 1 } });
    return auth.handler(
      new Request("http://localhost:3000/api/auth/paystack/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-paystack-signature": createHmac("sha512", "sk_test").update(payload).digest("hex"),
        },
        body: payload,
      }),
    );
  };
  return { data, client, options, plugin, auth, context, ctx, deliver };
}
describe("payment integrity", () => {
  it("charges the configured plan amount and currency despite client overrides", async () => {
    const s = await setup({
      subscription: {
        enabled: true,
        plans: [{ name: "pro", amount: 100000, currency: "NGN", interval: "monthly" }],
      },
    });
    await s.plugin.endpoints.initializeTransaction({
      ...s.ctx,
      body: { plan: "pro", amount: 5000, currency: "USD" },
    });
    expect(s.client.transaction.initialize.mock.calls[0]?.[0].body).toMatchObject({
      amount: 100000,
      currency: "NGN",
    });
  });
  it("does not reactivate a canceled subscription or reset an active period on payment replay", async () => {
    const s = await setup({
      subscription: {
        enabled: true,
        plans: [{ name: "pro", amount: 100000, currency: "NGN", interval: "monthly" }],
      },
    });
    const old = {
      id: "old",
      referenceId: "u1",
      plan: "pro",
      status: "canceled",
      transactionReference: "old-ref",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const current = {
      ...old,
      id: "new",
      status: "active",
      transactionReference: "new-ref",
      periodStart: new Date("2026-09-01"),
      periodEnd: new Date("2026-10-01"),
    };
    s.data.paystackSubscription.push(old, current);
    s.data.paystackTransaction.push({
      id: "tx",
      reference: "old-ref",
      referenceId: "u1",
      status: "success",
      plan: "pro",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    s.client.transaction.verify.mockResolvedValue({
      data: {
        status: true,
        data: { reference: "old-ref", status: "success", amount: 100000, currency: "NGN" },
      },
    });
    await reconcilePaystackTransaction(s.ctx, s.options, { reference: "old-ref" });
    expect(old.status).toBe("canceled");
    expect(current.status).toBe("active");
  });
  it("returns a retryable error on database failure and retries the event", async () => {
    const s = await setup();
    s.data.paystackTransaction.push({
      id: "tx",
      reference: "ref",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const original = s.context.adapter.update.bind(s.context.adapter);
    vi.spyOn(s.context.adapter, "update").mockImplementationOnce(() => {
      throw new Error("database unavailable");
    });
    const first = await s.deliver();
    expect(first.status).toBeGreaterThanOrEqual(500);
    s.context.adapter.update = original;
    expect((await s.deliver()).status).toBe(200);
    expect(s.data.paystackTransaction[0]?.status).toBe("success");
  });
  it("retries an application event callback after failure", async () => {
    const onEvent = vi
      .fn()
      .mockRejectedValueOnce(new Error("fulfillment unavailable"))
      .mockResolvedValue(undefined);
    const s = await setup({ onEvent });
    expect((await s.deliver()).status).toBe(503);
    expect(s.data.paystackWebhookEvent[0]?.status).toBe("pending");
    expect((await s.deliver()).status).toBe(200);
    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(s.data.paystackWebhookEvent[0]?.status).toBe("processed");
  });
  it("claims webhook processing across concurrent deliveries and retries failed callbacks", async () => {
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const onEvent = vi
      .fn()
      .mockImplementationOnce(() => hold)
      .mockResolvedValue(undefined);
    const s = await setup({ onEvent });
    const first = s.deliver();
    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(1));
    const second = await s.deliver();
    release();
    await first;
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(second.status).toBeGreaterThanOrEqual(500);
    expect((await s.deliver()).status).toBe(200);
  });
});
