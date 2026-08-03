/* oxlint-disable @typescript-eslint/strict-boolean-expressions */

import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { paystack, reconcilePaystackTransaction } from "../src/index.ts";
import { readPaystackPaymentCredentials } from "../src/payment-credentials.ts";
import type { PaystackClientLike, PaystackOptions } from "../src/types.ts";

type MockPaystackClient = PaystackClientLike & {
  transaction: {
    initialize: ReturnType<typeof vi.fn>;
    verify: ReturnType<typeof vi.fn>;
    chargeAuthorization: ReturnType<typeof vi.fn>;
  };
  subscription: {
    create: ReturnType<typeof vi.fn>;
    fetch: ReturnType<typeof vi.fn>;
    disable: ReturnType<typeof vi.fn>;
    enable: ReturnType<typeof vi.fn>;
    manageLink: ReturnType<typeof vi.fn>;
  };
  customer: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    fetch: ReturnType<typeof vi.fn>;
  };
  product: {
    fetch: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  plan: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

function createMockPaystackClient(): MockPaystackClient {
  return {
    transaction: {
      initialize: vi.fn(),
      verify: vi.fn(),
      chargeAuthorization: vi.fn(),
    },
    subscription: {
      create: vi.fn(),
      fetch: vi.fn(),
      disable: vi.fn(),
      enable: vi.fn(),
      manageLink: vi.fn(),
    },
    customer: {
      create: vi.fn(),
      update: vi.fn(),
      fetch: vi.fn(),
    },
    product: {
      fetch: vi.fn(),
      list: vi.fn(),
    },
    plan: {
      list: vi.fn(),
      create: vi.fn(),
    },
  } as MockPaystackClient;
}

describe("reconcilePaystackTransaction", () => {
  const data: Record<string, unknown[]> = {
    user: [],
    session: [],
    verification: [],
    account: [],
    organization: [],
    member: [],
    paystackSubscription: [],
    paystackProduct: [],
    paystackTransaction: [],
    paystackCustomer: [],
    paystackPaymentCredential: [],
    paystackPlan: [],
    paystackWebhookEvent: [],
  };

  beforeEach(() => {
    for (const key of Object.keys(data)) {
      data[key] = [];
    }
    vi.clearAllMocks();
  });

  function createAuthContext(options: PaystackOptions<PaystackClientLike>) {
    const auth = betterAuth({
      baseURL: "http://localhost:3000",
      database: memoryAdapter(data),
      plugins: [paystack<PaystackClientLike>(options)],
    });

    return auth.$context.then((context) => ({ context }) as any);
  }

  it("verifies and persists a successful transaction from trusted server code", async () => {
    const paystackClient = createMockPaystackClient();
    const options = {
      paystackClient,
      secretKey: "sk_test_123",
    } satisfies PaystackOptions<PaystackClientLike>;
    const ctx = await createAuthContext(options);

    data.user.push({
      id: "user_reconcile_success",
      email: "buyer@test.com",
      name: "Buyer",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await ctx.context.adapter.create({
      model: "paystackTransaction",
      data: {
        reference: "ref_success",
        referenceId: "user_reconcile_success",
        userId: "user_reconcile_success",
        amount: 5000,
        currency: "NGN",
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    paystackClient.transaction.verify.mockResolvedValue({
      data: {
        status: true,
        data: {
          id: 123,
          status: "success",
          reference: "ref_success",
          amount: 5000,
          currency: "NGN",
          customer: {
            customer_code: "CUS_success",
            email: "buyer@test.com",
          },
          authorization: null,
          metadata: null,
          plan: null,
        },
      },
    });

    const result = await reconcilePaystackTransaction(ctx, options, {
      reference: "ref_success",
      source: "queue",
      referenceId: "user_reconcile_success",
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("success");
    expect(result.transaction.updated).toBe(true);
    expect(result.customer).toMatchObject({
      saved: true,
      customerCode: "CUS_success",
      model: "user",
    });

    const tx = await ctx.context.adapter.findOne({
      model: "paystackTransaction",
      where: [{ field: "reference", value: "ref_success" }],
    });
    expect(tx.status).toBe("success");
    expect(tx.paystackId).toBe("123");

    const customer = await ctx.context.adapter.findOne({
      model: "paystackCustomer",
      where: [{ field: "referenceKey", value: "user:user_reconcile_success" }],
    });
    expect(customer.customerCode).toBe("CUS_success");
  });

  it.each(["failed", "pending"])(
    "records %s transaction statuses without activation",
    async (status) => {
      const paystackClient = createMockPaystackClient();
      const options = {
        paystackClient,
        secretKey: "sk_test_123",
      } satisfies PaystackOptions<PaystackClientLike>;
      const ctx = await createAuthContext(options);

      await ctx.context.adapter.create({
        model: "paystackTransaction",
        data: {
          reference: `ref_${status}`,
          referenceId: "user_status",
          userId: "user_status",
          amount: 5000,
          currency: "NGN",
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      paystackClient.transaction.verify.mockResolvedValue({
        data: {
          status: true,
          data: {
            status,
            reference: `ref_${status}`,
            amount: 5000,
            currency: "NGN",
            customer: { email: "status@test.com" },
            authorization: null,
            metadata: null,
            plan: null,
          },
        },
      });

      const result = await reconcilePaystackTransaction(ctx, options, {
        reference: `ref_${status}`,
        source: "queue",
      });

      expect(result.ok).toBe(true);
      expect(result.status).toBe(status);
      expect(result.subscription.updated).toBe(false);

      const tx = await ctx.context.adapter.findOne({
        model: "paystackTransaction",
        where: [{ field: "reference", value: `ref_${status}` }],
      });
      expect(tx.status).toBe(status);
    },
  );

  it("is idempotent for repeated trial subscription reconciliation", async () => {
    const paystackClient = createMockPaystackClient();
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const options = {
      paystackClient,
      secretKey: "sk_test_123",
      subscription: {
        enabled: true,
        plans: [
          {
            name: "native-starter",
            amount: 500000,
            currency: "NGN",
            interval: "monthly",
            planCode: "PLN_native",
          },
        ],
      },
    } satisfies PaystackOptions<PaystackClientLike>;
    const ctx = await createAuthContext(options);

    data.user.push({
      id: "user_trial",
      email: "trial@test.com",
      name: "Trial",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await ctx.context.adapter.create({
      model: "paystackTransaction",
      data: {
        reference: "ref_trial",
        referenceId: "user_trial",
        userId: "user_trial",
        amount: 500000,
        currency: "NGN",
        status: "pending",
        plan: "native-starter",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const subscription = await ctx.context.adapter.create({
      model: "paystackSubscription",
      data: {
        plan: "native-starter",
        referenceId: "user_trial",
        status: "incomplete",
        transactionReference: "ref_trial",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    paystackClient.transaction.verify.mockResolvedValue({
      data: {
        status: true,
        data: {
          status: "success",
          reference: "ref_trial",
          amount: 500000,
          currency: "NGN",
          customer: {
            email: "trial@test.com",
            customer_code: "CUS_trial",
          },
          authorization: {
            authorization_code: "AUTH_trial",
          },
          metadata: {
            isTrial: true,
            trialEnd,
            plan: "native-starter",
          },
          plan: { plan_code: "PLN_native" },
        },
      },
    });
    paystackClient.subscription.create.mockResolvedValue({
      data: {
        status: true,
        data: {
          subscription_code: "SUB_trial",
        },
      },
    });

    const first = await reconcilePaystackTransaction(ctx, options, {
      reference: "ref_trial",
      source: "queue",
    });
    const second = await reconcilePaystackTransaction(ctx, options, {
      reference: "ref_trial",
      source: "queue",
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(paystackClient.subscription.create).toHaveBeenCalledTimes(1);

    const updatedSubscription = await ctx.context.adapter.findOne({
      model: "paystackSubscription",
      where: [{ field: "id", value: subscription.id }],
    });
    expect(updatedSubscription.status).toBe("trialing");
    expect(updatedSubscription.subscriptionCode).toBe("SUB_trial");
    await expect(
      readPaystackPaymentCredentials(ctx.context.adapter, options, subscription.id),
    ).resolves.toMatchObject({ authorizationCode: "AUTH_trial" });
  });

  it("applies proration metadata during trusted reconciliation", async () => {
    const paystackClient = createMockPaystackClient();
    const options = {
      paystackClient,
      secretKey: "sk_test_123",
      subscription: {
        enabled: true,
        plans: [
          { name: "team-plan", amount: 500000, currency: "NGN", interval: "monthly" },
          { name: "business-plan", amount: 750000, currency: "NGN", interval: "monthly" },
        ],
      },
    } satisfies PaystackOptions<PaystackClientLike>;
    const ctx = await createAuthContext(options);
    const subscription = await ctx.context.adapter.create({
      model: "paystackSubscription",
      data: {
        plan: "team-plan",
        referenceId: "user_proration",
        status: "active",
        seats: 1,
        subscriptionCode: "LOC_ref_old",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const metadata = {
      type: "proration",
      subscriptionId: subscription.id,
      referenceId: "user_proration",
      newPlan: "business-plan",
      oldPlan: "team-plan",
      newSeatCount: 3,
      remainingDays: 15,
    };
    await ctx.context.adapter.create({
      model: "paystackTransaction",
      data: {
        reference: "ref_proration",
        referenceId: "user_proration",
        userId: "user_proration",
        amount: 125000,
        currency: "NGN",
        status: "pending",
        plan: "business-plan",
        metadata: JSON.stringify(metadata),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    paystackClient.transaction.verify.mockResolvedValue({
      data: {
        status: true,
        data: {
          id: 321,
          status: "success",
          reference: "ref_proration",
          amount: 125000,
          currency: "NGN",
          customer: {
            email: "proration@test.com",
            customer_code: "CUS_proration",
          },
          authorization: {
            authorization_code: "AUTH_proration",
          },
          metadata,
          plan: null,
        },
      },
    });

    const result = await reconcilePaystackTransaction(ctx, options, {
      reference: "ref_proration",
      source: "queue",
    });

    expect(result.ok).toBe(true);
    expect(result.subscription.prorationApplied).toBe(true);

    const updatedSubscription = await ctx.context.adapter.findOne({
      model: "paystackSubscription",
      where: [{ field: "id", value: subscription.id }],
    });
    expect(updatedSubscription.plan).toBe("business-plan");
    expect(updatedSubscription.seats).toBe(3);
    expect(updatedSubscription.transactionReference).toBe("ref_proration");
    await expect(
      readPaystackPaymentCredentials(ctx.context.adapter, options, subscription.id),
    ).resolves.toMatchObject({ authorizationCode: "AUTH_proration" });
  });
});
