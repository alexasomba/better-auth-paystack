import { APIError } from "better-auth/api";
import type { GenericEndpointContext } from "better-auth";

import { createBillingStore } from "./billing-store";
import { createPaystackAdapter } from "./paystack-sdk";
import { getNextPeriodEnd, getPlans, validateMinAmount } from "./utils";
import type {
  AnyPaystackOptions,
  ChargeRecurringSubscriptionInput,
  ChargeRecurringSubscriptionResult,
  PaystackSyncResult,
  PaystackChargeAuthorizationResponse,
} from "./types";

export async function syncPaystackProducts(
  ctx: GenericEndpointContext,
  options: AnyPaystackOptions,
): Promise<PaystackSyncResult> {
  const paystack = createPaystackAdapter(options.paystackClient);
  const store = createBillingStore(ctx);
  try {
    const productsData = await paystack.listProducts();

    if (!Array.isArray(productsData)) {
      return { status: "success", count: 0 };
    }

    for (const product of productsData) {
      const paystackId = String(product.id);
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

      await store.upsertProductByPaystackId(paystackId, {
        ...productFields,
        createdAt: new Date(),
      });
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
  const paystack = createPaystackAdapter(options.paystackClient);
  const store = createBillingStore(ctx);
  try {
    const plansData = await paystack.listPlans();

    if (!Array.isArray(plansData)) {
      return { status: "success", count: 0 };
    }

    for (const plan of plansData) {
      const paystackId = String(plan.id);
      const planData = {
        name: plan.name ?? "",
        description: typeof plan.description === "string" ? plan.description : "",
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

      await store.upsertPlanByPaystackId(paystackId, {
        ...planData,
        createdAt: new Date(),
      });
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
  const store = createBillingStore(ctx);
  const subscription = await store.findSubscriptionById(subscriptionId);

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
  let billingUserId = subscription.userId;
  const referenceId = subscription.referenceId;
  if (referenceId !== undefined && referenceId !== null && referenceId !== "") {
    const user = await store.findUser(referenceId);
    if (user !== undefined && user !== null) {
      email = user.email;
      billingUserId = user.id;
    } else if (options.organization?.enabled === true) {
      const ownerMember = await store.findOrganizationOwner(referenceId);
      if (ownerMember !== undefined && ownerMember !== null) {
        const ownerUser = await store.findUser(ownerMember.userId);
        email = ownerUser?.email;
        billingUserId = ownerUser?.id ?? ownerMember.userId;
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

  const paystack = createPaystackAdapter(options.paystackClient);
  const chargeData = await paystack.chargeAuthorization({
    email,
    amount,
    authorization_code: subscription.paystackAuthorizationCode,
    reference: `rec_${subscription.id}_${Date.now()}`,
    metadata: JSON.stringify({
      subscriptionId,
      referenceId,
    }),
  });

  const typedChargeData = chargeData as PaystackChargeAuthorizationResponse;
  if (typedChargeData?.status === "success" && typedChargeData.reference !== undefined) {
    const now = new Date();
    const nextPeriodEnd = getNextPeriodEnd(now, plan.interval ?? "monthly");

    await store.createTransaction({
      reference: typedChargeData.reference,
      paystackId:
        typedChargeData.id !== undefined && typedChargeData.id !== null
          ? String(typedChargeData.id)
          : undefined,
      referenceId,
      userId: billingUserId,
      amount: typedChargeData.amount,
      currency: typedChargeData.currency,
      status: "success",
      plan: plan.name.toLowerCase(),
      metadata: JSON.stringify({
        type: "renewal",
        subscriptionId,
        referenceId,
      }),
      createdAt: now,
      updatedAt: now,
    });

    await store.updateSubscription(subscription.id, {
      periodStart: now,
      periodEnd: nextPeriodEnd,
      updatedAt: now,
      paystackTransactionReference: typedChargeData.reference,
    });

    return { status: "success", data: typedChargeData };
  }

  return { status: "failed", data: typedChargeData };
}
