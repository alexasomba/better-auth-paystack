import type { GenericEndpointContext } from "better-auth";

import type {
  AnyPaystackOptions,
  PaystackClientLike,
  PaystackPlan,
  PaystackProduct,
  Subscription,
  PaystackProductResponse,
} from "./types";
import { createBillingStore } from "./billing-store";
import { createPaystackAdapter } from "./paystack-sdk";

export function getPlanSeatAmount(plan: PaystackPlan): number | undefined {
  if (plan.seatAmount !== undefined) {
    if (typeof plan.seatAmount === "number" && Number.isFinite(plan.seatAmount)) {
      return plan.seatAmount;
    }
    throw new Error(`Invalid seatAmount for plan '${plan.name}'. Expected a finite number.`);
  }

  if (plan.seatPriceId === undefined || plan.seatPriceId === null || plan.seatPriceId === "") {
    return undefined;
  }

  const parsed = typeof plan.seatPriceId === "string" ? Number(plan.seatPriceId) : plan.seatPriceId;
  if (typeof parsed === "number" && Number.isFinite(parsed)) {
    return parsed;
  }

  throw new Error(
    `Invalid seatPriceId for plan '${plan.name}'. Expected a numeric amount in the smallest currency unit.`,
  );
}

export function calculatePlanAmount(plan: PaystackPlan, quantity: number): number {
  return (plan.amount ?? 0) + quantity * (getPlanSeatAmount(plan) ?? 0);
}

export function normalizeSubscriptionGroup(group: string | undefined | null): string | null {
  const normalized = group?.trim().toLowerCase();
  return normalized === undefined || normalized === "" ? null : normalized;
}

export function isLocalSubscriptionCode(subscriptionCode: string | undefined | null): boolean {
  return (
    typeof subscriptionCode === "string" &&
    (subscriptionCode.startsWith("LOC_") || subscriptionCode.startsWith("sub_local_"))
  );
}

export function isLocallyManagedSubscription(
  subscription: Pick<Subscription, "subscriptionCode" | "planCode">,
): boolean {
  if (isLocalSubscriptionCode(subscription.subscriptionCode)) {
    return true;
  }

  if (typeof subscription.subscriptionCode === "string" && subscription.subscriptionCode !== "") {
    return false;
  }

  return (
    subscription.planCode === undefined ||
    subscription.planCode === null ||
    subscription.planCode === ""
  );
}

export function assertLocallyManagedSubscription(
  subscription: Pick<Subscription, "subscriptionCode" | "planCode">,
  action: string,
): void {
  if (!isLocallyManagedSubscription(subscription)) {
    throw new Error(
      `Paystack-managed subscriptions do not support ${action}. Use local billing for seat-based or prorated subscription changes.`,
    );
  }
}

export async function getPlans(
  subscriptionOptions: AnyPaystackOptions["subscription"],
): Promise<PaystackPlan[]> {
  if (subscriptionOptions?.enabled === true) {
    return typeof subscriptionOptions.plans === "function"
      ? subscriptionOptions.plans()
      : subscriptionOptions.plans;
  }
  throw new Error("Subscriptions are not enabled in the Paystack options.");
}

export const getPlan: (
  options: AnyPaystackOptions,
  planId: string,
) => Promise<PaystackPlan | null> = async (options, planId) => {
  if (options.subscription?.enabled === true) {
    const plans = await getPlans(options.subscription);
    return plans.find((plan) => plan.name === planId) ?? null;
  }
  return null;
};

export async function getPlanByName(
  options: AnyPaystackOptions,
  name: string,
): Promise<PaystackPlan | null> {
  if (typeof name !== "string" || name.trim() === "") {
    return null;
  }
  if (options.subscription?.enabled === true) {
    const plans = await getPlans(options.subscription);
    const normalizedName = name.toLowerCase();
    return (
      plans.find(
        (plan) => typeof plan.name === "string" && plan.name.toLowerCase() === normalizedName,
      ) ?? null
    );
  }
  return null;
}

export async function getPlanByPriceId(
  options: AnyPaystackOptions,
  priceId: string,
): Promise<PaystackPlan | null> {
  if (options.subscription?.enabled === true) {
    const plans = await getPlans(options.subscription);
    return plans.find((plan) => plan.name === priceId) ?? null;
  }
  return null;
}

export async function getProducts(
  productOptions: AnyPaystackOptions["products"],
): Promise<PaystackProduct[]> {
  if (productOptions?.products) {
    return typeof productOptions.products === "function"
      ? await productOptions.products()
      : productOptions.products;
  }
  return [];
}

export async function getProductByName(
  options: AnyPaystackOptions,
  name: string,
): Promise<PaystackProduct | null> {
  return await getProducts(options.products).then((products) =>
    products !== undefined && products !== null
      ? (products.find((product) => product.name.toLowerCase() === name.toLowerCase()) ?? null)
      : null,
  );
}

export function getNextPeriodEnd(startDate: Date, interval: string): Date {
  const date = new Date(startDate);
  switch (interval) {
    case "daily":
      date.setDate(date.getDate() + 1);
      break;
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "quarterly":
      date.setMonth(date.getMonth() + 3);
      break;
    case "biannually":
      date.setMonth(date.getMonth() + 6);
      break;
    case "annually":
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      // Default to monthly if unknown
      date.setMonth(date.getMonth() + 1);
  }
  return date;
}

/**
 * Validates if the amount meets Paystack's minimum transaction requirements.
 * Amounts should be in the smallest currency unit (e.g., kobo, cents).
 */
export function validateMinAmount(amount: number, currency: string): boolean {
  const minAmounts: Record<string, number> = {
    NGN: 5000, // 50.00
    GHS: 10, // 0.10
    ZAR: 100, // 1.00
    KES: 300, // 3.00
    USD: 200, // 2.00
    XOF: 100, // 1.00
  };
  const min = minAmounts[currency.toUpperCase()];
  return min !== undefined ? amount >= min : true;
}

export async function syncProductQuantityFromPaystack(
  ctx: GenericEndpointContext,
  productName: string,
  paystackClient: PaystackClientLike,
): Promise<void> {
  const store = createBillingStore(ctx);
  // Find the local product record (by name or slug)
  let localProduct = await store.findProductByName(productName);

  localProduct ??= await store.findProductBySlug(productName.toLowerCase().replace(/\s+/g, "-"));

  if (
    localProduct?.paystackId === undefined ||
    localProduct.paystackId === null ||
    localProduct.paystackId === ""
  ) {
    // No local record with a Paystack ID - fall back to local decrement
    if (
      localProduct?.id !== undefined &&
      localProduct.unlimited !== true &&
      typeof localProduct.quantity === "number" &&
      localProduct.quantity > 0
    ) {
      await store.updateProduct(localProduct.id, {
        quantity: localProduct.quantity - 1,
        updatedAt: new Date(),
      });
    }
    return;
  }

  // Fetch the latest quantity from Paystack
  try {
    const paystackProductId = Number(localProduct.paystackId);
    if (!Number.isFinite(paystackProductId)) {
      return;
    }
    const sdkRes = (await createPaystackAdapter(paystackClient).fetchProduct(
      paystackProductId,
    )) as PaystackProductResponse;
    const remoteQuantity = sdkRes?.quantity;

    if (remoteQuantity !== undefined && localProduct.id !== undefined) {
      await store.updateProduct(localProduct.id, {
        quantity: remoteQuantity,
        updatedAt: new Date(),
      });
    }
  } catch {
    // If API call fails, fall back to local decrement
    if (
      localProduct?.id !== undefined &&
      localProduct.unlimited !== true &&
      typeof localProduct.quantity === "number" &&
      localProduct.quantity > 0
    ) {
      await store.updateProduct(localProduct.id, {
        quantity: localProduct.quantity - 1,
        updatedAt: new Date(),
      });
    }
  }
}

export async function decrementProductQuantity(
  ctx: GenericEndpointContext,
  productName: string,
): Promise<void> {
  const store = createBillingStore(ctx);
  let product = await store.findProductByName(productName);

  product ??= await store.findProductBySlug(productName.toLowerCase().replace(/\s+/g, "-"));

  if (product !== undefined && product !== null) {
    if (
      product.unlimited !== true &&
      typeof product.quantity === "number" &&
      product.quantity > 0 &&
      product.id !== undefined
    ) {
      await store.updateProduct(product.id, {
        quantity: product.quantity - 1,
        updatedAt: new Date(),
      });
    }
  }
}

export async function syncSubscriptionSeats(
  ctx: GenericEndpointContext,
  organizationId: string,
  options: AnyPaystackOptions,
): Promise<void> {
  if (options.subscription?.enabled !== true) return;

  const store = createBillingStore(ctx);
  const subscriptions = (await store.findSubscriptionsByReference(organizationId)).filter(
    (subscription) => subscription.status === "active" || subscription.status === "trialing",
  );
  const seatSubscriptions: Subscription[] = [];
  for (const candidate of subscriptions) {
    const candidatePlan = await getPlanByName(options, candidate.plan);
    if (candidatePlan !== null && getPlanSeatAmount(candidatePlan) !== undefined) {
      seatSubscriptions.push(candidate);
    }
  }
  const members = await store.listMembers(organizationId);
  const quantity = members.length;
  for (const subscription of seatSubscriptions) {
    if (
      subscription.subscriptionCode === undefined ||
      subscription.subscriptionCode === null ||
      subscription.subscriptionCode === ""
    )
      continue;
    try {
      assertLocallyManagedSubscription(subscription, "automatic seat sync");

      // Locally managed subscriptions renew via saved authorizations, so seat count lives in our DB.
      await store.updateSubscription(subscription.id, {
        seats: quantity,
        updatedAt: new Date(),
      });
    } catch (e: unknown) {
      ctx.context.logger.error("Failed to sync subscription seats", e);
    }
  }
}
