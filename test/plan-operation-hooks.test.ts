/* oxlint-disable @typescript-eslint/strict-boolean-expressions, typescript/require-await */
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuthClient } from "better-auth/client";
import { setCookieToHeader } from "better-auth/cookies";
import { organization } from "better-auth/plugins";
import { describe, expect, it, vi } from "vite-plus/test";

import { paystackClient } from "../src/client";
import { paystack } from "../src/index";
import type { PaystackSubscriptionOperationHooks } from "../src/index";
import { savePaystackPaymentCredentials } from "../src/payment-credentials";

async function fixture(
  hooks?: PaystackSubscriptionOperationHooks,
  authorizeReference?: () => Promise<boolean>,
  organizationEnabled = false,
) {
  const data: Record<string, any[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
    organization: [],
    member: [],
    invitation: [],
    paystackTransaction: [],
    paystackSubscription: [],
    paystackPaymentCredential: [],
    paystackCustomer: [],
    paystackWebhookEvent: [],
  };
  const initialize = vi.fn().mockImplementation(async ({ body }) => ({
    data: {
      status: true,
      data: {
        reference: body.reference ?? "legacy-ref",
        authorization_url: "https://fixture.invalid/pay",
        access_code: "fixture-access",
      },
    },
  }));
  const chargeAuthorization = vi.fn().mockImplementation(async ({ body }) => ({
    data: {
      status: true,
      data: {
        status: "success",
        reference: body.reference,
        amount: body.amount,
        currency: "NGN",
      },
    },
  }));
  const options: any = {
    secretKey: "fixture-only-key",
    paystackClient: { transaction: { initialize, chargeAuthorization } },
    organization: { enabled: organizationEnabled },
    subscription: {
      enabled: true,
      plans: [
        { name: "starter", amount: 100000, currency: "NGN", interval: "monthly" },
        { name: "pro", amount: 300000, currency: "NGN", interval: "monthly" },
      ],
      operationHooks: hooks,
      authorizeReference,
    },
  };
  const auth = betterAuth({
    baseURL: "http://localhost:3000",
    database: memoryAdapter(data),
    emailAndPassword: { enabled: true },
    plugins: [...(organizationEnabled ? [organization()] : []), paystack(options)],
  });
  const client = createAuthClient({
    baseURL: "http://localhost:3000",
    plugins: [paystackClient({ subscription: true })],
    fetchOptions: { customFetchImpl: async (url, init) => auth.handler(new Request(url, init)) },
  });
  const user = {
    email: "operation@fixture.invalid",
    password: "fixture-password",
    name: "Fixture",
  };
  const signed = await client.signUp.email(user);
  const headers = new Headers();
  await client.signIn.email(user, { onSuccess: setCookieToHeader(headers) });
  const userId = signed.data!.user.id;
  const ctx = await auth.$context;
  async function subscription() {
    return ctx.adapter.create<any>({
      model: "paystackSubscription",
      data: {
        plan: "starter",
        referenceId: userId,
        userId,
        status: "active",
        subscriptionCode: "LOC_fixture",
        periodStart: new Date(Date.now() - 86400000),
        periodEnd: new Date(Date.now() + 20 * 86400000),
        seats: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        cancelAtPeriodEnd: false,
      },
    });
  }
  return {
    data,
    client,
    headers,
    userId,
    initialize,
    chargeAuthorization,
    subscription,
    ctx,
    options,
  };
}

const proceed = {
  kind: "proceed" as const,
  providerReference: "reserved-fixture-ref",
  context: { attempt: "fixture-attempt" },
};

describe("subscription operation hooks", () => {
  it("reserves before dispatch and completes only after linked records persist", async () => {
    const before = vi.fn(async (input) => {
      expect(input).toMatchObject({
        actor: { id: f.userId },
        referenceId: f.userId,
        kind: "initialize",
        intent: { plan: "pro", amount: 300000, currency: "NGN", interval: "monthly" },
      });
      expect(f.initialize).not.toHaveBeenCalled();
      return proceed;
    });
    const after = vi.fn(async (input) => {
      expect(input.context).toEqual(proceed.context);
      expect(input.result.reference).toBe(proceed.providerReference);
      expect(f.data.paystackTransaction).toHaveLength(1);
      expect(f.data.paystackSubscription[0].transactionReference).toBe(proceed.providerReference);
    });
    const f = await fixture({ before, after });
    const response = await f.client.subscription.upgrade({ plan: "pro" }, { headers: f.headers });
    expect(response.error).toBeNull();
    expect(before).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
    expect(f.initialize.mock.calls[0][0].body.reference).toBe(proceed.providerReference);
  });

  it("replays the exact result without provider or persistence", async () => {
    const result = {
      kind: "checkout",
      url: "https://fixture.invalid/replay",
      reference: "old-ref",
      accessCode: "old-access",
      redirect: true as const,
    } as const;
    const f = await fixture({ before: async () => ({ kind: "replay", result }) });
    const response = await f.client.subscription.create({ plan: "pro" }, { headers: f.headers });
    expect(response.data).toEqual(result);
    expect(f.initialize).not.toHaveBeenCalled();
    expect(f.data.paystackTransaction).toHaveLength(0);
  });

  it("blocks all aliases before dispatch", async () => {
    const f = await fixture({
      before: async () => ({ kind: "block", message: "Unresolved operation" }),
    });
    for (const invoke of [
      f.client.subscription.create,
      f.client.subscription.upgrade,
      f.client.transaction.initialize,
    ]) {
      const response = await invoke({ plan: "pro" }, { headers: f.headers });
      expect(response.error).not.toBeNull();
    }
    expect(f.initialize).not.toHaveBeenCalled();
  });

  it("does not reserve rejected plan or unauthorized reference requests", async () => {
    const before = vi.fn(async () => proceed);
    const f = await fixture({ before });
    await f.client.subscription.upgrade({ plan: "missing" }, { headers: f.headers });
    await f.client.subscription.upgrade(
      { plan: "pro", referenceId: "other-organization" },
      { headers: f.headers },
    );
    expect(before).not.toHaveBeenCalled();
    expect(f.initialize).not.toHaveBeenCalled();
  });

  it("reports uncertain provider failure with invocation context", async () => {
    const onError = vi.fn();
    const f = await fixture({ before: async () => proceed, onError });
    f.initialize.mockRejectedValueOnce(new Error("fixture timeout"));
    const response = await f.client.subscription.upgrade({ plan: "pro" }, { headers: f.headers });
    expect(response.error).not.toBeNull();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: proceed.context,
        phase: "provider",
        providerReference: proceed.providerReference,
      }),
      expect.anything(),
    );
  });

  it("reports persistence failure after provider success", async () => {
    const onError = vi.fn();
    const f = await fixture({ before: async () => proceed, onError });
    const original = f.ctx.adapter.create.bind(f.ctx.adapter);
    vi.spyOn(f.ctx.adapter, "create").mockImplementation(async (input: any) => {
      if (input.model === "paystackTransaction") throw new Error("fixture persistence failure");
      return original(input);
    });
    const response = await f.client.subscription.upgrade({ plan: "pro" }, { headers: f.headers });
    expect(response.error).not.toBeNull();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "persistence" }),
      expect.anything(),
    );
  });

  for (const credential of [false, true]) {
    it(`propagates stable reference through proration ${credential ? "charge" : "initialize"}`, async () => {
      const before = vi.fn(async () => proceed);
      const after = vi.fn();
      const f = await fixture({ before, after });
      const sub = await f.subscription();
      if (credential)
        await savePaystackPaymentCredentials(f.ctx.adapter as any, f.options, sub.id, {
          authorizationCode: "AUTH_fixture",
        });
      const response = await f.client.subscription.upgrade(
        { plan: "pro", subscriptionId: sub.id, prorateAndCharge: true },
        { headers: f.headers },
      );
      expect(response.error).toBeNull();
      expect(before).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: credential ? "proration-charge" : "proration-initialize",
          subscription: { ...sub },
        }),
        expect.anything(),
      );
      const provider = credential ? f.chargeAuthorization : f.initialize;
      expect(provider.mock.calls[0][0].body.reference).toBe(proceed.providerReference);
      expect(after).toHaveBeenCalledTimes(1);
    });
  }

  it("blocks schedule before local mutation", async () => {
    const f = await fixture({
      before: async () => ({ kind: "block", message: "Unresolved operation" }),
    });
    const sub = await f.subscription();
    const response = await f.client.subscription.upgrade(
      { plan: "pro", subscriptionId: sub.id, scheduleAtPeriodEnd: true },
      { headers: f.headers },
    );
    expect(response.error).not.toBeNull();
    expect(f.data.paystackSubscription[0].pendingPlan).toBeUndefined();
  });

  it("isolates concurrent references and hook contexts on one plugin", async () => {
    const completions: any[] = [];
    const f = await fixture(
      {
        before: async ({ referenceId }) => ({
          kind: "proceed",
          providerReference: `reserved-${referenceId}`,
          context: { referenceId },
        }),
        after: async (operation) => {
          completions.push(operation);
        },
      },
      async () => true,
    );
    const pending = new Map<string, (value: any) => void>();
    f.initialize.mockImplementation(
      ({ body }) => new Promise((resolve) => pending.set(body.reference, resolve)),
    );
    const first = f.client.subscription.upgrade(
      { plan: "starter", referenceId: "org-A" },
      { headers: f.headers },
    );
    const second = f.client.subscription.upgrade(
      { plan: "pro", referenceId: "org-B" },
      { headers: f.headers },
    );
    await vi.waitFor(() => expect(pending.size).toBe(2));
    for (const id of ["org-B", "org-A"]) {
      pending.get(`reserved-${id}`)!({
        data: {
          status: true,
          data: {
            reference: `reserved-${id}`,
            authorization_url: `https://fixture.invalid/${id}`,
            access_code: id,
          },
        },
      });
    }
    const responses = await Promise.all([first, second]);
    expect(responses.map((result) => result.error)).toEqual([null, null]);
    expect(completions).toHaveLength(2);
    for (const operation of completions) {
      expect(operation.context.referenceId).toBe(operation.referenceId);
      expect(operation.result.reference).toBe(`reserved-${operation.referenceId}`);
      expect(
        f.data.paystackSubscription.find((row) => row.referenceId === operation.referenceId)
          .transactionReference,
      ).toBe(operation.result.reference);
    }
  });

  it("preflights local changes without invoking provider", async () => {
    const before = vi.fn(async () => proceed);
    const after = vi.fn();
    const f = await fixture({ before, after });
    const sub = await f.subscription();
    const response = await f.client.subscription.upgrade(
      { plan: "starter", subscriptionId: sub.id, prorateAndCharge: true },
      { headers: f.headers },
    );
    expect(response.data).toMatchObject({ kind: "prorated" });
    expect(before).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "local-change",
        intent: expect.objectContaining({ amount: 0 }),
      }),
      expect.anything(),
    );
    expect(after).toHaveBeenCalledTimes(1);
    expect(f.initialize).not.toHaveBeenCalled();
    expect(f.chargeAuthorization).not.toHaveBeenCalled();
  });

  it("rejects invalid reservation and incompatible replay before dispatch", async () => {
    for (const decision of [
      { kind: "proceed", providerReference: "" },
      { kind: "proceed", providerReference: 1 },
      { kind: "invalid" },
      {
        kind: "replay",
        result: {
          kind: "scheduled",
          status: "success",
          scheduled: true,
          message: "wrong operation",
        },
      },
    ]) {
      const f = await fixture({ before: async () => decision as any });
      const response = await f.client.subscription.upgrade({ plan: "pro" }, { headers: f.headers });
      expect(response.error).not.toBeNull();
      expect(f.initialize).not.toHaveBeenCalled();
      expect(f.data.paystackTransaction).toHaveLength(0);
    }
  });

  it("does not dispatch when reservation itself fails", async () => {
    const f = await fixture({
      before: async () => {
        throw new Error("fixture reservation unavailable");
      },
    });
    const response = await f.client.subscription.upgrade({ plan: "pro" }, { headers: f.headers });
    expect(response.error).not.toBeNull();
    expect(f.initialize).not.toHaveBeenCalled();
  });

  for (const operation of ["initialize", "proration-initialize", "proration-charge"]) {
    it(`keeps mismatched ${operation} response uncertain and unpersisted`, async () => {
      const after = vi.fn();
      const onError = vi.fn();
      const f = await fixture({ before: async () => proceed, after, onError });
      f.initialize.mockResolvedValue({
        data: {
          status: true,
          data: {
            reference: "mismatched-ref",
            authorization_url: "https://fixture.invalid",
            access_code: "fixture",
          },
        },
      });
      f.chargeAuthorization.mockResolvedValue({
        data: { status: true, data: { status: "success", reference: "mismatched-ref" } },
      });
      const sub = operation === "initialize" ? undefined : await f.subscription();
      if (operation === "proration-charge")
        await savePaystackPaymentCredentials(f.ctx.adapter as any, f.options, sub.id, {
          authorizationCode: "AUTH_fixture",
        });
      const response = await f.client.subscription.upgrade(
        { plan: "pro", subscriptionId: sub?.id, prorateAndCharge: sub !== undefined },
        { headers: f.headers },
      );
      expect(response.error).not.toBeNull();
      expect(after).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: "provider",
          providerReference: proceed.providerReference,
        }),
        expect.anything(),
      );
      expect(f.data.paystackTransaction).toHaveLength(0);
      if (sub) expect(f.data.paystackSubscription[0].plan).toBe("starter");
    });
  }

  it("holds completion failures and preserves original failure if error hook also fails", async () => {
    const onError = vi.fn(async (input: any) => {
      expect(input.error).toMatchObject({ message: "fixture completion failure" });
      throw new Error("fixture error-hook failure");
    });
    const f = await fixture({
      before: async () => proceed,
      after: async () => {
        throw new Error("fixture completion failure");
      },
      onError,
    });
    const response = await f.client.subscription.upgrade({ plan: "pro" }, { headers: f.headers });
    expect(response.error).toMatchObject({ status: 500 });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "completion", context: proceed.context }),
      expect.anything(),
    );
    expect(f.data.paystackTransaction).toHaveLength(1);
    expect(f.initialize).toHaveBeenCalledTimes(1);
  });

  it("does not log protected callback error material", async () => {
    const f = await fixture({
      before: async () => proceed,
      after: async () => {
        throw new Error("fixture completion failed");
      },
      onError: async () => {
        throw new Error("fixture-protected-replay-secret");
      },
    });
    const log = vi.spyOn(f.ctx.logger, "error");
    await f.client.subscription.upgrade({ plan: "pro" }, { headers: f.headers });
    const emitted = log.mock.calls
      .map((args) =>
        args.map((arg) => (arg instanceof Error ? arg.message : JSON.stringify(arg))).join(" "),
      )
      .join("\n");
    expect(emitted).not.toContain("fixture-protected-replay-secret");
    expect(log).toHaveBeenCalledWith("Paystack operation error hook failed", {
      phase: "completion",
    });
  });

  it("does not run subscription hooks for one-time payments", async () => {
    const before = vi.fn(async () => proceed);
    const f = await fixture({ before });
    const response = await f.client.transaction.initialize(
      { amount: 100000 },
      { headers: f.headers },
    );
    expect(response.error).toBeNull();
    expect(before).not.toHaveBeenCalled();
  });

  it("does not reserve rejected proration pricing", async () => {
    const before = vi.fn(async () => proceed);
    const f = await fixture({ before });
    f.options.subscription.plans[1].amount = 101000;
    const sub = await f.subscription();
    const response = await f.client.subscription.upgrade(
      { plan: "pro", subscriptionId: sub.id, prorateAndCharge: true },
      { headers: f.headers },
    );
    expect(response.error).not.toBeNull();
    expect(before).not.toHaveBeenCalled();
    expect(f.initialize).not.toHaveBeenCalled();
  });

  it("reports effective validated member quantity", async () => {
    const before = vi.fn(async () => proceed);
    const f = await fixture({ before }, async () => true, true);
    f.options.subscription.plans[1].seatAmount = 50000;
    for (const id of ["member-A", "member-B"])
      await f.ctx.adapter.create({
        model: "member",
        data: {
          id,
          organizationId: "org-A",
          userId: f.userId,
          role: "member",
          createdAt: new Date(),
        },
      });
    const response = await f.client.subscription.upgrade(
      { plan: "pro", referenceId: "org-A" },
      { headers: f.headers },
    );
    expect(response.error).toBeNull();
    expect(before).toHaveBeenCalledWith(
      expect.objectContaining({ intent: expect.objectContaining({ quantity: 2, amount: 400000 }) }),
      expect.anything(),
    );
  });

  it("retains absent-hook normalized organization email lookup errors", async () => {
    const f = await fixture(undefined, async () => true, true);
    const find = f.ctx.adapter.findOne.bind(f.ctx.adapter);
    vi.spyOn(f.ctx.adapter, "findOne").mockImplementation(async (input: any) => {
      if (input.model === "organization") throw new Error("fixture email lookup failed");
      return find(input);
    });
    const response = await f.client.subscription.upgrade(
      { plan: "pro", referenceId: "org-A" },
      { headers: f.headers },
    );
    expect(response.error).toMatchObject({
      code: "FAILED_TO_INITIALIZE_TRANSACTION",
      message: "fixture email lookup failed",
    });
    expect(f.initialize).not.toHaveBeenCalled();
  });

  it("retains absent-hook normalized proration validation errors", async () => {
    const f = await fixture();
    f.options.subscription.plans[1].amount = 101000;
    const sub = await f.subscription();
    const response = await f.client.subscription.upgrade(
      { plan: "pro", subscriptionId: sub.id, prorateAndCharge: true },
      { headers: f.headers },
    );
    expect(response.error).toMatchObject({ code: "FAILED_TO_INITIALIZE_TRANSACTION" });
    expect(f.initialize).not.toHaveBeenCalled();
  });

  it("adds no ordinary subscription read when hooks are absent", async () => {
    const f = await fixture();
    const reads = vi.spyOn(f.ctx.adapter, "findMany");
    await f.client.subscription.create({ plan: "pro" }, { headers: f.headers });
    expect(
      reads.mock.calls.filter(([input]) => input.model === "paystackSubscription"),
    ).toHaveLength(0);
  });

  it("retains the absent-hook checkout behavior", async () => {
    const f = await fixture();
    const response = await f.client.subscription.create({ plan: "pro" }, { headers: f.headers });
    expect(response.data).toMatchObject({ kind: "checkout", reference: "legacy-ref" });
    expect(f.initialize.mock.calls[0][0].body.reference).toBeUndefined();
  });
});
