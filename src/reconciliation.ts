import type { components } from "@alexasomba/paystack-node";
import type { GenericEndpointContext } from "better-auth";
import { APIError } from "better-auth/api";

import { createBillingStore } from "./billing-store";
import {
  getMetadataBoolean,
  getMetadataNumber,
  getMetadataString,
  parsePaystackMetadata,
} from "./metadata";
import { savePaystackPaymentCredentials } from "./payment-credentials";
import { getPaystackOps, unwrapSdkResult } from "./paystack-sdk";
import { authorizeBillingReference } from "./reference-access";
import type {
  AnyPaystackOptions,
  PaystackCheckoutChannel,
  PaystackTransaction,
  PaystackTransactionResponse,
  PaystackWebhookPayload,
  Session,
  Subscription,
  User,
} from "./types";
import { getPlans, syncProductQuantityFromPaystack } from "./utils";

export type PaystackReconciliationSource = "webhook" | "queue" | "admin" | "server" | "browser";

export interface ReconcilePaystackTransactionInput {
  reference: string;
  source?: PaystackReconciliationSource;
  referenceId?: string;
  actor?: {
    user: User;
    session: Session;
  };
  throwOnError?: boolean;
}

export interface PaystackReconciliationError {
  code: string;
  message: string;
  status?: number;
}

export interface PaystackReconciliationSummary {
  transaction: {
    found: boolean;
    updated: boolean;
    referenceId?: string;
    previousStatus?: string;
    status?: string;
  };
  subscription: {
    found: boolean;
    updated: boolean;
    id?: string;
    status?: string;
    prorationApplied: boolean;
  };
  customer: {
    saved: boolean;
    referenceId?: string;
    customerCode?: string;
    model?: "user" | "organization";
  };
  product: {
    synced: boolean;
    name?: string;
  };
}

export interface ReconcilePaystackTransactionSuccess extends PaystackReconciliationSummary {
  ok: true;
  source: PaystackReconciliationSource;
  status: string;
  reference: string;
  data: PaystackTransactionResponse;
  error?: undefined;
}

export interface ReconcilePaystackTransactionFailure extends PaystackReconciliationSummary {
  ok: false;
  source: PaystackReconciliationSource;
  status: string;
  reference: string;
  data: PaystackTransactionResponse | null;
  error: PaystackReconciliationError;
}

export type ReconcilePaystackTransactionResult =
  | ReconcilePaystackTransactionSuccess
  | ReconcilePaystackTransactionFailure;

function getAllowedSubscriptionChannels(
  options: AnyPaystackOptions,
): PaystackCheckoutChannel[] | undefined {
  const channels = options.subscription?.allowedPaymentChannels;
  return Array.isArray(channels) && channels.length > 0 ? channels : undefined;
}

function isAllowedSubscriptionChannel(
  channel: string | null | undefined,
  allowedChannels: readonly PaystackCheckoutChannel[] | undefined,
): boolean {
  if (allowedChannels === undefined) return true;
  return channel !== undefined && channel !== null && allowedChannels.includes(channel as never);
}

function createSummary(): PaystackReconciliationSummary {
  return {
    transaction: {
      found: false,
      updated: false,
    },
    subscription: {
      found: false,
      updated: false,
      prorationApplied: false,
    },
    customer: {
      saved: false,
    },
    product: {
      synced: false,
    },
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message !== "" ? error.message : fallback;
}

function createFailureResult(input: {
  source: PaystackReconciliationSource;
  status: string;
  reference: string;
  data: PaystackTransactionResponse | null;
  summary: PaystackReconciliationSummary;
  error: PaystackReconciliationError;
}): ReconcilePaystackTransactionFailure {
  return {
    ok: false,
    source: input.source,
    status: input.status,
    reference: input.reference,
    data: input.data,
    error: input.error,
    ...input.summary,
  };
}

function throwOrReturnFailure(
  input: {
    throwOnError: boolean;
    apiStatus: "BAD_REQUEST" | "UNAUTHORIZED";
  } & Parameters<typeof createFailureResult>[0],
): ReconcilePaystackTransactionFailure {
  if (input.throwOnError) {
    throw new APIError(input.apiStatus, {
      code: input.error.code,
      message: input.error.message,
      status: input.error.status,
    });
  }

  return createFailureResult(input);
}

function hasReferenceMismatch(input: {
  expectedReferenceId?: string;
  transactionReferenceId?: string | null;
}): boolean {
  return (
    input.expectedReferenceId !== undefined &&
    input.expectedReferenceId !== "" &&
    input.transactionReferenceId !== undefined &&
    input.transactionReferenceId !== null &&
    input.transactionReferenceId !== "" &&
    input.expectedReferenceId !== input.transactionReferenceId
  );
}

function getNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

export async function reconcilePaystackTransaction(
  ctx: GenericEndpointContext,
  options: AnyPaystackOptions,
  input: ReconcilePaystackTransactionInput,
): Promise<ReconcilePaystackTransactionResult> {
  const source = input.source ?? "server";
  const throwOnError = input.throwOnError === true;
  const summary = createSummary();
  const paystack = getPaystackOps(options.paystackClient);
  let data: PaystackTransactionResponse | undefined;

  try {
    const verifyRaw = await paystack?.transaction?.verify(input.reference);
    data = unwrapSdkResult<PaystackTransactionResponse>(verifyRaw);
  } catch (error: unknown) {
    ctx.context.logger.error("Failed to verify Paystack transaction", error);
    return throwOrReturnFailure({
      throwOnError,
      apiStatus: "BAD_REQUEST",
      source,
      status: "error",
      reference: input.reference,
      data: null,
      summary,
      error: {
        code: "FAILED_TO_VERIFY_TRANSACTION",
        message: getErrorMessage(error, "Failed to verify transaction"),
        status: 400,
      },
    });
  }

  if (data === undefined || data === null) {
    return throwOrReturnFailure({
      throwOnError,
      apiStatus: "BAD_REQUEST",
      source,
      status: "error",
      reference: input.reference,
      data: null,
      summary,
      error: {
        code: "FAILED_TO_VERIFY_TRANSACTION",
        message: "Failed to fetch transaction data from Paystack.",
        status: 400,
      },
    });
  }

  const status = data.status ?? "failed";
  const reference = data.reference ?? input.reference;
  const paystackIdRaw = (data as { id?: number | string | null }).id;
  const paystackId =
    paystackIdRaw !== undefined && paystackIdRaw !== null ? String(paystackIdRaw) : undefined;
  const authorizationCode = (data.authorization as { authorization_code?: string | null } | null)
    ?.authorization_code;
  const store = createBillingStore(ctx);
  const txRecord = await store.findTransactionByReference(reference);
  summary.transaction.found = txRecord !== null;
  summary.transaction.previousStatus = txRecord?.status;

  if (
    hasReferenceMismatch({
      expectedReferenceId: input.referenceId,
      transactionReferenceId: txRecord?.referenceId,
    })
  ) {
    return throwOrReturnFailure({
      throwOnError,
      apiStatus: "UNAUTHORIZED",
      source,
      status,
      reference,
      data,
      summary,
      error: {
        code: "REFERENCE_ID_MISMATCH",
        message: "Transaction reference does not belong to the expected billing reference.",
        status: 401,
      },
    });
  }

  const referenceId =
    input.referenceId ??
    getNonEmptyString(txRecord?.referenceId) ??
    getNonEmptyString(input.actor?.user.id);
  summary.transaction.referenceId = referenceId;

  if (
    input.actor !== undefined &&
    referenceId !== undefined &&
    referenceId !== input.actor.user.id
  ) {
    try {
      await authorizeBillingReference(ctx, options, {
        user: input.actor.user,
        session: input.actor.session,
        referenceId,
        action: "verify-transaction",
      });
    } catch (error: unknown) {
      return throwOrReturnFailure({
        throwOnError,
        apiStatus: "UNAUTHORIZED",
        source,
        status,
        reference,
        data,
        summary,
        error: {
          code: "UNAUTHORIZED",
          message: getErrorMessage(error, "Not authorized to reconcile this transaction."),
          status: 401,
        },
      });
    }
  }

  const transactionUpdate: Partial<PaystackTransaction> & Record<string, unknown> = {
    status,
    paystackId,
    amount: data.amount,
    currency: data.currency,
    updatedAt: new Date(),
  };
  const updatedTransaction = await store.updateTransactionByReference(reference, transactionUpdate);
  summary.transaction.updated = updatedTransaction !== null;
  summary.transaction.status = status;

  if (status !== "success") {
    return {
      ok: true,
      source,
      status,
      reference,
      data,
      ...summary,
    };
  }

  const allowedSubscriptionChannels = getAllowedSubscriptionChannels(options);
  const isSubscriptionFlow =
    (txRecord?.plan !== undefined && txRecord.plan !== null && txRecord.plan !== "") ||
    Boolean((data as { plan?: unknown }).plan);

  if (
    isSubscriptionFlow &&
    isAllowedSubscriptionChannel(data.channel ?? undefined, allowedSubscriptionChannels) === false
  ) {
    await store.updateTransactionByReference(reference, {
      ...transactionUpdate,
      status: "failed",
    });
    summary.transaction.updated = true;
    summary.transaction.status = "failed";

    return throwOrReturnFailure({
      throwOnError,
      apiStatus: "BAD_REQUEST",
      source,
      status: "failed",
      reference,
      data,
      summary,
      error: {
        code: "SUBSCRIPTION_PAYMENT_CHANNEL_NOT_ALLOWED",
        message: `This subscription requires one of: ${allowedSubscriptionChannels?.join(", ") ?? "allowed channels"}.`,
        status: 400,
      },
    });
  }

  const paystackCustomerCodeFromPaystack = data.customer?.customer_code;
  if (
    paystackCustomerCodeFromPaystack !== undefined &&
    paystackCustomerCodeFromPaystack !== null &&
    paystackCustomerCodeFromPaystack !== "" &&
    referenceId !== undefined &&
    referenceId !== ""
  ) {
    let isOrganization =
      options.organization?.enabled === true &&
      typeof referenceId === "string" &&
      referenceId.startsWith("org_");
    if (isOrganization === false && options.organization?.enabled === true) {
      const organization = await store.findOrganization(referenceId);
      isOrganization = organization !== null;
    }

    await store.saveCustomerCode(
      referenceId,
      paystackCustomerCodeFromPaystack,
      isOrganization,
      data.customer?.email,
    );
    summary.customer.saved = true;
    summary.customer.referenceId = referenceId;
    summary.customer.customerCode = paystackCustomerCodeFromPaystack;
    summary.customer.model = isOrganization ? "organization" : "user";
  }

  const transaction = updatedTransaction ?? (await store.findTransactionByReference(reference));
  if (
    transaction !== undefined &&
    transaction !== null &&
    transaction.product !== undefined &&
    transaction.product !== null &&
    transaction.product !== "" &&
    options.paystackClient !== undefined &&
    options.paystackClient !== null
  ) {
    await syncProductQuantityFromPaystack(ctx, transaction.product, options.paystackClient);
    summary.product.synced = true;
    summary.product.name = transaction.product;
  }

  if (options.subscription?.enabled !== true) {
    return {
      ok: true,
      source,
      status,
      reference,
      data,
      ...summary,
    };
  }

  const metadataObj = parsePaystackMetadata(data.metadata);
  const isTrial = getMetadataBoolean(metadataObj, "isTrial");
  const trialEnd = getMetadataString(metadataObj, "trialEnd");
  const targetPlan = getMetadataString(metadataObj, "plan");

  if (metadataObj.type === "proration") {
    const subscriptionId = getMetadataString(metadataObj, "subscriptionId");
    const newPlan = getMetadataString(metadataObj, "newPlan");
    const newSeatCount = getMetadataNumber(metadataObj, "newSeatCount");

    if (
      subscriptionId !== undefined &&
      subscriptionId !== "" &&
      newPlan !== undefined &&
      newPlan !== ""
    ) {
      const updatedSubscription = await store.updateSubscription(subscriptionId, {
        plan: newPlan,
        ...(typeof newSeatCount === "number" ? { seats: newSeatCount } : {}),
        transactionReference: reference,
        updatedAt: new Date(),
      });
      summary.subscription.found = updatedSubscription !== null;
      summary.subscription.updated = updatedSubscription !== null;
      summary.subscription.id = updatedSubscription?.id ?? subscriptionId;
      summary.subscription.status = updatedSubscription?.status;
      summary.subscription.prorationApplied = updatedSubscription !== null;
      if (
        updatedSubscription !== null &&
        authorizationCode !== undefined &&
        authorizationCode !== null &&
        authorizationCode !== ""
      ) {
        await savePaystackPaymentCredentials(ctx.context.adapter, options, updatedSubscription.id, {
          authorizationCode,
        });
      }
    }

    return {
      ok: true,
      source,
      status,
      reference,
      data,
      ...summary,
    };
  }

  let subscriptionCode: string | undefined;
  const existingSubs = await store.findSubscriptionsByTransactionReference(reference);
  const targetSub = existingSubs.find(
    (subscription) =>
      referenceId === undefined || referenceId === "" || subscription.referenceId === referenceId,
  );
  summary.subscription.found = targetSub !== undefined;
  summary.subscription.id = targetSub?.id;
  summary.subscription.status = targetSub?.status;

  if (isTrial && targetPlan !== undefined && trialEnd !== undefined) {
    const email = data.customer?.email;
    const plans = await getPlans(options.subscription);
    const planConfig = plans.find((plan) => plan.name.toLowerCase() === targetPlan.toLowerCase());

    if (
      planConfig !== undefined &&
      planConfig !== null &&
      (planConfig.planCode === undefined ||
        planConfig.planCode === null ||
        planConfig.planCode === "")
    ) {
      subscriptionCode = `LOC_${reference}`;
    } else if (
      targetSub?.subscriptionCode !== undefined &&
      targetSub.subscriptionCode !== null &&
      targetSub.subscriptionCode !== ""
    ) {
      subscriptionCode = targetSub.subscriptionCode;
    } else if (
      authorizationCode !== undefined &&
      authorizationCode !== null &&
      email !== undefined &&
      email !== null &&
      email !== "" &&
      planConfig?.planCode !== undefined &&
      planConfig.planCode !== null &&
      planConfig.planCode !== ""
    ) {
      const subResRaw = await paystack?.subscription?.create({
        body: {
          customer: email,
          plan: planConfig.planCode,
          authorization: authorizationCode,
          start_date: trialEnd,
        },
      });
      const subRes =
        unwrapSdkResult<components["schemas"]["SubscriptionListResponseArray"]>(subResRaw);
      subscriptionCode = subRes?.subscription_code;
    }
  } else if (isTrial === false) {
    const planCodeFromPaystack = (data as { plan?: { plan_code?: string | null } }).plan?.plan_code;
    if (
      planCodeFromPaystack === undefined ||
      planCodeFromPaystack === null ||
      planCodeFromPaystack === ""
    ) {
      subscriptionCode = `LOC_${reference}`;
    } else {
      subscriptionCode =
        (data as { subscription?: { subscription_code?: string | null } }).subscription
          ?.subscription_code ?? undefined;
    }
  }

  let updatedSubscription: Subscription | null = null;
  if (targetSub !== undefined && targetSub !== null) {
    const plans = await getPlans(options.subscription);
    const resolvedPlan = plans.find(
      (candidate) => candidate.name.toLowerCase() === targetSub.plan.toLowerCase(),
    );
    updatedSubscription = await store.updateSubscription(targetSub.id, {
      status: isTrial ? "trialing" : "active",
      billingInterval: resolvedPlan?.interval ?? targetSub.billingInterval ?? null,
      periodStart: new Date(),
      updatedAt: new Date(),
      ...(isTrial && trialEnd !== undefined
        ? {
            trialStart: new Date(),
            trialEnd: new Date(trialEnd),
            periodEnd: new Date(trialEnd),
          }
        : {}),
      ...(subscriptionCode !== undefined ? { subscriptionCode } : {}),
    });
    summary.subscription.updated = updatedSubscription !== null;
    summary.subscription.id = updatedSubscription?.id ?? targetSub.id;
    summary.subscription.status = updatedSubscription?.status ?? targetSub.status;
    if (
      authorizationCode !== undefined &&
      authorizationCode !== null &&
      authorizationCode !== "" &&
      updatedSubscription !== null
    ) {
      await savePaystackPaymentCredentials(ctx.context.adapter, options, updatedSubscription.id, {
        authorizationCode,
      });
    }
    if (
      updatedSubscription !== null &&
      (updatedSubscription.status === "active" || updatedSubscription.status === "trialing")
    ) {
      await store.retireCompetingSubscriptions(
        updatedSubscription.referenceId,
        updatedSubscription.groupId ?? null,
        updatedSubscription.id,
      );
    }
  }

  if (updatedSubscription !== undefined && updatedSubscription !== null) {
    const plans = await getPlans(options.subscription);
    const plan = plans.find(
      (candidate) => candidate.name.toLowerCase() === updatedSubscription.plan.toLowerCase(),
    );
    if (plan !== undefined) {
      const callbackData = {
        event: data as unknown as PaystackWebhookPayload,
        subscription: updatedSubscription,
        plan,
      };
      for (const callback of [
        options.subscription?.onSubscriptionComplete,
        options.subscription?.onSubscriptionUpdate,
      ]) {
        try {
          await callback?.(callbackData, ctx);
        } catch (error) {
          ctx.context.logger.error("Paystack subscription callback failed", error);
        }
      }
      if (targetSub?.status === "trialing" && updatedSubscription.status === "active") {
        try {
          await plan.freeTrial?.onTrialEnd?.(updatedSubscription);
        } catch (error) {
          ctx.context.logger.error("Paystack trial end callback failed", error);
        }
      }
    }
  }

  return {
    ok: true,
    source,
    status,
    reference,
    data,
    ...summary,
  };
}
