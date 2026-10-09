import type { components } from "@alexasomba/paystack-node";
import type { GenericEndpointContext } from "better-auth";
import { APIError } from "better-auth/api";

import { createBillingStore } from "./billing-store.ts";
import { getOrganizationSubscription } from "./limits.ts";
import { createProrationMetadata, stringifyPaystackMetadata } from "./metadata.ts";
import { PAYSTACK_MODELS } from "./models.ts";
import { readPaystackPaymentCredentials } from "./payment-credentials.ts";
import { createPaystackAdapter } from "./paystack-sdk.ts";
import type {
  AnyPaystackOptions,
  PaystackChargeAuthorizationResponse,
  PaystackCheckoutChannel,
  PaystackInitializeResult,
  PaystackPlan,
  Subscription,
  User,
  PaystackSubscriptionOperation,
  PaystackSubscriptionOperationPhase,
} from "./types.ts";
import {
  assertLocallyManagedSubscription,
  calculatePlanAmount,
  getPlanByName,
  getPlanSeatAmount,
  normalizeSubscriptionGroup,
} from "./utils.ts";

/** Keep reservation context invocation-local, including concurrent requests through one plugin. */
export async function runSubscriptionOperation<TResult extends PaystackInitializeResult>(
  ctx: GenericEndpointContext,
  options: AnyPaystackOptions | undefined,
  operation: PaystackSubscriptionOperation,
  run: (
    providerReference: string | undefined,
    setPhase: (phase: PaystackSubscriptionOperationPhase) => void,
  ) => Promise<TResult>,
): Promise<TResult> {
  const hooks = options?.subscription?.operationHooks;
  if (hooks === undefined) return run(undefined, () => undefined);
  const decision = await hooks.before(operation, ctx);
  if (decision.kind === "replay") {
    const validKind =
      operation.kind === "schedule"
        ? decision.result.kind === "scheduled"
        : operation.kind === "initialize"
          ? decision.result.kind === "checkout"
          : operation.kind === "local-change"
            ? decision.result.kind === "prorated"
            : decision.result.kind === "checkout" || decision.result.kind === "prorated";
    if (!validKind)
      throw new APIError("BAD_REQUEST", {
        message: "Operation replay does not match the validated operation kind.",
      });
    return decision.result as TResult;
  }
  if (decision.kind === "block") {
    throw new APIError("CONFLICT", {
      message: decision.message ?? "Subscription operation is blocked.",
    });
  }
  if (
    decision.kind !== "proceed" ||
    typeof decision.providerReference !== "string" ||
    decision.providerReference.trim() === ""
  ) {
    throw new APIError("BAD_REQUEST", {
      message: "Operation hook must reserve a provider reference.",
    });
  }
  const invocation = {
    ...operation,
    providerReference: decision.providerReference,
    context: decision.context,
  };
  let phase: PaystackSubscriptionOperationPhase =
    operation.kind === "schedule" || operation.kind === "local-change" ? "persistence" : "provider";
  try {
    const result = await run(decision.providerReference, (next) => {
      phase = next;
    });
    phase = "completion";
    await hooks.after?.({ ...invocation, result }, ctx);
    return result;
  } catch (error: unknown) {
    try {
      await hooks.onError?.({ ...invocation, phase, error }, ctx);
    } catch {
      ctx.context.logger.error("Paystack operation error hook failed", { phase });
    }
    throw error;
  }
}

export type ProratedUpgradeOutcome =
  | Extract<PaystackInitializeResult, { kind: "prorated" }>
  | {
      kind: "checkout";
      url: string | undefined;
      reference: string | undefined;
      accessCode: string | undefined;
      redirect: true;
    };

export interface TrialLifecycleDecision {
  trialStart?: Date;
  trialEnd?: Date;
  requestedDays: number;
  requested: boolean;
  granted: boolean;
  deniedReason?: "already_used";
}

export async function scheduleSubscriptionLifecycleChange(
  ctx: GenericEndpointContext,
  input: {
    userId?: string;
    referenceId: string;
    subscriptionId?: string;
    plan?: PaystackPlan;
    scheduleAtPeriodEnd?: boolean;
    cancelAtPeriodEnd?: boolean;
  },
  options?: AnyPaystackOptions,
): Promise<Extract<PaystackInitializeResult, { kind: "scheduled" }> | null> {
  const groupId = normalizeSubscriptionGroup(input.plan?.group);
  if (input.plan !== undefined && input.scheduleAtPeriodEnd === true) {
    const existingSub =
      input.subscriptionId === undefined
        ? await getOrganizationSubscription(ctx, input.referenceId, groupId)
        : await createBillingStore(ctx).findSubscriptionById(input.subscriptionId);
    if (existingSub?.status === "active") {
      return runSubscriptionOperation<Extract<PaystackInitializeResult, { kind: "scheduled" }>>(
        ctx,
        options,
        {
          actor: { id: input.userId ?? existingSub.userId },
          referenceId: input.referenceId,
          kind: "schedule",
          subscription: existingSub,
          intent: {
            plan: input.plan?.name ?? existingSub.plan,
            interval: input.plan?.interval ?? existingSub.billingInterval ?? undefined,
            groupId,
            scheduleAtPeriodEnd: input.scheduleAtPeriodEnd,
            cancelAtPeriodEnd: input.cancelAtPeriodEnd,
          },
        },
        async () => {
          await ctx.context.adapter.update({
            model: PAYSTACK_MODELS.subscription,
            where: [{ field: "id", value: existingSub.id }],
            update: {
              pendingPlan: input.plan?.name,
              updatedAt: new Date(),
            },
          });
          return {
            kind: "scheduled",
            status: "success",
            message: "Plan change scheduled at period end.",
            scheduled: true,
          };
        },
      );
    }
  }

  if (input.cancelAtPeriodEnd === true) {
    const existingSub =
      input.subscriptionId === undefined
        ? await getOrganizationSubscription(
            ctx,
            input.referenceId,
            input.plan === undefined ? undefined : groupId,
          )
        : await createBillingStore(ctx).findSubscriptionById(input.subscriptionId);
    if (existingSub?.status === "active") {
      return runSubscriptionOperation<Extract<PaystackInitializeResult, { kind: "scheduled" }>>(
        ctx,
        options,
        {
          actor: { id: input.userId ?? existingSub.userId },
          referenceId: input.referenceId,
          kind: "schedule",
          subscription: existingSub,
          intent: {
            plan: input.plan?.name ?? existingSub.plan,
            interval: input.plan?.interval ?? existingSub.billingInterval ?? undefined,
            groupId,
            scheduleAtPeriodEnd: input.scheduleAtPeriodEnd,
            cancelAtPeriodEnd: input.cancelAtPeriodEnd,
          },
        },
        async () => {
          await ctx.context.adapter.update({
            model: PAYSTACK_MODELS.subscription,
            where: [{ field: "id", value: existingSub.id }],
            update: {
              cancelAtPeriodEnd: true,
              cancelAt: existingSub.periodEnd ?? null,
              canceledAt: new Date(),
              updatedAt: new Date(),
            },
          });

          return {
            kind: "scheduled",
            status: "success",
            message: "Subscription cancellation scheduled at period end.",
            scheduled: true,
          };
        },
      );
    }
  }

  return null;
}

export async function resolveTrialLifecycle(
  ctx: GenericEndpointContext,
  input: {
    referenceId: string;
    plan?: PaystackPlan;
  },
): Promise<TrialLifecycleDecision> {
  const requestedDays =
    input.plan?.freeTrial?.days !== undefined && input.plan.freeTrial.days > 0
      ? input.plan.freeTrial.days
      : 0;
  const requested = requestedDays > 0;
  if (!requested) {
    return {
      requestedDays,
      requested: false,
      granted: false,
    };
  }

  const previousTrials = await ctx.context.adapter.findMany<Subscription>({
    model: PAYSTACK_MODELS.subscription,
    where: [{ field: "referenceId", value: input.referenceId }],
  });
  const hadTrial = previousTrials?.some(
    (subscription) =>
      (subscription.trialStart !== undefined && subscription.trialStart !== null) ||
      (subscription.trialEnd !== undefined && subscription.trialEnd !== null) ||
      subscription.status === "trialing",
  );

  if (hadTrial === true) {
    return {
      requestedDays,
      requested,
      granted: false,
      deniedReason: "already_used",
    };
  }

  const trialStart = new Date();
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + requestedDays);

  return {
    trialStart,
    trialEnd,
    requestedDays,
    requested,
    granted: true,
  };
}

export async function resolveCheckoutTargetEmail(
  ctx: GenericEndpointContext,
  options: AnyPaystackOptions,
  input: {
    email?: string;
    referenceId: string;
    user: User;
  },
): Promise<string> {
  const targetEmail = input.email ?? input.user.email;

  if (
    options.organization?.enabled !== true ||
    input.referenceId === input.user.id ||
    input.referenceId === ""
  ) {
    return targetEmail;
  }

  const org = await ctx.context.adapter.findOne({
    model: "organization",
    where: [{ field: "id", value: input.referenceId }],
  });
  if (org === undefined || org === null) {
    return targetEmail;
  }

  const orgWithEmail = org as { email?: string | null };
  if (
    orgWithEmail.email !== undefined &&
    orgWithEmail.email !== null &&
    orgWithEmail.email !== ""
  ) {
    return orgWithEmail.email;
  }

  const ownerMember = await ctx.context.adapter.findOne({
    model: "member",
    where: [
      { field: "organizationId", value: input.referenceId },
      { field: "role", value: "owner" },
    ],
  });

  if (ownerMember === undefined || ownerMember === null) {
    return targetEmail;
  }

  const ownerUser = await ctx.context.adapter.findOne<User>({
    model: "user",
    where: [{ field: "id", value: (ownerMember as { userId: string }).userId }],
  });

  return ownerUser?.email !== undefined && ownerUser.email !== "" ? ownerUser.email : targetEmail;
}

export async function handleProratedUpgrade(
  ctx: GenericEndpointContext,
  options: AnyPaystackOptions,
  input: {
    plan: PaystackPlan;
    referenceId: string;
    subscriptionId?: string;
    quantity?: number;
    targetEmail: string;
    userId: string;
    finalCurrency: string;
    callbackURL?: string;
    allowedSubscriptionChannels?: PaystackCheckoutChannel[];
  },
): Promise<ProratedUpgradeOutcome | null> {
  const store = createBillingStore(ctx);
  const existingSub =
    input.subscriptionId === undefined
      ? await store.findCurrentSubscription(
          input.referenceId,
          normalizeSubscriptionGroup(input.plan.group),
        )
      : await store.findSubscriptionById(input.subscriptionId);
  if (
    existingSub?.status !== "active" ||
    existingSub.subscriptionCode === undefined ||
    existingSub.subscriptionCode === null ||
    existingSub.subscriptionCode === "" ||
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
      oldAmount = calculatePlanAmount(oldPlan, existingSub.seats ?? 1);
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
  const prorationMetadata = createProrationMetadata({
    subscriptionId: existingSub.id,
    referenceId: input.referenceId,
    newPlan: input.plan.name.toLowerCase(),
    oldPlan: existingSub.plan,
    newSeatCount,
    remainingDays,
  });
  const serializedProrationMetadata = stringifyPaystackMetadata(prorationMetadata);
  const proratedAmount = Math.round((costDifference / totalDays) * remainingDays);
  const hasCharge = costDifference > 0 && remainingDays > 0;
  if (hasCharge && proratedAmount < 5000) {
    throw new APIError("BAD_REQUEST", {
      message:
        "Prorated upgrade amount is below Paystack's minimum charge. Schedule the change for period end instead.",
      status: 400,
    });
  }
  const credentials = hasCharge
    ? await readPaystackPaymentCredentials(ctx.context.adapter, options, existingSub.id)
    : null;
  const hasAuthorization =
    credentials?.authorizationCode !== undefined &&
    credentials.authorizationCode !== null &&
    credentials.authorizationCode !== "";
  return runSubscriptionOperation<Exclude<PaystackInitializeResult, { kind: "scheduled" }>>(
    ctx,
    options,
    {
      actor: { id: input.userId ?? existingSub.userId },
      referenceId: input.referenceId,
      kind: hasCharge
        ? hasAuthorization
          ? "proration-charge"
          : "proration-initialize"
        : "local-change",
      subscription: existingSub,
      intent: {
        plan: input.plan.name.toLowerCase(),
        amount: hasCharge ? proratedAmount : 0,
        currency: input.finalCurrency,
        interval: input.plan.interval,
        quantity: newSeatCount,
        groupId: normalizeSubscriptionGroup(input.plan.group),
        callbackURL: input.callbackURL,
      },
    },
    async (providerReference, setPhase) => {
      let completedProrationReference: string | undefined;

      if (costDifference > 0 && remainingDays > 0) {
        const paystack = createPaystackAdapter(options.paystackClient);
        if (
          credentials?.authorizationCode !== undefined &&
          credentials.authorizationCode !== null &&
          credentials.authorizationCode !== ""
        ) {
          const sdkRes = (await paystack.chargeAuthorization({
            email: input.targetEmail,
            amount: proratedAmount,
            authorization_code: credentials.authorizationCode,
            reference:
              providerReference ??
              `upg_${existingSub.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            metadata: serializedProrationMetadata,
          })) as PaystackChargeAuthorizationResponse;

          if (providerReference !== undefined && sdkRes?.reference !== providerReference) {
            throw new APIError("BAD_REQUEST", {
              message: "Provider reference does not match reserved operation.",
            });
          }
          if (sdkRes?.status !== "success") {
            throw new APIError("BAD_REQUEST", {
              message: "Failed to process prorated charge via saved authorization.",
            });
          }

          setPhase("persistence");
          await store.createTransaction({
            reference: sdkRes.reference ?? "",
            paystackId:
              sdkRes.id !== undefined && sdkRes.id !== null ? String(sdkRes.id) : undefined,
            referenceId: input.referenceId,
            userId: input.userId,
            amount: sdkRes.amount ?? proratedAmount,
            currency: sdkRes.currency ?? input.finalCurrency,
            status: "success",
            plan: input.plan.name.toLowerCase(),
            metadata: serializedProrationMetadata,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          completedProrationReference = sdkRes.reference ?? undefined;
        } else {
          const initRes = await paystack.initializeTransaction({
            ...(providerReference !== undefined ? { reference: providerReference } : {}),
            email: input.targetEmail,
            amount: proratedAmount,
            currency: input.finalCurrency,
            callback_url: input.callbackURL ?? undefined,
            metadata: serializedProrationMetadata,
            ...(input.allowedSubscriptionChannels !== undefined
              ? { channels: input.allowedSubscriptionChannels }
              : {}),
          } as components["schemas"]["TransactionInitialize"]);

          if (providerReference !== undefined && initRes?.reference !== providerReference) {
            throw new APIError("BAD_REQUEST", {
              message: "Provider reference does not match reserved operation.",
            });
          }
          setPhase("persistence");
          await store.createTransaction({
            reference: initRes?.reference ?? "",
            referenceId: input.referenceId,
            userId: input.userId,
            amount: proratedAmount,
            currency: input.finalCurrency,
            status: "pending",
            plan: input.plan.name.toLowerCase(),
            metadata: serializedProrationMetadata,
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

      setPhase("persistence");
      await store.updateSubscription(existingSub.id, {
        plan: input.plan.name,
        seats: newSeatCount,
        ...(completedProrationReference !== undefined
          ? { transactionReference: completedProrationReference }
          : {}),
        updatedAt: new Date(),
      });

      return {
        kind: "prorated",
        status: "success",
        message: "Subscription successfully upgraded with prorated charge.",
        prorated: true,
      };
    },
  );
}
