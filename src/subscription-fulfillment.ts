import { createHash, randomUUID } from "node:crypto";

import type { GenericEndpointContext } from "better-auth";
import { APIError } from "better-auth/api";
import * as z from "zod/v4";

import { createBillingStore } from "./billing-store.ts";
import { PAYSTACK_MODELS } from "./models.ts";
import type {
  AnyPaystackOptions,
  PaystackPlan,
  PaystackWebhookPayload,
  PaystackWebhookEventRecord,
  Subscription,
} from "./types.ts";

const progressSchema = z.object({
  version: z.literal(1),
  completed: z.array(z.enum(["complete", "update", "trialStart"])),
  remoteCreationSubmitted: z.boolean().optional(),
  remoteSubscriptionCode: z.string().optional(),
});
interface Claim {
  eventId: string;
  status: string;
  progress: z.infer<typeof progressSchema>;
}
const unavailable = () =>
  new APIError("SERVICE_UNAVAILABLE", {
    message: "Subscription fulfillment is pending. Retry verification.",
  });

/** Persist delivery intent before activation, sharing one lease across verification transports. */
export async function claimSubscriptionFulfillment(
  ctx: GenericEndpointContext,
  reference: string,
  subscription: Subscription,
  phase = "subscription-fulfillment",
): Promise<Claim | null> {
  const store = createBillingStore(ctx);
  const eventId = `${phase}:${createHash("sha256")
    .update(JSON.stringify([reference, subscription.id]))
    .digest("hex")}`;
  const findRecord = () =>
    ctx.context.adapter.findOne<PaystackWebhookEventRecord>({
      model: PAYSTACK_MODELS.webhookEvent,
      where: [{ field: "eventId", value: eventId }],
    });
  let record = await findRecord();
  if (record === null) {
    // Existing entitlements predate this delivery journal; do not replay historical callbacks.
    if (subscription.status !== "incomplete") return null;
    try {
      record = await store.createWebhookEvent({
        eventId,
        event: "subscription.fulfillment",
        reference,
        status: "pending",
        payload: JSON.stringify({ version: 1, completed: [] }),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      record = await findRecord();
      if (record === null) throw error;
    }
  }
  if (record.status === "processed") return null;
  if (
    record.status.startsWith("processing:") &&
    Date.now() - new Date(record.updatedAt).getTime() < 300_000
  )
    throw unavailable();
  const progress = progressSchema.parse(JSON.parse(record.payload));
  const status = `processing:${randomUUID()}`;
  const claimed = await ctx.context.adapter.update({
    model: PAYSTACK_MODELS.webhookEvent,
    where: [
      { field: "eventId", value: eventId },
      { field: "status", value: record.status },
      { field: "updatedAt", value: record.updatedAt },
    ],
    update: { status, updatedAt: new Date() },
  });
  if (claimed === null) throw unavailable();
  return { eventId, status, progress };
}

export async function deliverTrialStart(
  ctx: GenericEndpointContext,
  claim: Claim,
  subscription: Subscription,
  plan: PaystackPlan | undefined,
): Promise<void> {
  if (!claim.progress.completed.includes("trialStart")) {
    await checkpoint(ctx, claim);
    await plan?.freeTrial?.onTrialStart?.(subscription);
    claim.progress.completed.push("trialStart");
    await checkpoint(ctx, claim);
  }
  await checkpoint(ctx, claim, true);
}

export async function reserveRemoteTrialSubscription(
  ctx: GenericEndpointContext,
  claim: Claim,
  create: () => Promise<string | undefined>,
): Promise<string> {
  if (claim.progress.remoteSubscriptionCode !== undefined)
    return claim.progress.remoteSubscriptionCode;
  if (claim.progress.remoteCreationSubmitted === true)
    throw new APIError("SERVICE_UNAVAILABLE", {
      message:
        "Remote trial subscription creation is unresolved. Reconcile the existing provider subscription before retrying.",
    });
  claim.progress.remoteCreationSubmitted = true;
  await checkpoint(ctx, claim);
  const code = await create();
  if (code === undefined || code === "") throw unavailable();
  claim.progress.remoteSubscriptionCode = code;
  await checkpoint(ctx, claim);
  return code;
}

async function checkpoint(
  ctx: GenericEndpointContext,
  claim: Claim,
  processed = false,
): Promise<void> {
  const updated = await ctx.context.adapter.update({
    model: PAYSTACK_MODELS.webhookEvent,
    where: [
      { field: "eventId", value: claim.eventId },
      { field: "status", value: claim.status },
    ],
    update: {
      payload: JSON.stringify(claim.progress),
      updatedAt: new Date(),
      ...(processed ? { status: "processed", processedAt: new Date() } : {}),
    },
  });
  if (updated === null) throw unavailable();
}

export async function deliverSubscriptionFulfillment(
  ctx: GenericEndpointContext,
  options: AnyPaystackOptions,
  claim: Claim,
  subscription: Subscription,
  plan: PaystackPlan | undefined,
  event: PaystackWebhookPayload,
): Promise<void> {
  if (plan !== undefined) {
    const callbacks = {
      complete: options.subscription?.onSubscriptionComplete,
      update: options.subscription?.onSubscriptionUpdate,
    };
    for (const name of ["complete", "update"] as const) {
      if (claim.progress.completed.includes(name)) continue;
      // Refresh ownership before invoking application code. Hooks must still be idempotent:
      // a process can stop after its side effect and before this journal checkpoint.
      await checkpoint(ctx, claim);
      await callbacks[name]?.({ event, subscription, plan }, ctx);
      claim.progress.completed.push(name);
      await checkpoint(ctx, claim);
    }
  }
  await checkpoint(ctx, claim, true);
}

export async function releaseSubscriptionFulfillment(
  ctx: GenericEndpointContext,
  claim: Claim,
): Promise<void> {
  await ctx.context.adapter.update({
    model: PAYSTACK_MODELS.webhookEvent,
    where: [
      { field: "eventId", value: claim.eventId },
      { field: "status", value: claim.status },
    ],
    update: { status: "pending", updatedAt: new Date() },
  });
}
