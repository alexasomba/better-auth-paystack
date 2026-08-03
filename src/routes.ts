import { createHash } from "node:crypto";
import { HIDE_METADATA } from "better-auth";
import { APIError, getSessionFromCtx, originCheck, sessionMiddleware } from "better-auth/api";
import { createAuthEndpoint } from "better-auth/api";
/* oxlint-disable no-restricted-imports */
import { z } from "zod";
import type { components } from "@alexasomba/paystack-node";
import type {
  GenericEndpointContext,
  MiddlewareInputContext,
  MiddlewareOptions,
  StrictEndpoint,
} from "better-auth";

import type {
  InputPaystackProduct,
  PaystackTransaction,
  AnyPaystackOptions,
  PaystackProduct,
  Subscription,
  Member,
  PaystackPlan,
  PaystackWebhookPayload,
  User,
  PaystackCheckoutChannel,
  PaystackInitializeResult,
} from "./types";
import {
  createCheckoutMetadata,
  hasPaystackMetadata,
  parsePaystackMetadata,
  stringifyPaystackMetadata,
} from "./metadata";
import {
  syncProductQuantityFromPaystack,
  getPlanByName,
  getPlans,
  getProductByName,
  getPlanSeatAmount,
  calculatePlanAmount,
  isLocalSubscriptionCode,
  normalizeSubscriptionGroup,
} from "./utils";
import { referenceMiddleware } from "./middleware";
import { authorizeBillingReference } from "./reference-access";
import { getPaystackOps, unwrapSdkResult } from "./paystack-sdk";
import { createBillingStore } from "./billing-store";
import {
  handleProratedUpgrade,
  resolveCheckoutTargetEmail,
  resolveTrialLifecycle,
  scheduleSubscriptionLifecycleChange,
} from "./subscription-lifecycle";
import { reconcilePaystackTransaction } from "./reconciliation";
import { initializeTransactionBodySchema } from "./route-modules/checkout";
import { getConfiguredCatalog, listStoredPlans, listStoredProducts } from "./route-modules/catalog";
import {
  enableDisableBodySchema,
  tryGetEmailTokenFromSubscriptionManageLink,
} from "./route-modules/subscriptions";
import { getWebhookClientIP, getWebhookHeaders, getWebhookRequest } from "./route-modules/webhook";
import { PAYSTACK_MODELS } from "./models";
import {
  readPaystackPaymentCredentials,
  savePaystackPaymentCredentials,
} from "./payment-credentials";
import {
  getAllowedSubscriptionChannels,
  hmacSha512Hex,
  PAYSTACK_ERROR_CODES,
} from "./route-modules/shared";

export const paystackWebhook = <P extends string = "/webhook">(
  options: AnyPaystackOptions,
  path: P = "/webhook" as P,
): StrictEndpoint<
  P,
  {
    method: "POST";
    metadata: {
      openapi: {
        operationId: string;
      };
      scope: "server";
    };
    cloneRequest: true;
    disableBody: true;
  },
  {
    received: boolean;
  }
> => {
  return createAuthEndpoint(
    path,
    {
      method: "POST",
      metadata: {
        ...HIDE_METADATA,
        openapi: {
          operationId: "handlePaystackWebhook",
        },
      },
      cloneRequest: true,
      disableBody: true,
    },
    async (ctx) => {
      const request = getWebhookRequest(ctx as GenericEndpointContext);
      if (request === undefined || request === null) {
        throw new APIError("BAD_REQUEST", {
          message: "Request object is missing from context",
        });
      }
      const payload = await request.text();
      const headers = getWebhookHeaders(ctx as GenericEndpointContext);
      const signature = headers?.get("x-paystack-signature");

      if (options.webhook?.verifyIP === true) {
        const trustedIPs = options.webhook.trustedIPs ?? [
          "52.31.139.75",
          "52.49.173.169",
          "52.214.14.220",
        ];
        const clientIP = getWebhookClientIP(ctx as GenericEndpointContext, headers);

        if (
          clientIP !== undefined &&
          clientIP !== null &&
          trustedIPs.includes(clientIP) === false
        ) {
          throw new APIError("UNAUTHORIZED", {
            message: `Forbidden IP: ${clientIP}`,
            status: 401,
          });
        }
      }

      if (signature === undefined || signature === null || signature === "") {
        throw new APIError("UNAUTHORIZED", {
          message: "Missing x-paystack-signature header",
          status: 401,
        });
      }

      const expected = await hmacSha512Hex(options.secretKey, payload);
      if (expected !== signature) {
        throw new APIError("UNAUTHORIZED", {
          message: "Invalid Paystack webhook signature",
          status: 401,
        });
      }

      const event = JSON.parse(payload) as PaystackWebhookPayload;
      const eventName = event.event;
      const data = event.data;
      const reference = (data as { reference?: string | null })?.reference;
      const eventId = createHash("sha256").update(payload).digest("hex");
      const store = createBillingStore(ctx);
      let webhookEventsAvailable = true;
      let existingEvent = null;

      try {
        existingEvent = await store.findWebhookEvent(eventId);
      } catch {
        // Keep legacy/custom schemas working until the new table is migrated.
        webhookEventsAvailable = false;
      }

      if (webhookEventsAvailable && existingEvent?.status === "processed") {
        return ctx.json({ received: true });
      }

      if (webhookEventsAvailable && existingEvent === null) {
        try {
          await store.createWebhookEvent({
            eventId,
            eventType: eventName,
            reference: reference ?? null,
            payload,
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } catch {
          // A concurrent delivery may have inserted the same event first.
          try {
            existingEvent = await store.findWebhookEvent(eventId);
            if (existingEvent?.status === "processed") {
              return ctx.json({ received: true });
            }
          } catch {
            // The event table may be missing in a legacy schema.
          }
          webhookEventsAvailable = false;
        }
      }

      // Core Transaction Status Sync (Applies to both one-time and recurring)
      if (eventName === "charge.success") {
        const reference = (data as { reference?: string | null })?.reference;
        const paystackIdRaw = (data as { id?: number | string | null })?.id;
        const paystackId =
          paystackIdRaw !== undefined && paystackIdRaw !== null ? String(paystackIdRaw) : undefined;

        if (reference !== undefined && reference !== null && reference !== "") {
          try {
            await ctx.context.adapter.update({
              model: "paystackTransaction",
              update: {
                status: "success",
                paystackId,
                updatedAt: new Date(),
              },
              where: [{ field: "reference", value: reference }],
            });
          } catch (e) {
            ctx.context.logger.warn("Failed to update transaction status for charge.success", e);
          }

          // Sync product quantity from Paystack after successful charge
          try {
            const transaction = await ctx.context.adapter.findOne<PaystackTransaction>({
              model: "paystackTransaction",
              where: [{ field: "reference", value: reference }],
            });
            if (
              transaction !== undefined &&
              transaction !== null &&
              transaction.product !== undefined &&
              transaction.product !== null &&
              transaction.product !== ""
            ) {
              if (options.paystackClient !== undefined && options.paystackClient !== null) {
                await syncProductQuantityFromPaystack(
                  ctx,
                  transaction.product,
                  options.paystackClient,
                );
              }
            }
          } catch (e) {
            ctx.context.logger.warn("Failed to sync product quantity", e);
          }
        }
      }

      if ((eventName as string) === "charge.failure") {
        const reference = (data as { reference?: string })?.reference;
        if (reference !== undefined && reference !== null && reference !== "") {
          try {
            await ctx.context.adapter.update({
              model: "paystackTransaction",
              update: {
                status: "failed",
                updatedAt: new Date(),
              },
              where: [{ field: "reference", value: reference }],
            });
          } catch (e) {
            ctx.context.logger.warn("Failed to update transaction status for charge.failure", e);
          }
        }
      }

      // Best-effort local state sync for subscription lifecycle.
      if (options.subscription?.enabled === true) {
        try {
          if (eventName === "subscription.create") {
            const subscriptionData =
              data as unknown as components["schemas"]["SubscriptionListResponseArray"];
            const subscriptionCode = subscriptionData.subscription_code ?? "";
            const customerCode = (
              subscriptionData.customer as { customer_code?: string | null } | undefined
            )?.customer_code;
            const planCode = (subscriptionData.plan as { plan_code?: string | null } | undefined)
              ?.plan_code;

            const metadataObj = parsePaystackMetadata(
              (subscriptionData as unknown as { metadata?: unknown }).metadata,
            );
            const referenceIdFromMetadata =
              typeof metadataObj.referenceId === "string" ? metadataObj.referenceId : undefined;
            let planNameFromMetadata =
              typeof metadataObj.plan === "string" ? metadataObj.plan : undefined;
            if (typeof planNameFromMetadata === "string") {
              planNameFromMetadata = planNameFromMetadata.toLowerCase();
            }

            const plans = await getPlans(options.subscription);
            const planFromCode =
              planCode !== undefined && planCode !== null && planCode !== ""
                ? plans.find((p) => p.planCode === planCode)
                : undefined;
            const groupIdFromMetadata =
              typeof metadataObj.groupId === "string"
                ? normalizeSubscriptionGroup(metadataObj.groupId)
                : normalizeSubscriptionGroup(planFromCode?.group);
            const planPart = planFromCode?.name ?? planNameFromMetadata;
            const planName =
              planPart !== undefined && planPart !== null && planPart !== ""
                ? planPart.toLowerCase()
                : undefined;

            if (
              subscriptionCode !== undefined &&
              subscriptionCode !== null &&
              subscriptionCode !== ""
            ) {
              const where: { field: string; value: string | number | boolean | null }[] = [];
              if (
                referenceIdFromMetadata !== undefined &&
                referenceIdFromMetadata !== null &&
                referenceIdFromMetadata !== ""
              ) {
                where.push({ field: "referenceId", value: referenceIdFromMetadata });
              } else if (
                customerCode !== undefined &&
                customerCode !== null &&
                customerCode !== ""
              ) {
                where.push({ field: "customerCode", value: customerCode });
              }
              if (planName !== undefined && planName !== null && planName !== "") {
                where.push({ field: "plan", value: planName });
              }

              if (where.length > 0) {
                const matches = await ctx.context.adapter.findMany<Subscription>({
                  model: PAYSTACK_MODELS.subscription,
                  where: where,
                });
                const subscription = matches?.find((candidate) =>
                  groupIdFromMetadata === null
                    ? candidate.groupId === undefined ||
                      candidate.groupId === null ||
                      candidate.groupId === ""
                    : candidate.groupId === groupIdFromMetadata,
                );
                if (subscription !== undefined && subscription !== null) {
                  const plan =
                    planFromCode ??
                    (planName !== undefined && planName !== null && planName !== ""
                      ? await getPlanByName(options, planName)
                      : undefined);
                  const now = new Date();
                  const persistedSubscription: Subscription = {
                    ...subscription,
                    subscriptionCode,
                    status: "active",
                    billingInterval: plan?.interval ?? subscription.billingInterval ?? null,
                    periodEnd:
                      subscriptionData.next_payment_date !== undefined &&
                      subscriptionData.next_payment_date !== null
                        ? new Date(subscriptionData.next_payment_date)
                        : subscription.periodEnd,
                    updatedAt: now,
                  };
                  await ctx.context.adapter.update({
                    model: PAYSTACK_MODELS.subscription,
                    update: {
                      subscriptionCode: persistedSubscription.subscriptionCode,
                      status: persistedSubscription.status,
                      billingInterval: persistedSubscription.billingInterval,
                      periodEnd: persistedSubscription.periodEnd,
                      updatedAt: persistedSubscription.updatedAt,
                    },
                    where: [{ field: "id", value: subscription.id }],
                  });
                  await createBillingStore(ctx).retireCompetingSubscriptions(
                    subscription.referenceId,
                    subscription.groupId ?? null,
                    subscription.id,
                  );

                  if (plan !== undefined && plan !== null) {
                    const callbackData = { event, subscription: persistedSubscription, plan };
                    for (const callback of [
                      options.subscription.onSubscriptionComplete,
                      options.subscription.onSubscriptionCreated,
                      options.subscription.onSubscriptionUpdate,
                    ]) {
                      try {
                        await callback?.(callbackData, ctx as GenericEndpointContext);
                      } catch (error) {
                        ctx.context.logger.error("Paystack subscription callback failed", error);
                      }
                    }
                    if (subscription.status === "trialing") {
                      try {
                        await plan.freeTrial?.onTrialEnd?.(persistedSubscription);
                      } catch (error) {
                        ctx.context.logger.error("Paystack trial end callback failed", error);
                      }
                    }
                  }
                }
              }
            }
          }

          if (eventName === "subscription.disable" || eventName === "subscription.not_renew") {
            const subscriptionData =
              data as unknown as components["schemas"]["SubscriptionListResponseArray"];
            const subscriptionCode = subscriptionData.subscription_code ?? "";
            if (subscriptionCode !== "") {
              const existing = await ctx.context.adapter.findOne<Subscription>({
                model: PAYSTACK_MODELS.subscription,
                where: [{ field: "subscriptionCode", value: subscriptionCode }],
              });

              let newStatus = "canceled";
              const nextPaymentDate = subscriptionData.next_payment_date;
              const periodEnd =
                nextPaymentDate !== undefined && nextPaymentDate !== null && nextPaymentDate !== ""
                  ? new Date(nextPaymentDate)
                  : existing?.periodEnd !== undefined && existing.periodEnd !== null
                    ? new Date(existing.periodEnd)
                    : undefined;

              if (periodEnd !== undefined && periodEnd.getTime() > Date.now()) {
                newStatus = "active";
              }

              const now = new Date();
              const persistedSubscription =
                existing === null || existing === undefined
                  ? undefined
                  : ({
                      ...existing,
                      status: newStatus,
                      cancelAtPeriodEnd: newStatus === "active",
                      cancelAt: newStatus === "active" ? (periodEnd ?? null) : null,
                      canceledAt: now,
                      endedAt: newStatus === "canceled" ? now : null,
                      ...(periodEnd ? { periodEnd } : {}),
                      updatedAt: now,
                    } as Subscription);
              await ctx.context.adapter.update({
                model: PAYSTACK_MODELS.subscription,
                update: {
                  status: newStatus,
                  cancelAtPeriodEnd: newStatus === "active",
                  cancelAt: newStatus === "active" ? (periodEnd ?? null) : null,
                  canceledAt: now,
                  endedAt: newStatus === "canceled" ? now : null,
                  ...(periodEnd ? { periodEnd } : {}),
                  updatedAt: now,
                },
                where: [{ field: "subscriptionCode", value: subscriptionCode }],
              });

              if (persistedSubscription !== undefined) {
                try {
                  await options.subscription.onSubscriptionCancel?.(
                    { event, subscription: persistedSubscription },
                    ctx as GenericEndpointContext,
                  );
                } catch (error) {
                  ctx.context.logger.error("Paystack subscription cancel callback failed", error);
                }
                const plan = await getPlanByName(options, persistedSubscription.plan);
                if (plan !== undefined && plan !== null) {
                  try {
                    await options.subscription.onSubscriptionUpdate?.(
                      { event, subscription: persistedSubscription, plan },
                      ctx as GenericEndpointContext,
                    );
                  } catch (error) {
                    ctx.context.logger.error("Paystack subscription update callback failed", error);
                  }
                  if (existing?.status === "trialing" && newStatus === "canceled") {
                    try {
                      await plan.freeTrial?.onTrialExpired?.(persistedSubscription);
                    } catch (error) {
                      ctx.context.logger.error("Paystack trial expiry callback failed", error);
                    }
                  }
                }
              }
            }
          }

          // Handle plan changes on renewal
          if (eventName === "charge.success" || eventName === "invoice.update") {
            const subData = (data as { subscription?: { subscription_code?: string | null } })
              ?.subscription;
            const subscriptionCodeRaw =
              subData?.subscription_code ??
              (data as { subscription_code?: string | null })?.subscription_code;
            const subscriptionCode =
              subscriptionCodeRaw !== undefined &&
              subscriptionCodeRaw !== null &&
              subscriptionCodeRaw !== ""
                ? subscriptionCodeRaw
                : undefined;

            if (subscriptionCode !== undefined) {
              const existingSub = await ctx.context.adapter.findOne<Subscription>({
                model: PAYSTACK_MODELS.subscription,
                where: [{ field: "subscriptionCode", value: subscriptionCode }],
              });

              if (
                existingSub !== undefined &&
                existingSub !== null &&
                existingSub.pendingPlan !== undefined &&
                existingSub.pendingPlan !== null &&
                existingSub.pendingPlan !== ""
              ) {
                await ctx.context.adapter.update({
                  model: PAYSTACK_MODELS.subscription,
                  update: {
                    plan: existingSub.pendingPlan,
                    pendingPlan: null,
                    updatedAt: new Date(),
                  },
                  where: [{ field: "id", value: existingSub.id }],
                });
              }
            }
          }
        } catch (_e: unknown) {
          ctx.context.logger.error("Failed to sync Paystack webhook event", _e);
        }
      }

      await options.onEvent?.(event);
      if (webhookEventsAvailable) {
        await store.updateWebhookEvent(eventId, {
          status: "processed",
          processedAt: new Date(),
          updatedAt: new Date(),
        });
      }
      return ctx.json({ received: true });
    },
  );
};

export const initializeTransaction = <P extends string = "/initialize-transaction">(
  options: AnyPaystackOptions,
  path: P = "/initialize-transaction" as P,
): StrictEndpoint<
  P,
  {
    method: "POST";
    body: z.ZodObject<
      {
        plan: z.ZodOptional<z.ZodString>;
        product: z.ZodOptional<z.ZodString>;
        amount: z.ZodOptional<z.ZodNumber>;
        currency: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        referenceId: z.ZodOptional<z.ZodString>;
        subscriptionId: z.ZodOptional<z.ZodString>;
        callbackURL: z.ZodOptional<z.ZodString>;
        quantity: z.ZodOptional<z.ZodNumber>;
        scheduleAtPeriodEnd: z.ZodOptional<z.ZodBoolean>;
        cancelAtPeriodEnd: z.ZodOptional<z.ZodBoolean>;
        prorateAndCharge: z.ZodOptional<z.ZodBoolean>;
      },
      z.core.$strip
    >;
    use: (
      | ((
          getValue: (ctx: GenericEndpointContext) => string | string[],
        ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
      | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
    )[];
  },
  PaystackInitializeResult | undefined
> => {
  const subscriptionOptions = options.subscription;
  const useMiddlewares =
    subscriptionOptions?.enabled === true
      ? [sessionMiddleware, originCheck, referenceMiddleware(options, "initialize-transaction")]
      : [sessionMiddleware, originCheck];

  return createAuthEndpoint(
    path,
    {
      method: "POST",
      body: initializeTransactionBodySchema,
      use: useMiddlewares,
    },
    async (ctx) => {
      const paystack = getPaystackOps(options.paystackClient);
      const {
        plan: planName,
        product: productName,
        amount: bodyAmount,
        currency,
        email,
        metadata: extraMetadata,
        callbackURL,
        quantity,
        scheduleAtPeriodEnd,
        cancelAtPeriodEnd,
        prorateAndCharge,
        subscriptionId,
      } = ctx.body;

      // 1. Validate Callback URL validation (same as before)
      if (callbackURL !== undefined && callbackURL !== null && callbackURL !== "") {
        const checkTrusted = () => {
          try {
            if ((callbackURL as string | undefined)?.startsWith("/") === true) return true;
            const baseUrl =
              ((ctx.context as Record<string, unknown>)?.baseURL as string | undefined) ??
              (ctx.request as unknown as { url?: string })?.url ??
              "";
            if (baseUrl === "") return false;
            const baseOrigin = new URL(baseUrl).origin;
            return new URL(callbackURL).origin === baseOrigin;
          } catch {
            return false;
          }
        };
        if (checkTrusted() === false) {
          throw new APIError("FORBIDDEN", {
            message: "callbackURL is not a trusted origin.",
            status: 403,
          });
        }
      }

      // 2. Get User & Session
      const session = await getSessionFromCtx(ctx);
      if (session === undefined || session === null) throw new APIError("UNAUTHORIZED");
      const user = session.user;

      // 3. Email Verification Check (only if subscription options enforce it)
      if (
        subscriptionOptions?.enabled === true &&
        subscriptionOptions.requireEmailVerification === true &&
        user.emailVerified !== true
      ) {
        throw new APIError("BAD_REQUEST", {
          code: "EMAIL_VERIFICATION_REQUIRED",
          message: PAYSTACK_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED.message,
        });
      }

      // 4. Determine Payment Mode: Subscription (Plan) vs Product vs One-Time (Amount)
      let plan: PaystackPlan | undefined;
      let product: PaystackProduct | InputPaystackProduct | undefined;

      if (planName !== undefined && planName !== null && planName !== "") {
        if (subscriptionOptions?.enabled !== true) {
          throw new APIError("BAD_REQUEST", { message: "Subscriptions are not enabled." });
        }
        plan = (await getPlanByName(options, planName)) ?? undefined;
        if (plan === undefined || plan === null) {
          try {
            // Fallback: Check database for synced plans when that model exists.
            const nativePlan = await ctx.context.adapter.findOne<PaystackPlan>({
              model: "paystackPlan",
              where: [{ field: "name", value: planName }],
            });
            if (nativePlan !== undefined && nativePlan !== null) {
              plan = nativePlan;
            } else {
              const nativePlanByCode = await ctx.context.adapter.findOne<PaystackPlan>({
                model: "paystackPlan",
                where: [{ field: "planCode", value: planName }],
              });
              plan = nativePlanByCode ?? undefined;
            }
          } catch {
            plan = undefined;
          }
        }
        if (plan === undefined || plan === null) {
          throw new APIError("BAD_REQUEST", {
            code: "SUBSCRIPTION_PLAN_NOT_FOUND",
            message: PAYSTACK_ERROR_CODES.SUBSCRIPTION_PLAN_NOT_FOUND.message,
            status: 400,
          });
        }
      } else if (productName !== undefined && productName !== null && productName !== "") {
        if (typeof productName === "string") {
          product = (await getProductByName(options, productName)) ?? undefined;
          // Fallback: Check database for synced products
          product ??=
            (await ctx.context.adapter.findOne<PaystackProduct>({
              model: "paystackProduct",
              where: [{ field: "name", value: productName }],
            })) ?? undefined;
        }
        if (product === undefined || product === null) {
          throw new APIError("BAD_REQUEST", {
            message: `Product '${productName}' not found.`,
            status: 400,
          });
        }
      } else if (bodyAmount === undefined || bodyAmount === null) {
        throw new APIError("BAD_REQUEST", {
          message: "Either 'plan', 'product', or 'amount' is required to initialize a transaction.",
          status: 400,
        });
      }

      let amount =
        bodyAmount ??
        (product as PaystackProduct)?.price ??
        (product as InputPaystackProduct)?.amount;
      const finalCurrency =
        currency ??
        (product as PaystackProduct)?.currency ??
        (product as InputPaystackProduct)?.currency ??
        plan?.currency ??
        "NGN";

      const referenceIdFromCtx = (ctx.context as Record<string, unknown>).referenceId as
        | string
        | undefined;
      const referenceId =
        ctx.body.referenceId ?? referenceIdFromCtx ?? (session.user as { id: string }).id;
      const groupId = normalizeSubscriptionGroup(plan?.group);
      if (subscriptionId !== undefined) {
        const selectedSubscription =
          await createBillingStore(ctx).findSubscriptionById(subscriptionId);
        if (
          selectedSubscription === null ||
          selectedSubscription.referenceId !== referenceId ||
          normalizeSubscriptionGroup(selectedSubscription.groupId) !== groupId
        ) {
          throw new APIError("BAD_REQUEST", {
            message: "Subscription does not belong to the authorized reference and plan group.",
          });
        }
      }

      const scheduledChange = await scheduleSubscriptionLifecycleChange(ctx, {
        referenceId,
        subscriptionId,
        plan,
        scheduleAtPeriodEnd,
        cancelAtPeriodEnd,
      });
      if (scheduledChange !== null) {
        return ctx.json(scheduledChange);
      }

      // Calculate final amount considering seats if applicable
      if (plan !== undefined) {
        try {
          if (getPlanSeatAmount(plan) !== undefined) {
            const members = await ctx.context.adapter.findMany<Member>({
              model: "member",
              where: [{ field: "organizationId", value: referenceId }],
            });
            const seatCount = members.length > 0 ? members.length : 1;
            const quantityToUse = quantity ?? seatCount;
            amount = calculatePlanAmount(plan, quantityToUse);
          }
        } catch (error: unknown) {
          throw new APIError("BAD_REQUEST", {
            message:
              error instanceof Error ? error.message : "Invalid seat configuration for plan.",
          });
        }
      }

      let url: string | undefined;
      let reference: string | undefined;
      let accessCode: string | undefined;

      const trial = await resolveTrialLifecycle(ctx, { referenceId, plan });
      const { trialStart, trialEnd } = trial;

      try {
        const targetEmail = await resolveCheckoutTargetEmail(ctx, options, {
          email,
          referenceId,
          user: user as User,
        });

        const allowedSubscriptionChannels = plan
          ? getAllowedSubscriptionChannels(options)
          : undefined;

        // Construct Metadata
        const metadata = stringifyPaystackMetadata(
          createCheckoutMetadata({
            referenceId,
            userId: user.id,
            plan: plan !== undefined ? plan.name.toLowerCase() : undefined,
            groupId,
            product: product !== undefined ? product.name.toLowerCase() : undefined,
            extra: extraMetadata,
            trial: {
              isTrial: trialStart !== undefined,
              requested: trial.requested,
              granted: trial.granted,
              deniedReason: trial.deniedReason,
              endsAt: trialEnd,
            },
          }),
        );

        const initBody: {
          email: string;
          callback_url?: string;
          metadata?: string;
          currency: string;
          quantity?: number;
          amount?: number;
          plan?: string;
          channels?: PaystackCheckoutChannel[];
          [key: string]: unknown;
        } = {
          email: targetEmail,
          callback_url: callbackURL ?? undefined,
          metadata,
          // If plan/product exists, use its currency; otherwise fallback to provided or default
          currency: finalCurrency,
          quantity,
        };

        if (allowedSubscriptionChannels !== undefined) {
          initBody.channels = allowedSubscriptionChannels;
        }

        // Handle prorateAndCharge for existing active subscriptions
        if (plan !== undefined && prorateAndCharge === true) {
          const proration = await handleProratedUpgrade(ctx, options, {
            plan,
            referenceId,
            subscriptionId,
            quantity,
            targetEmail,
            userId: user.id,
            finalCurrency,
            callbackURL,
            allowedSubscriptionChannels,
          });

          if (proration?.kind === "checkout") {
            return ctx.json({
              kind: "checkout",
              url: proration.url ?? "",
              reference: proration.reference ?? "",
              accessCode: proration.accessCode ?? "",
              redirect: proration.redirect,
            } satisfies PaystackInitializeResult);
          }

          if (proration?.kind === "prorated") {
            return ctx.json({
              kind: "prorated",
              status: proration.status,
              message: proration.message,
              prorated: proration.prorated,
            } satisfies PaystackInitializeResult);
          }
        }

        if (plan !== undefined) {
          // Subscription Flow
          if (trialStart !== undefined) {
            // Trial Flow: Authorize card with minimum amount, don't start sub yet
            initBody.amount = 5000; // 50 NGN (minimum allowed)
          } else {
            // Standard Flow
            initBody.plan = plan.planCode;
            // SDK might use different field names, but keeping DX consistency
            (initBody as Record<string, unknown>).invoice_limit = plan.invoiceLimit;

            let finalAmount: number;
            if (amount !== undefined && amount !== null) {
              finalAmount = amount;
              initBody.quantity = 1;
            } else {
              finalAmount = (plan.amount ?? 0) * (quantity ?? 1);
            }
            initBody.amount = Math.max(Math.round(finalAmount), 5000);
          }
        } else {
          // One-Time Payment Flow
          if (amount === undefined || amount === null)
            throw new APIError("BAD_REQUEST", {
              message: "Amount is required for one-time payments",
            });
          initBody.amount = Math.round(amount);
        }

        const initRaw = await paystack?.transaction?.initialize({
          body: initBody as components["schemas"]["TransactionInitialize"],
        });
        const sdkRes =
          unwrapSdkResult<components["schemas"]["TransactionInitializeResponse"]["data"]>(initRaw);

        url = sdkRes?.authorization_url;
        reference = sdkRes?.reference;
        accessCode = sdkRes?.access_code;
      } catch (error: unknown) {
        ctx.context.logger.error("Failed to initialize Paystack transaction", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : PAYSTACK_ERROR_CODES.FAILED_TO_INITIALIZE_TRANSACTION.message;
        throw new APIError("BAD_REQUEST", {
          code: "FAILED_TO_INITIALIZE_TRANSACTION",
          message: errorMessage,
        });
      }

      // 6. Record Transaction & Subscription
      await ctx.context.adapter.create({
        model: PAYSTACK_MODELS.transaction,
        data: {
          reference: reference ?? "",
          referenceId,
          userId: user.id,
          amount: amount ?? 0,
          currency: plan?.currency ?? currency ?? "NGN",
          status: "pending",
          plan: plan !== undefined ? plan.name.toLowerCase() : undefined,
          product: product !== undefined ? product.name.toLowerCase() : undefined,
          metadata: hasPaystackMetadata(extraMetadata)
            ? stringifyPaystackMetadata(extraMetadata)
            : undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      if (plan !== undefined) {
        const store = createBillingStore(ctx);
        const customer = await store.findCustomerByReference(
          referenceId === user.id ? "user" : "organization",
          referenceId,
        );
        let customerCode = customer?.customerCode;
        if (customerCode === undefined) {
          try {
            const legacy = await ctx.context.adapter.findOne<{
              paystackCustomerCode?: string | null;
            }>({
              model: referenceId === user.id ? "user" : "organization",
              where: [{ field: "id", value: referenceId }],
              select: ["paystackCustomerCode"],
            });
            customerCode = legacy?.paystackCustomerCode ?? undefined;
            if (customerCode) {
              await store.saveCustomer(
                referenceId === user.id ? "user" : "organization",
                referenceId,
                customerCode,
              );
            }
          } catch {
            // Legacy customer columns are optional after the migration.
          }
        }

        const newSubscription = await ctx.context.adapter.create<Subscription>({
          model: PAYSTACK_MODELS.subscription,
          data: {
            plan: plan.name.toLowerCase(),
            groupId,
            referenceId,
            userId: user.id,
            customerCode,
            subscriptionCode: undefined,
            planCode: plan.planCode,
            transactionReference: reference ?? "",
            status: trialStart !== undefined ? "trialing" : "incomplete",
            billingInterval: plan.interval ?? null,
            seats: quantity ?? 1,
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
            cancelAtPeriodEnd: false,
            trialStart,
            trialEnd,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Call trial start hook if trial was granted
        if (
          trialStart !== undefined &&
          newSubscription !== undefined &&
          newSubscription !== null &&
          plan.freeTrial?.onTrialStart !== undefined
        ) {
          await plan.freeTrial.onTrialStart(newSubscription);
        }
      }

      return ctx.json({
        kind: "checkout",
        url: url ?? "",
        reference: reference ?? "",
        accessCode: accessCode ?? "",
        redirect: true,
      } satisfies PaystackInitializeResult);
    },
  );
};

// Aliases for Client DX Parity
export const createSubscription = <P extends string = "/create-subscription">(
  options: AnyPaystackOptions,
  path: P = "/create-subscription" as P,
): StrictEndpoint<
  P,
  {
    method: "POST";
    body: z.ZodObject<
      {
        plan: z.ZodOptional<z.ZodString>;
        product: z.ZodOptional<z.ZodString>;
        amount: z.ZodOptional<z.ZodNumber>;
        currency: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        referenceId: z.ZodOptional<z.ZodString>;
        subscriptionId: z.ZodOptional<z.ZodString>;
        callbackURL: z.ZodOptional<z.ZodString>;
        quantity: z.ZodOptional<z.ZodNumber>;
        scheduleAtPeriodEnd: z.ZodOptional<z.ZodBoolean>;
        cancelAtPeriodEnd: z.ZodOptional<z.ZodBoolean>;
        prorateAndCharge: z.ZodOptional<z.ZodBoolean>;
      },
      z.core.$strip
    >;
    use: (
      | ((
          getValue: (ctx: GenericEndpointContext) => string | string[],
        ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
      | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
    )[];
  },
  PaystackInitializeResult | undefined
> => initializeTransaction(options, path);

export const upgradeSubscription = <P extends string = "/upgrade-subscription">(
  options: AnyPaystackOptions,
  path: P = "/upgrade-subscription" as P,
): StrictEndpoint<
  P,
  {
    method: "POST";
    body: z.ZodObject<
      {
        plan: z.ZodOptional<z.ZodString>;
        product: z.ZodOptional<z.ZodString>;
        amount: z.ZodOptional<z.ZodNumber>;
        currency: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        referenceId: z.ZodOptional<z.ZodString>;
        subscriptionId: z.ZodOptional<z.ZodString>;
        callbackURL: z.ZodOptional<z.ZodString>;
        quantity: z.ZodOptional<z.ZodNumber>;
        scheduleAtPeriodEnd: z.ZodOptional<z.ZodBoolean>;
        cancelAtPeriodEnd: z.ZodOptional<z.ZodBoolean>;
        prorateAndCharge: z.ZodOptional<z.ZodBoolean>;
      },
      z.core.$strip
    >;
    use: (
      | ((
          getValue: (ctx: GenericEndpointContext) => string | string[],
        ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
      | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
    )[];
  },
  PaystackInitializeResult | undefined
> => initializeTransaction(options, path);

export const cancelSubscription = <P extends string = "/cancel-subscription">(
  options: AnyPaystackOptions,
  path: P = "/cancel-subscription" as P,
): StrictEndpoint<
  P,
  {
    method: "POST";
    body: z.ZodObject<
      {
        referenceId: z.ZodOptional<z.ZodString>;
        subscriptionCode: z.ZodString;
        emailToken: z.ZodOptional<z.ZodString>;
        atPeriodEnd: z.ZodOptional<z.ZodBoolean>;
      },
      z.core.$strip
    >;
    use: (
      | ((
          getValue: (ctx: GenericEndpointContext) => string | string[],
        ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
      | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
    )[];
  },
  {
    status: string;
  }
> => disablePaystackSubscription(options, path);

export const restoreSubscription = <P extends string = "/restore-subscription">(
  options: AnyPaystackOptions,
  path: P = "/restore-subscription" as P,
): StrictEndpoint<
  P,
  {
    method: "POST";
    body: z.ZodObject<
      {
        referenceId: z.ZodOptional<z.ZodString>;
        subscriptionCode: z.ZodString;
        emailToken: z.ZodOptional<z.ZodString>;
        atPeriodEnd: z.ZodOptional<z.ZodBoolean>;
      },
      z.core.$strip
    >;
    use: (
      | ((
          getValue: (ctx: GenericEndpointContext) => string | string[],
        ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
      | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
    )[];
  },
  {
    status: string;
  }
> => enablePaystackSubscription(options, path);

export const verifyTransaction = <P extends string = "/verify-transaction">(
  options: AnyPaystackOptions,
  path: P = "/verify-transaction" as P,
): StrictEndpoint<
  P,
  {
    method: "POST";
    body: z.ZodObject<
      {
        reference: z.ZodString;
      },
      z.core.$strip
    >;
    use: (
      | ((
          getValue: (ctx: GenericEndpointContext) => string | string[],
        ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
      | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
    )[];
  },
  {
    status: string;
    reference: string;
    data: {
      id: number;
      domain: string;
      status: string;
      reference: string;
      receipt_number: string | null;
      amount: number;
      message: string | null;
      gateway_response: string;
      channel: string;
      currency: string;
      ip_address: string | null;
      metadata: (string | Record<string, never> | number) | null;
      log: {
        start_time: number;
        time_spent: number;
        attempts: number;
        errors: number;
        success: boolean;
        mobile: boolean;
        input: unknown[];
        history: {
          type: string;
          message: string;
          time: number;
        }[];
      } | null;
      fees: number | null;
      fees_split: unknown;
      authorization: {
        authorization_code?: string;
        bin?: string | null;
        last4?: string;
        exp_month?: string;
        exp_year?: string;
        channel?: string;
        card_type?: string;
        bank?: string;
        country_code?: string;
        brand?: string;
        reusable?: boolean;
        signature?: string;
        account_name?: string | null;
        receiver_bank_account_number?: string | null;
        receiver_bank?: string | null;
      };
      customer: {
        id: number;
        first_name: string | null;
        last_name: string | null;
        email: string;
        customer_code: string;
        phone: string | null;
        metadata: Record<string, never> | null;
        risk_action: string;
        international_format_phone?: string | null;
      };
      plan: (string | Record<string, never>) | null;
      split: Record<string, never> | null;
      order_id: unknown;
      paidAt: string | null;
      createdAt: string;
      requested_amount: number;
      pos_transaction_data: unknown;
      source: unknown;
      fees_breakdown: unknown;
      connect: unknown;
      transaction_date: string;
      plan_object: {
        id?: number;
        name?: string;
        plan_code?: string;
        description?: unknown;
        amount?: number;
        interval?: string;
        send_invoices?: boolean;
        send_sms?: boolean;
        currency?: string;
      };
      subaccount: Record<string, never> | null;
    };
  }
> => {
  const verifyBodySchema = z.object({
    reference: z.string(),
  });

  const subscriptionOptions = options.subscription;
  const useMiddlewares =
    subscriptionOptions?.enabled === true
      ? [sessionMiddleware, originCheck, referenceMiddleware(options, "verify-transaction")]
      : [sessionMiddleware, originCheck];

  return createAuthEndpoint(
    path,
    {
      method: "POST",
      body: verifyBodySchema,
      use: useMiddlewares,
    },
    async (ctx) => {
      const session = await getSessionFromCtx(ctx);
      const result = await reconcilePaystackTransaction(ctx as GenericEndpointContext, options, {
        reference: ctx.body.reference,
        source: "browser",
        actor:
          session !== undefined && session !== null
            ? {
                user: session.user as User,
                session: session.session,
              }
            : undefined,
        throwOnError: true,
      });

      if (!result.ok || result.data === null) {
        throw new APIError("BAD_REQUEST", {
          code: result.error?.code ?? "FAILED_TO_VERIFY_TRANSACTION",
          message:
            result.error?.message ?? PAYSTACK_ERROR_CODES.FAILED_TO_VERIFY_TRANSACTION.message,
          status: result.error?.status,
        });
      }

      return ctx.json({
        status: result.status,
        reference: result.reference,
        data: result.data,
      });
    },
  );
};

export const listSubscriptions = <P extends string = "/list-subscriptions">(
  options: AnyPaystackOptions,
  path: P = "/list-subscriptions" as P,
): StrictEndpoint<
  P,
  {
    method: "GET";
    query: z.ZodObject<
      {
        referenceId: z.ZodOptional<z.ZodString>;
      },
      z.core.$strip
    >;
    use: (
      | ((
          getValue: (ctx: GenericEndpointContext) => string | string[],
        ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
      | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
    )[];
  },
  {
    subscriptions: Subscription[];
  }
> => {
  const listQuerySchema = z.object({
    referenceId: z.string().optional(),
  });

  const subscriptionOptions = options.subscription;
  const useMiddlewares =
    subscriptionOptions?.enabled === true
      ? [sessionMiddleware, originCheck, referenceMiddleware(options, "list-subscriptions")]
      : [sessionMiddleware, originCheck];

  return createAuthEndpoint(
    path,
    {
      method: "GET",
      query: listQuerySchema,
      use: useMiddlewares,
    },
    async (ctx) => {
      if (subscriptionOptions?.enabled !== true) {
        throw new APIError("BAD_REQUEST", {
          message: "Subscriptions are not enabled in the Paystack options.",
        });
      }
      const session = await getSessionFromCtx(ctx);
      if (session === undefined || session === null) throw new APIError("UNAUTHORIZED");
      const store = createBillingStore(ctx);
      const referenceIdPart = (ctx.context as Record<string, unknown>).referenceId as
        | string
        | undefined;
      const queryRefId =
        ctx.query?.referenceId ??
        (typeof ctx.request?.url === "string"
          ? (new URL(ctx.request.url).searchParams.get("referenceId") ?? undefined)
          : undefined);
      const userId = (session.user as { id: string }).id;
      if (queryRefId !== undefined && queryRefId !== userId && referenceIdPart !== queryRefId) {
        await authorizeBillingReference(ctx, options, {
          user: session.user as User,
          session: session.session,
          referenceId: queryRefId,
          action: "list-subscriptions",
        });
      }
      const referenceId = queryRefId ?? referenceIdPart ?? userId;
      const res = await store.findSubscriptionsByReference(referenceId);
      return ctx.json({ subscriptions: res });
    },
  );
};

export const listTransactions = <P extends string = "/list-transactions">(
  options: AnyPaystackOptions,
  path: P = "/list-transactions" as P,
): StrictEndpoint<
  P,
  {
    method: "GET";
    query: z.ZodObject<
      {
        referenceId: z.ZodOptional<z.ZodString>;
      },
      z.core.$strip
    >;
    use: (
      | ((
          getValue: (ctx: GenericEndpointContext) => string | string[],
        ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
      | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
    )[];
  },
  {
    transactions: PaystackTransaction[];
  }
> => {
  const listQuerySchema = z.object({
    referenceId: z.string().optional(),
  });

  const subscriptionOptions = options.subscription;
  const useMiddlewares =
    subscriptionOptions?.enabled === true
      ? [sessionMiddleware, originCheck, referenceMiddleware(options, "list-transactions")]
      : [sessionMiddleware, originCheck];

  return createAuthEndpoint(
    path,
    {
      method: "GET",
      query: listQuerySchema,
      use: useMiddlewares,
    },
    async (ctx) => {
      const session = await getSessionFromCtx(ctx);
      if (session === undefined || session === null) throw new APIError("UNAUTHORIZED");
      const store = createBillingStore(ctx);
      const referenceIdPart = (ctx.context as Record<string, unknown>).referenceId as
        | string
        | undefined;
      const queryRefId =
        ctx.query?.referenceId ??
        (typeof ctx.request?.url === "string"
          ? (new URL(ctx.request.url).searchParams.get("referenceId") ?? undefined)
          : undefined);
      const userId = (session.user as { id: string }).id;
      if (queryRefId !== undefined && queryRefId !== userId && referenceIdPart !== queryRefId) {
        await authorizeBillingReference(ctx, options, {
          user: session.user as User,
          session: session.session,
          referenceId: queryRefId,
          action: "list-transactions",
        });
      }
      const referenceId = queryRefId ?? referenceIdPart ?? userId;
      const transactions = await store.listTransactions(referenceId);
      return ctx.json({ transactions });
    },
  );
};

export const disablePaystackSubscription = <P extends string = "/disable-subscription">(
  options: AnyPaystackOptions,
  path: P = "/disable-subscription" as P,
): StrictEndpoint<
  P,
  {
    method: "POST";
    body: z.ZodObject<
      {
        referenceId: z.ZodOptional<z.ZodString>;
        subscriptionCode: z.ZodString;
        emailToken: z.ZodOptional<z.ZodString>;
        atPeriodEnd: z.ZodOptional<z.ZodBoolean>;
      },
      z.core.$strip
    >;
    use: (
      | ((
          getValue: (ctx: GenericEndpointContext) => string | string[],
        ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
      | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
    )[];
  },
  {
    status: string;
  }
> => {
  const subscriptionOptions = options.subscription;
  const useMiddlewares =
    subscriptionOptions?.enabled === true
      ? [sessionMiddleware, originCheck, referenceMiddleware(options, "disable-subscription")]
      : [sessionMiddleware, originCheck];

  return createAuthEndpoint(
    path,
    { method: "POST", body: enableDisableBodySchema, use: useMiddlewares },
    async (ctx) => {
      const { subscriptionCode, atPeriodEnd } = ctx.body;
      const paystack = getPaystackOps(options.paystackClient);
      try {
        const subCode = subscriptionCode;
        if (isLocalSubscriptionCode(subCode)) {
          const sub = await ctx.context.adapter.findOne<Subscription>({
            model: PAYSTACK_MODELS.subscription,
            where: [{ field: "subscriptionCode", value: subscriptionCode }],
          });

          if (sub !== null && sub !== undefined) {
            const now = new Date();
            const immediate = atPeriodEnd === false;
            await ctx.context.adapter.update({
              model: PAYSTACK_MODELS.subscription,
              update: {
                status: immediate ? "canceled" : "active",
                cancelAtPeriodEnd: !immediate,
                cancelAt: immediate ? null : (sub.periodEnd ?? null),
                canceledAt: now,
                endedAt: immediate ? now : null,
                updatedAt: now,
              },
              where: [{ field: "id", value: sub.id }],
            });
            return ctx.json({ status: "success" });
          }
          throw new APIError("BAD_REQUEST", { message: "Subscription not found" });
        }

        const storedSubscription =
          await createBillingStore(ctx).findSubscriptionByCode(subscriptionCode);
        const storedCredentials = storedSubscription
          ? await readPaystackPaymentCredentials(
              ctx.context.adapter,
              options,
              storedSubscription.id,
            )
          : null;
        let emailToken = ctx.body.emailToken ?? storedCredentials?.emailToken;
        let nextPaymentDate: string | undefined;

        try {
          const raw = await paystack?.subscription?.fetch(subscriptionCode);
          const fetchRes =
            unwrapSdkResult<components["schemas"]["SubscriptionListResponseArray"]>(raw);

          if (fetchRes !== undefined && fetchRes !== null) {
            emailToken ??= fetchRes.email_token ?? undefined;
            nextPaymentDate = fetchRes.next_payment_date ?? undefined;
          }
        } catch {
          // ignore fetch failure
        }

        if (emailToken === undefined || emailToken === null || emailToken === "") {
          try {
            const raw = await paystack?.subscription?.manageLink(subscriptionCode);
            const linkRes = unwrapSdkResult<{ link: string }>(raw);
            const link = linkRes?.link;
            if (link !== undefined && link !== null && link !== "") {
              emailToken = tryGetEmailTokenFromSubscriptionManageLink(link);
            }
          } catch {
            // ignore
          }
        }

        if (emailToken === undefined || emailToken === null || emailToken === "") {
          throw new Error("Could not retrieve email_token for subscription disable.");
        }

        if (storedSubscription) {
          await savePaystackPaymentCredentials(
            ctx.context.adapter,
            options,
            storedSubscription.id,
            {
              emailToken,
            },
          );
        }

        await paystack?.subscription?.disable({
          body: { code: subscriptionCode, token: emailToken },
        });

        const periodEnd =
          nextPaymentDate !== undefined && nextPaymentDate !== null && nextPaymentDate !== ""
            ? new Date(nextPaymentDate)
            : undefined;

        const sub = await ctx.context.adapter.findOne<Subscription>({
          model: PAYSTACK_MODELS.subscription,
          where: [{ field: "subscriptionCode", value: subscriptionCode }],
        });

        if (sub !== undefined && sub !== null) {
          const now = new Date();
          const immediate = atPeriodEnd === false;
          await ctx.context.adapter.update({
            model: PAYSTACK_MODELS.subscription,
            update: {
              status: immediate ? "canceled" : "active",
              cancelAtPeriodEnd: !immediate,
              cancelAt: immediate ? null : (periodEnd ?? sub.periodEnd ?? null),
              canceledAt: now,
              endedAt: immediate ? now : null,
              periodEnd,
              updatedAt: now,
            },
            where: [{ field: "id", value: sub.id }],
          });
        } else {
          ctx.context.logger.warn(
            `Could not find subscription with code ${subscriptionCode} to disable`,
          );
        }

        return ctx.json({ status: "success" });
      } catch (error: unknown) {
        ctx.context.logger.error("Failed to disable subscription", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : PAYSTACK_ERROR_CODES.FAILED_TO_DISABLE_SUBSCRIPTION.message;
        throw new APIError("BAD_REQUEST", {
          code: "FAILED_TO_DISABLE_SUBSCRIPTION",
          message: errorMessage,
        });
      }
    },
  );
};

export const enablePaystackSubscription = <P extends string = "/enable-subscription">(
  options: AnyPaystackOptions,
  path: P = "/enable-subscription" as P,
): StrictEndpoint<
  P,
  {
    method: "POST";
    body: z.ZodObject<
      {
        referenceId: z.ZodOptional<z.ZodString>;
        subscriptionCode: z.ZodString;
        emailToken: z.ZodOptional<z.ZodString>;
        atPeriodEnd: z.ZodOptional<z.ZodBoolean>;
      },
      z.core.$strip
    >;
    use: (
      | ((
          getValue: (ctx: GenericEndpointContext) => string | string[],
        ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
      | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
    )[];
  },
  {
    status: string;
  }
> => {
  const subscriptionOptions = options.subscription;
  const useMiddlewares =
    subscriptionOptions?.enabled === true
      ? [sessionMiddleware, originCheck, referenceMiddleware(options, "enable-subscription")]
      : [sessionMiddleware, originCheck];

  return createAuthEndpoint(
    path,
    { method: "POST", body: enableDisableBodySchema, use: useMiddlewares },
    async (ctx) => {
      const { subscriptionCode } = ctx.body;
      const paystack = getPaystackOps(options.paystackClient);
      try {
        const storedSubscription =
          await createBillingStore(ctx).findSubscriptionByCode(subscriptionCode);
        const storedCredentials = storedSubscription
          ? await readPaystackPaymentCredentials(
              ctx.context.adapter,
              options,
              storedSubscription.id,
            )
          : null;
        let emailToken = ctx.body.emailToken ?? storedCredentials?.emailToken;
        if (emailToken === undefined || emailToken === null || emailToken === "") {
          try {
            const raw = await paystack?.subscription?.fetch(subscriptionCode);
            const fetchRes =
              unwrapSdkResult<components["schemas"]["SubscriptionListResponseArray"]>(raw);
            if (fetchRes !== undefined && fetchRes !== null) {
              emailToken = fetchRes.email_token ?? undefined;
            }
          } catch {
            // ignore
          }
        }

        if (emailToken === undefined || emailToken === null || emailToken === "") {
          try {
            const raw = await paystack?.subscription?.manageLink(subscriptionCode);
            const linkRes = unwrapSdkResult<{ link: string }>(raw);
            const link = linkRes?.link;
            if (link !== undefined && link !== null && link !== "") {
              emailToken = tryGetEmailTokenFromSubscriptionManageLink(link);
            }
          } catch {
            // ignore
          }
        }

        if (emailToken === undefined || emailToken === null || emailToken === "") {
          throw new APIError("BAD_REQUEST", {
            message: "Could not retrieve email_token for subscription enable.",
          });
        }

        if (storedSubscription) {
          await savePaystackPaymentCredentials(
            ctx.context.adapter,
            options,
            storedSubscription.id,
            {
              emailToken,
            },
          );
        }

        await paystack?.subscription?.enable({
          body: { code: subscriptionCode, token: emailToken },
        });

        // Update local status immediately
        await ctx.context.adapter.update({
          model: PAYSTACK_MODELS.subscription,
          update: {
            status: "active",
            cancelAtPeriodEnd: false,
            cancelAt: null,
            canceledAt: null,
            endedAt: null,
            updatedAt: new Date(),
          },
          where: [{ field: "subscriptionCode", value: subscriptionCode }],
        });

        return ctx.json({ status: "success" });
      } catch (error: unknown) {
        ctx.context.logger.error("Failed to enable subscription", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : PAYSTACK_ERROR_CODES.FAILED_TO_ENABLE_SUBSCRIPTION.message;
        throw new APIError("BAD_REQUEST", {
          code: "FAILED_TO_ENABLE_SUBSCRIPTION",
          message: errorMessage,
        });
      }
    },
  );
};

export const getSubscriptionManageLink = <P extends string = "/subscription-manage-link">(
  options: AnyPaystackOptions,
  path: P = "/subscription-manage-link" as P,
): StrictEndpoint<
  P,
  {
    method: "GET";
    query: z.ZodObject<
      {
        subscriptionCode: z.ZodString;
      },
      z.core.$strip
    >;
    use: (
      | ((
          getValue: (ctx: GenericEndpointContext) => string | string[],
        ) => (inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<void>)
      | ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
    )[];
  },
  {
    link: string | null;
  }
> => {
  const manageLinkQuerySchema = z.object({
    subscriptionCode: z.string(),
  });
  const subscriptionOptions = options.subscription;
  const useMiddlewares =
    subscriptionOptions?.enabled === true
      ? [
          sessionMiddleware,
          originCheck,
          referenceMiddleware(options, "get-subscription-manage-link"),
        ]
      : [sessionMiddleware, originCheck];

  const handler = async (ctx: GenericEndpointContext) => {
    const { subscriptionCode } = ctx.query;

    if (isLocalSubscriptionCode(subscriptionCode as string)) {
      return ctx.json({ link: null, message: "Local subscriptions cannot be managed on Paystack" });
    }

    const paystack = getPaystackOps(options.paystackClient);
    try {
      const raw = await paystack?.subscription?.manageLink(subscriptionCode as string);
      const res = unwrapSdkResult<{ link: string }>(raw);
      return ctx.json({ link: res?.link || null });
    } catch (error: unknown) {
      ctx.context.logger.error("Failed to get subscription manage link", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to get subscription manage link";
      throw new APIError("BAD_REQUEST", {
        message: errorMessage,
      });
    }
  };

  return createAuthEndpoint(
    path,
    {
      method: "GET",
      query: manageLinkQuerySchema,
      use: useMiddlewares,
    },
    handler,
  );
};

export const listProducts = <P extends string = "/list-products">(
  _options: AnyPaystackOptions,
  path: P = "/list-products" as P,
): StrictEndpoint<
  P,
  {
    method: "GET";
    metadata: {
      openapi: {
        operationId: string;
      };
    };
  },
  {
    products: PaystackProduct[];
  }
> => {
  return createAuthEndpoint(
    path,
    {
      method: "GET",
      metadata: {
        openapi: {
          operationId: "listPaystackProducts",
        },
      },
    },
    async (ctx) => {
      const products = await listStoredProducts(ctx);
      return ctx.json({ products });
    },
  );
};

export const listPlans = <P extends string = "/list-plans">(
  _options: AnyPaystackOptions,
  path: P = "/list-plans" as P,
): StrictEndpoint<
  P,
  {
    method: "GET";
    metadata: {
      scope: "server";
    };
    use: ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<{
      session: {
        session: Record<string, unknown> & {
          id: string;
          createdAt: Date;
          updatedAt: Date;
          userId: string;
          expiresAt: Date;
          token: string;
          ipAddress?: string | null | undefined;
          userAgent?: string | null | undefined;
        };
        user: Record<string, unknown> & {
          id: string;
          createdAt: Date;
          updatedAt: Date;
          email: string;
          emailVerified: boolean;
          name: string;
          image?: string | null | undefined;
        };
      };
    }>)[];
  },
  {
    plans: PaystackPlan[];
  }
> => {
  return createAuthEndpoint(
    path,
    {
      method: "GET",
      metadata: { ...HIDE_METADATA },
      use: [sessionMiddleware],
    },
    async (ctx) => {
      try {
        const plans = await listStoredPlans(ctx);
        return ctx.json({ plans });
      } catch (error: unknown) {
        ctx.context.logger.error("Failed to list plans", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to list plans";
        throw new APIError("BAD_REQUEST", {
          message: errorMessage,
        });
      }
    },
  );
};

export const getConfig = <P extends string = "/get-config">(
  options: AnyPaystackOptions,
  path: P = "/get-config" as P,
): StrictEndpoint<
  P,
  {
    method: "GET";
    metadata: {
      openapi: {
        operationId: string;
      };
    };
  },
  {
    plans: PaystackPlan[];
    products: PaystackProduct[];
  }
> => {
  return createAuthEndpoint(
    path,
    {
      method: "GET",
      metadata: {
        openapi: {
          operationId: "getPaystackConfig",
        },
      },
    },
    async (ctx: GenericEndpointContext) => {
      return ctx.json(await getConfiguredCatalog(options));
    },
  );
};

export { PAYSTACK_ERROR_CODES };
