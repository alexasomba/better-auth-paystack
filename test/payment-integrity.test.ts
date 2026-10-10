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
  it("recovers a failed trial-start webhook callback after trial activation", async () => {
    const onTrialStart = vi
      .fn()
      .mockRejectedValueOnce(new Error("delivery failed"))
      .mockResolvedValue(undefined);
    const s = await setup({
      subscription: {
        enabled: true,
        plans: [
          { name: "pro", amount: 100000, currency: "NGN", freeTrial: { days: 7, onTrialStart } },
        ],
      },
    });
    s.data.paystackSubscription.push({
      id: "sub",
      referenceId: "u1",
      plan: "pro",
      status: "incomplete",
      transactionReference: "ref",
      trialStart: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect((await s.deliver()).status).toBe(503);
    expect(s.data.paystackSubscription[0]?.status).toBe("trialing");
    expect((await s.deliver()).status).toBe(200);
    expect(onTrialStart).toHaveBeenCalledTimes(2);
  });
  async function subscriptionPayment(hooks: any) {
    const s = await setup({
      onEvent: async () => {
        await reconcilePaystackTransaction(s.ctx, s.options, {
          reference: "ref",
          source: "webhook",
        });
      },
      subscription: {
        enabled: true,
        plans: [{ name: "pro", amount: 100000, currency: "NGN", interval: "monthly" }],
        ...hooks,
      },
    });
    s.data.paystackSubscription.push({
      id: "sub",
      referenceId: "u1",
      plan: "pro",
      status: "incomplete",
      transactionReference: "ref",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    s.data.paystackTransaction.push({
      id: "tx",
      reference: "ref",
      referenceId: "u1",
      userId: "u1",
      plan: "pro",
      amount: 100000,
      currency: "NGN",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    s.client.transaction.verify.mockResolvedValue({
      data: {
        status: true,
        data: { reference: "ref", status: "success", amount: 100000, currency: "NGN" },
      },
    });
    return s;
  }
  it.each([{ reference: "another-payment" }, { amount: 5000 }, { currency: "USD" }])(
    "rejects verified payments that differ from the stored intent: %j",
    async (mismatch) => {
      const onSubscriptionComplete = vi.fn();
      const s = await subscriptionPayment({ onSubscriptionComplete });
      s.client.transaction.verify.mockResolvedValue({
        data: {
          status: true,
          data: {
            reference: "ref",
            status: "success",
            amount: 100000,
            currency: "NGN",
            ...mismatch,
          },
        },
      });
      const result = await reconcilePaystackTransaction(s.ctx, s.options, { reference: "ref" });
      expect(result.ok).toBe(false);
      expect(s.data.paystackSubscription[0]?.status).toBe("incomplete");
      expect(s.data.paystackTransaction[0]).toMatchObject({
        status: "pending",
        amount: 100000,
        currency: "NGN",
      });
      expect(onSubscriptionComplete).not.toHaveBeenCalled();
    },
  );
  it("retries a failed completion hook after the subscription becomes active", async () => {
    const onSubscriptionComplete = vi
      .fn()
      .mockRejectedValueOnce(new Error("delivery failed"))
      .mockResolvedValue(undefined);
    const onSubscriptionUpdate = vi.fn();
    const s = await subscriptionPayment({ onSubscriptionComplete, onSubscriptionUpdate });
    expect((await s.deliver()).status).toBe(503);
    expect(s.data.paystackSubscription[0]?.status).toBe("active");
    const startedAt = s.data.paystackSubscription[0]?.periodStart;
    expect((await s.deliver()).status).toBe(200);
    expect(onSubscriptionComplete).toHaveBeenCalledTimes(2);
    expect(onSubscriptionUpdate).toHaveBeenCalledOnce();
    expect(s.data.paystackSubscription[0]?.periodStart).toEqual(startedAt);
    await reconcilePaystackTransaction(s.ctx, s.options, { reference: "ref", source: "queue" });
    expect(onSubscriptionComplete).toHaveBeenCalledTimes(2);
    expect(onSubscriptionUpdate).toHaveBeenCalledOnce();
  });
  it("persists the required journal event type before activating a subscription", async () => {
    const complete = vi.fn();
    const s = await subscriptionPayment({ onSubscriptionComplete: complete });
    const original = s.context.adapter.create.bind(s.context.adapter);
    vi.spyOn(s.context.adapter, "create").mockImplementation(async (input: any) => {
      if (input.model === "paystackWebhookEvent") {
        if (typeof input.data.eventType !== "string")
          throw new Error("NOT NULL constraint failed: paystack_webhook_event.event_type");
        expect(s.data.paystackSubscription[0]?.status).toBe("incomplete");
      }
      return original(input);
    });
    await reconcilePaystackTransaction(s.ctx, s.options, { reference: "ref" });
    expect(s.data.paystackSubscription[0]?.status).toBe("active");
    expect(s.data.paystackWebhookEvent[0]).toMatchObject({
      eventType: "subscription.fulfillment",
      status: "processed",
    });
    expect(complete).toHaveBeenCalledOnce();
  });
  it("recovers credential persistence after activation before completing hooks", async () => {
    const complete = vi.fn();
    const s = await subscriptionPayment({ onSubscriptionComplete: complete });
    s.client.transaction.verify.mockResolvedValue({
      data: {
        status: true,
        data: {
          reference: "ref",
          status: "success",
          amount: 100000,
          currency: "NGN",
          authorization: { authorization_code: "AUTH_fixture" },
        },
      },
    });
    const original = s.context.adapter.create.bind(s.context.adapter);
    let fail = true;
    vi.spyOn(s.context.adapter, "create").mockImplementation(async (input: any) => {
      if (input.model === "paystackPaymentCredential" && fail) {
        fail = false;
        throw new Error("credential write failed");
      }
      return original(input);
    });
    await expect(
      reconcilePaystackTransaction(s.ctx, s.options, { reference: "ref" }),
    ).rejects.toThrow();
    expect(s.data.paystackSubscription[0]?.status).toBe("active");
    expect(complete).not.toHaveBeenCalled();
    await reconcilePaystackTransaction(s.ctx, s.options, { reference: "ref" });
    expect(s.data.paystackPaymentCredential).toHaveLength(1);
    expect(complete).toHaveBeenCalledOnce();
  });
  it("does not overwrite a cancellation that races with activation", async () => {
    const s = await subscriptionPayment({});
    const original = s.context.adapter.update.bind(s.context.adapter);
    vi.spyOn(s.context.adapter, "update").mockImplementation(async (input: any) => {
      if (input.model === "paystackSubscription")
        s.data.paystackSubscription[0]!.status = "canceled";
      return original(input);
    });
    await expect(
      reconcilePaystackTransaction(s.ctx, s.options, { reference: "ref" }),
    ).rejects.toThrow();
    expect(s.data.paystackSubscription[0]?.status).toBe("canceled");
  });
  it("does not repeat remote trial creation after an ambiguous provider response", async () => {
    const s = await subscriptionPayment({
      plans: [
        {
          name: "pro",
          amount: 100000,
          currency: "NGN",
          planCode: "PLN_fixture",
          interval: "monthly",
        },
      ],
    });
    const create = vi.fn().mockRejectedValue(new Error("response lost after submission"));
    (s.client as any).subscription = { create };
    s.client.transaction.verify.mockResolvedValue({
      data: {
        status: true,
        data: {
          reference: "ref",
          status: "success",
          amount: 100000,
          currency: "NGN",
          customer: { email: "buyer@test.com" },
          authorization: { authorization_code: "AUTH_fixture" },
          metadata: { isTrial: true, plan: "pro", trialEnd: "2026-11-01T00:00:00.000Z" },
        },
      },
    });
    await expect(
      reconcilePaystackTransaction(s.ctx, s.options, { reference: "ref" }),
    ).rejects.toThrow();
    await expect(
      reconcilePaystackTransaction(s.ctx, s.options, { reference: "ref" }),
    ).rejects.toThrow();
    expect(create).toHaveBeenCalledOnce();
    expect(s.data.paystackSubscription[0]?.status).toBe("incomplete");
  });
  it("checkpoints successful hooks while recovering a later failed hook across transports", async () => {
    const onSubscriptionComplete = vi.fn();
    const onSubscriptionUpdate = vi
      .fn()
      .mockRejectedValueOnce(new Error("delivery failed"))
      .mockResolvedValue(undefined);
    const s = await subscriptionPayment({ onSubscriptionComplete, onSubscriptionUpdate });
    await expect(
      reconcilePaystackTransaction(s.ctx, s.options, { reference: "ref", source: "browser" }),
    ).rejects.toThrow();
    expect((await s.deliver()).status).toBe(200);
    expect(onSubscriptionComplete).toHaveBeenCalledOnce();
    expect(onSubscriptionUpdate).toHaveBeenCalledTimes(2);
  });
  it("leases lifecycle delivery across concurrent browser and webhook verification", async () => {
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const onSubscriptionComplete = vi.fn().mockImplementationOnce(() => hold);
    const s = await subscriptionPayment({ onSubscriptionComplete });
    const first = s.deliver();
    await vi.waitFor(() => expect(onSubscriptionComplete).toHaveBeenCalledOnce());
    await expect(
      reconcilePaystackTransaction(s.ctx, s.options, { reference: "ref" }),
    ).rejects.toThrow();
    release();
    expect((await first).status).toBe(200);
    await reconcilePaystackTransaction(s.ctx, s.options, { reference: "ref" });
    expect(onSubscriptionComplete).toHaveBeenCalledOnce();
  });
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
