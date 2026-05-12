import type { GenericEndpointContext } from "better-auth";
import { APIError } from "better-auth/api";
import type { components } from "@alexasomba/paystack-node";

import { createBillingStore } from "./billing-store";
import { createPaystackAdapter } from "./paystack-sdk";
import {
  assertLocallyManagedSubscription,
  calculatePlanAmount,
  getPlanByName,
  getPlanSeatAmount,
} from "./utils";
import type {
  AnyPaystackOptions,
  PaystackChargeAuthorizationResponse,
  PaystackCheckoutChannel,
  PaystackPlan,
} from "./types";

export type ProratedUpgradeOutcome =
  | {
      kind: "completed";
      status: "success";
      message: string;
      prorated: true;
    }
  | {
      kind: "checkout";
      url: string | undefined;
      reference: string | undefined;
      accessCode: string | undefined;
      redirect: true;
    };

export async function handleProratedUpgrade(
  ctx: GenericEndpointContext,
  options: AnyPaystackOptions,
  input: {
    plan: PaystackPlan;
    referenceId: string;
    quantity?: number;
    targetEmail: string;
    userId: string;
    finalCurrency: string;
    callbackURL?: string;
    allowedSubscriptionChannels?: PaystackCheckoutChannel[];
  },
): Promise<ProratedUpgradeOutcome | null> {
  const store = createBillingStore(ctx);
  const existingSub = await store.findCurrentSubscription(input.referenceId);
  if (
    existingSub?.status !== "active" ||
    existingSub.paystackSubscriptionCode === undefined ||
    existingSub.paystackSubscriptionCode === null ||
    existingSub.paystackSubscriptionCode === "" ||
    existingSub.periodEnd === undefined ||
    existingSub.periodEnd === null ||
    existingSub.periodStart === undefined ||
    existingSub.periodStart === null
  ) {
    return null;
  }

  const now = new Date();
  const periodEnd = new Date(existingSub.periodEnd);
  const periodStart = new Date(existingSub.periodStart);

  const totalDays = Math.max(
    1,
    Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const remainingDays = Math.max(
    0,
    Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  );

  let oldAmount = 0;
  if (existingSub.plan !== "") {
    const oldPlan =
      (await getPlanByName(options, existingSub.plan)) ??
      (await store.findPlanByName(existingSub.plan));
    if (oldPlan !== undefined && oldPlan !== null) {
      oldAmount = calculatePlanAmount(oldPlan, existingSub.seats);
    }
  }

  let membersCount = 1;
  let newSeatCount: number;
  let newAmount: number;
  try {
    assertLocallyManagedSubscription(existingSub, "plan or seat changes");
    if (getPlanSeatAmount(input.plan) !== undefined) {
      const members = await store.listMembers(input.referenceId);
      membersCount = members.length > 0 ? members.length : 1;
    }
    newSeatCount = input.quantity ?? existingSub.seats ?? membersCount;
    newAmount = calculatePlanAmount(input.plan, newSeatCount);
  } catch (error: unknown) {
    throw new APIError("BAD_REQUEST", {
      message: error instanceof Error ? error.message : "Invalid seat configuration for plan.",
    });
  }

  const costDifference = newAmount - oldAmount;
  const prorationMetadata = {
    type: "proration",
    subscriptionId: existingSub.id,
    referenceId: input.referenceId,
    newPlan: input.plan.name.toLowerCase(),
    oldPlan: existingSub.plan,
    newSeatCount,
    remainingDays,
  };
  let completedProrationReference: string | undefined;

  if (costDifference > 0 && remainingDays > 0) {
    const proratedAmount = Math.round((costDifference / totalDays) * remainingDays);
    if (proratedAmount < 5000) {
      throw new APIError("BAD_REQUEST", {
        message:
          "Prorated upgrade amount is below Paystack's minimum charge. Schedule the change for period end instead.",
        status: 400,
      });
    }

    const paystack = createPaystackAdapter(options.paystackClient);
    if (
      existingSub.paystackAuthorizationCode !== undefined &&
      existingSub.paystackAuthorizationCode !== null &&
      existingSub.paystackAuthorizationCode !== ""
    ) {
      const sdkRes = (await paystack.chargeAuthorization({
        email: input.targetEmail,
        amount: proratedAmount,
        authorization_code: existingSub.paystackAuthorizationCode,
        reference: `upg_${existingSub.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        metadata: JSON.stringify(prorationMetadata),
      })) as PaystackChargeAuthorizationResponse;

      if (sdkRes?.status !== "success") {
        throw new APIError("BAD_REQUEST", {
          message: "Failed to process prorated charge via saved authorization.",
        });
      }

      await store.createTransaction({
        reference: sdkRes.reference ?? "",
        paystackId: sdkRes.id !== undefined && sdkRes.id !== null ? String(sdkRes.id) : undefined,
        referenceId: input.referenceId,
        userId: input.userId,
        amount: sdkRes.amount ?? proratedAmount,
        currency: sdkRes.currency ?? input.finalCurrency,
        status: "success",
        plan: input.plan.name.toLowerCase(),
        metadata: JSON.stringify(prorationMetadata),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      completedProrationReference = sdkRes.reference ?? undefined;
    } else {
      const initRes = await paystack.initializeTransaction({
        email: input.targetEmail,
        amount: proratedAmount,
        currency: input.finalCurrency,
        callback_url: input.callbackURL ?? undefined,
        metadata: JSON.stringify(prorationMetadata),
        ...(input.allowedSubscriptionChannels !== undefined
          ? { channels: input.allowedSubscriptionChannels }
          : {}),
      } as components["schemas"]["TransactionInitialize"]);

      await store.createTransaction({
        reference: initRes?.reference ?? "",
        referenceId: input.referenceId,
        userId: input.userId,
        amount: proratedAmount,
        currency: input.finalCurrency,
        status: "pending",
        plan: input.plan.name.toLowerCase(),
        metadata: JSON.stringify(prorationMetadata),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        kind: "checkout",
        url: initRes?.authorization_url,
        reference: initRes?.reference,
        accessCode: initRes?.access_code,
        redirect: true,
      };
    }
  }

  await store.updateSubscription(existingSub.id, {
    plan: input.plan.name,
    seats: newSeatCount,
    ...(completedProrationReference !== undefined
      ? { paystackTransactionReference: completedProrationReference }
      : {}),
    updatedAt: new Date(),
  });

  return {
    kind: "completed",
    status: "success",
    message: "Subscription successfully upgraded with prorated charge.",
    prorated: true,
  };
}
