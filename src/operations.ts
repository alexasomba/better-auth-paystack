import { APIError } from "better-auth/api";
import type { GenericEndpointContext } from "better-auth";
import type { components } from "@alexasomba/paystack-node";

import { getPaystackOps, unwrapSdkResult } from "./paystack-sdk";
import { getNextPeriodEnd, getPlans, validateMinAmount } from "./utils";
import type {
  AnyPaystackOptions,
  ChargeRecurringSubscriptionInput,
  ChargeRecurringSubscriptionResult,
  Member,
  PaystackPlan,
  PaystackProduct,
  PaystackSyncResult,
  PaystackTransactionResponse,
  Subscription,
  User,
} from "./types";

export async function syncPaystackProducts(
  ctx: GenericEndpointContext,
  options: AnyPaystackOptions,
): Promise<PaystackSyncResult> {
  const paystack = getPaystackOps(options.paystackClient);
  try {
    const raw = await paystack?.product?.list({});
    const productsData = unwrapSdkResult<components["schemas"]["ProductListsResponseArray"][]>(raw);

    if (!Array.isArray(productsData)) {
      return { status: "success", count: 0 };
    }

    for (const product of productsData) {
      const paystackId = String(product.id);
      const existing = await ctx.context.adapter.findOne<PaystackProduct>({
        model: "paystackProduct",
        where: [{ field: "paystackId", value: paystackId }],
      });

      const productFields = {
        name: product.name ?? "",
        description: product.description ?? "",
        price: product.price ?? 0,
        currency: product.currency ?? "",
        quantity: product.quantity ?? 0,
        unlimited:
          product.unlimited !== undefined &&
          product.unlimited !== null &&
          product.unlimited !== false,
        paystackId,
        slug:
          (product as { slug?: string }).slug ??
          product.name?.toLowerCase().replace(/\s+/g, "-") ??
          "",
        metadata:
          (product as { metadata?: unknown }).metadata !== undefined &&
          (product as { metadata?: unknown }).metadata !== null
            ? JSON.stringify((product as { metadata?: unknown }).metadata)
            : undefined,
        updatedAt: new Date(),
      };

      if (existing !== undefined && existing !== null) {
        await ctx.context.adapter.update({
          model: "paystackProduct",
          update: productFields,
          where: [{ field: "id", value: String(existing.id) }],
        });
      } else {
        await ctx.context.adapter.create({
          model: "paystackProduct",
          data: { ...productFields, createdAt: new Date() },
        });
      }
    }

    return { status: "success", count: productsData.length };
  } catch (error: unknown) {
    ctx.context.logger.error("Failed to sync products", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to sync products";
    throw new APIError("BAD_REQUEST", {
      message: errorMessage,
    });
  }
}

export async function syncPaystackPlans(
  ctx: GenericEndpointContext,
  options: AnyPaystackOptions,
): Promise<PaystackSyncResult> {
  const paystack = getPaystackOps(options.paystackClient);
  try {
    const raw = await paystack?.plan?.list();
    const plansData = unwrapSdkResult<components["schemas"]["PlanListResponseArray"][]>(raw);

    if (!Array.isArray(plansData)) {
      return { status: "success", count: 0 };
    }

    for (const plan of plansData) {
      const paystackId = String(plan.id);
      const existing = await ctx.context.adapter.findOne<PaystackPlan>({
        model: "paystackPlan",
        where: [{ field: "paystackId", value: paystackId }],
      });

      const planData = {
        name: plan.name ?? "",
        description: plan.description ?? "",
        amount: plan.amount ?? 0,
        currency: plan.currency ?? "",
        interval: plan.interval ?? "",
        planCode: plan.plan_code ?? "",
        paystackId,
        metadata:
          (plan as { metadata?: unknown }).metadata !== undefined &&
          (plan as { metadata?: unknown }).metadata !== null
            ? JSON.stringify((plan as { metadata?: unknown }).metadata)
            : undefined,
        updatedAt: new Date(),
      };

      if (existing !== undefined && existing !== null) {
        await ctx.context.adapter.update({
          model: "paystackPlan",
          update: planData,
          where: [{ field: "id", value: existing.id! }],
        });
      } else {
        await ctx.context.adapter.create({
          model: "paystackPlan",
          data: { ...planData, createdAt: new Date() },
        });
      }
    }

    return { status: "success", count: plansData.length };
  } catch (error: unknown) {
    ctx.context.logger.error("Failed to sync plans", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to sync plans";
    throw new APIError("BAD_REQUEST", {
      message: errorMessage,
    });
  }
}

export async function chargeSubscriptionRenewal(
  ctx: GenericEndpointContext,
  options: AnyPaystackOptions,
  input: ChargeRecurringSubscriptionInput,
): Promise<ChargeRecurringSubscriptionResult> {
  const { subscriptionId, amount: bodyAmount } = input;
  const subscription = await ctx.context.adapter.findOne<Subscription>({
    model: "subscription",
    where: [{ field: "id", value: subscriptionId }],
  });

  if (subscription === undefined || subscription === null) {
    throw new APIError("NOT_FOUND", { message: "Subscription not found" });
  }

  if (
    subscription.paystackAuthorizationCode === undefined ||
    subscription.paystackAuthorizationCode === null ||
    subscription.paystackAuthorizationCode === ""
  ) {
    throw new APIError("BAD_REQUEST", {
      message: "No authorization code found for this subscription",
    });
  }

  const plans = await getPlans(options.subscription);
  const plan = plans.find(
    (candidate) => candidate.name.toLowerCase() === subscription.plan.toLowerCase(),
  );

  if (plan === undefined || plan === null) {
    throw new APIError("NOT_FOUND", { message: "Plan not found" });
  }

  const amount = bodyAmount ?? plan.amount;
  if (amount === undefined || amount === null) {
    throw new APIError("BAD_REQUEST", { message: "Plan amount is not defined" });
  }

  let email: string | undefined;
  const referenceId = subscription.referenceId;
  if (referenceId !== undefined && referenceId !== null && referenceId !== "") {
    const user = await ctx.context.adapter.findOne<User>({
      model: "user",
      where: [{ field: "id", value: referenceId }],
    });
    if (user !== undefined && user !== null) {
      email = user.email;
    } else if (options.organization?.enabled === true) {
      const ownerMember = await ctx.context.adapter.findOne<Member>({
        model: "member",
        where: [
          { field: "organizationId", value: referenceId },
          { field: "role", value: "owner" },
        ],
      });
      if (ownerMember !== undefined && ownerMember !== null) {
        const ownerUser = await ctx.context.adapter.findOne<User>({
          model: "user",
          where: [{ field: "id", value: ownerMember.userId }],
        });
        email = ownerUser?.email;
      }
    }
  }

  if (email === undefined || email === null || email === "") {
    throw new APIError("NOT_FOUND", { message: "User email not found" });
  }

  const finalCurrency = plan.currency ?? "NGN";
  if (!validateMinAmount(amount, finalCurrency)) {
    throw new APIError("BAD_REQUEST", {
      message: `Amount ${amount} is less than the minimum required for ${finalCurrency}.`,
      status: 400,
    });
  }

  const paystack = getPaystackOps(options.paystackClient);
  const chargeResRaw = await paystack?.transaction?.chargeAuthorization({
    body: {
      email,
      amount,
      authorization_code: subscription.paystackAuthorizationCode,
      reference: `rec_${subscription.id}_${Date.now()}`,
      metadata: JSON.stringify({
        subscriptionId,
        referenceId,
      }),
    },
  });

  const chargeData = unwrapSdkResult<PaystackTransactionResponse>(chargeResRaw);
  if (chargeData?.status === "success" && chargeData.reference !== undefined) {
    const now = new Date();
    const nextPeriodEnd = getNextPeriodEnd(now, plan.interval ?? "monthly");

    await ctx.context.adapter.update({
      model: "subscription",
      update: {
        periodStart: now,
        periodEnd: nextPeriodEnd,
        updatedAt: now,
        paystackTransactionReference: chargeData.reference,
      },
      where: [{ field: "id", value: subscription.id }],
    });

    return { status: "success", data: chargeData };
  }

  return { status: "failed", data: chargeData };
}
