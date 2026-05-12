import { defineErrorCodes, HIDE_METADATA } from "better-auth";
import { APIError, getSessionFromCtx, originCheck, sessionMiddleware } from "better-auth/api";
import { createAuthEndpoint } from "better-auth/api";
/* oxlint-disable no-restricted-imports */
import { z } from "zod";
import type { components } from "@alexasomba/paystack-node";
import type {
  GenericEndpointContext,
  MiddlewareInputContext,
  MiddlewareOptions,
  RawError,
  StrictEndpoint,
} from "better-auth";

import type {
  InputPaystackProduct,
  PaystackTransaction,
  AnyPaystackOptions,
  PaystackProduct,
  Subscription,
  Member,
  PaystackOrganization,
  PaystackPlan,
  PaystackWebhookPayload,
  PaystackTransactionResponse,
  User,
  PaystackUser,
  PaystackCheckoutChannel,
} from "./types";
import {
  syncProductQuantityFromPaystack,
  getPlanByName,
  getPlans,
  getProductByName,
  getProducts,
  getPlanSeatAmount,
  calculatePlanAmount,
  isLocalSubscriptionCode,
} from "./utils";
import { referenceMiddleware } from "./middleware";
import { authorizeBillingReference } from "./reference-access";
import { getPaystackOps, unwrapSdkResult } from "./paystack-sdk";
import { getOrganizationSubscription } from "./limits";
import { createBillingStore } from "./billing-store";
import { handleProratedUpgrade } from "./subscription-lifecycle";

const PAYSTACK_ERROR_CODES: {
  SUBSCRIPTION_NOT_FOUND: RawError<"SUBSCRIPTION_NOT_FOUND">;
  SUBSCRIPTION_PLAN_NOT_FOUND: RawError<"SUBSCRIPTION_PLAN_NOT_FOUND">;
  UNABLE_TO_CREATE_CUSTOMER: RawError<"UNABLE_TO_CREATE_CUSTOMER">;
  FAILED_TO_INITIALIZE_TRANSACTION: RawError<"FAILED_TO_INITIALIZE_TRANSACTION">;
  FAILED_TO_VERIFY_TRANSACTION: RawError<"FAILED_TO_VERIFY_TRANSACTION">;
  FAILED_TO_DISABLE_SUBSCRIPTION: RawError<"FAILED_TO_DISABLE_SUBSCRIPTION">;
  FAILED_TO_ENABLE_SUBSCRIPTION: RawError<"FAILED_TO_ENABLE_SUBSCRIPTION">;
  EMAIL_VERIFICATION_REQUIRED: RawError<"EMAIL_VERIFICATION_REQUIRED">;
  SUBSCRIPTION_PAYMENT_CHANNEL_NOT_ALLOWED: RawError<"SUBSCRIPTION_PAYMENT_CHANNEL_NOT_ALLOWED">;
} = defineErrorCodes({
  SUBSCRIPTION_NOT_FOUND: "Subscription not found",
  SUBSCRIPTION_PLAN_NOT_FOUND: "Subscription plan not found",
  UNABLE_TO_CREATE_CUSTOMER: "Unable to create customer",
  FAILED_TO_INITIALIZE_TRANSACTION: "Failed to initialize transaction",
  FAILED_TO_VERIFY_TRANSACTION: "Failed to verify transaction",
  FAILED_TO_DISABLE_SUBSCRIPTION: "Failed to disable subscription",
  FAILED_TO_ENABLE_SUBSCRIPTION: "Failed to enable subscription",
  EMAIL_VERIFICATION_REQUIRED: "Email verification is required before you can subscribe to a plan",
  SUBSCRIPTION_PAYMENT_CHANNEL_NOT_ALLOWED:
    "This subscription only supports specific payment channels",
});

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

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(message);

  const crypto = globalThis.crypto;
  if (crypto !== undefined && crypto !== null && "subtle" in crypto) {
    const subtle = crypto.subtle;
    const key = await subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-512" }, false, [
      "sign",
    ]);
    const signature = await subtle.sign("HMAC", key, msgData);
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  const { createHmac } = await import("node:crypto");
  return createHmac("sha512", secret).update(message).digest("hex");
}

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
      const request =
        (ctx as unknown as { requestClone?: Request }).requestClone ??
        (ctx as { request: Request }).request;
      if (request === undefined || request === null) {
        throw new APIError("BAD_REQUEST", {
          message: "Request object is missing from context",
        });
      }
      const payload = await request.text();
      const headers =
        (ctx as GenericEndpointContext & { headers?: Headers }).headers ??
        (ctx.request as unknown as { headers: Headers })?.headers;
      const signature = headers?.get("x-paystack-signature") as string | null | undefined;

      if (options.webhook?.verifyIP === true) {
        const trustedIPs = options.webhook.trustedIPs ?? [
          "52.31.139.75",
          "52.49.173.169",
          "52.214.14.220",
        ];
        const clientIP =
          headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          headers?.get("x-real-ip") ??
          (ctx.request as unknown as { ip?: string }).ip;

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

      const webhookSecret =
        options.webhook?.secret ?? options.paystackWebhookSecret ?? options.secretKey;
      const expected = await hmacSha512Hex(webhookSecret, payload);
      if (expected !== signature) {
        throw new APIError("UNAUTHORIZED", {
          message: "Invalid Paystack webhook signature",
          status: 401,
        });
      }

      const event = JSON.parse(payload) as PaystackWebhookPayload;
      const eventName = event.event;
      const data = event.data;

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

            const metadataVal = (subscriptionData as unknown as { metadata?: unknown }).metadata;
            let metadata: unknown = metadataVal;
            if (typeof metadata === "string") {
              try {
                metadata = JSON.parse(metadata);
              } catch {
                // ignore
              }
            }

            const metadataObj =
              metadata !== undefined && metadata !== null && typeof metadata === "object"
                ? (metadata as Record<string, unknown>)
                : {};
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
                where.push({ field: "paystackCustomerCode", value: customerCode });
              }
              if (planName !== undefined && planName !== null && planName !== "") {
                where.push({ field: "plan", value: planName });
              }

              if (where.length > 0) {
                const matches = await ctx.context.adapter.findMany<Subscription>({
                  model: "subscription",
                  where: where as unknown as {
                    field: string;
                    value: string | number | boolean | null;
                  }[],
                });
                const subscription = matches?.[0];
                if (subscription !== undefined && subscription !== null) {
                  await ctx.context.adapter.update({
                    model: "subscription",
                    update: {
                      paystackSubscriptionCode: subscriptionCode,
                      status: "active",
                      updatedAt: new Date(),
                      periodEnd:
                        subscriptionData.next_payment_date !== undefined &&
                        subscriptionData.next_payment_date !== null
                          ? new Date(subscriptionData.next_payment_date)
                          : undefined,
                    },
                    where: [{ field: "id", value: subscription.id }],
                  });

                  const plan =
                    planFromCode ??
                    (planName !== undefined && planName !== null && planName !== ""
                      ? await getPlanByName(options, planName)
                      : undefined);
                  if (plan !== undefined && plan !== null) {
                    await options.subscription.onSubscriptionComplete?.(
                      {
                        event,
                        subscription: {
                          ...subscription,
                          paystackSubscriptionCode: subscriptionCode,
                          status: "active",
                        },
                        plan,
                      },
                      ctx as GenericEndpointContext,
                    );
                    await options.subscription.onSubscriptionCreated?.(
                      {
                        event,
                        subscription: {
                          ...subscription,
                          paystackSubscriptionCode: subscriptionCode,
                          status: "active",
                        },
                        plan,
                      },
                      ctx as GenericEndpointContext,
                    );
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
                model: "subscription",
                where: [{ field: "paystackSubscriptionCode", value: subscriptionCode }],
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

              await ctx.context.adapter.update({
                model: "subscription",
                update: {
                  status: newStatus,
                  cancelAtPeriodEnd: true,
                  ...(periodEnd ? { periodEnd } : {}),
                  updatedAt: new Date(),
                },
                where: [{ field: "paystackSubscriptionCode", value: subscriptionCode }],
              });

              if (existing !== null && existing !== undefined) {
                await options.subscription.onSubscriptionCancel?.(
                  { event, subscription: { ...existing, status: "canceled" } as Subscription },
                  ctx as GenericEndpointContext,
                );
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
                model: "subscription",
                where: [{ field: "paystackSubscriptionCode", value: subscriptionCode }],
              });

              if (
                existingSub !== undefined &&
                existingSub !== null &&
                existingSub.pendingPlan !== undefined &&
                existingSub.pendingPlan !== null &&
                existingSub.pendingPlan !== ""
              ) {
                await ctx.context.adapter.update({
                  model: "subscription",
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
      return ctx.json({ received: true });
    },
  );
};

const initializeTransactionBodySchema = z.object({
  plan: z.string().optional(),
  product: z.string().optional(),
  amount: z.number().int().positive().optional(),
  currency: z.string().optional(),
  email: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  referenceId: z.string().optional(),
  callbackURL: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  scheduleAtPeriodEnd: z.boolean().optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  prorateAndCharge: z.boolean().optional(),
});

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
  | {
      status: string;
      message: string;
      scheduled: boolean;
    }
  | {
      status: string;
      message: string;
      prorated: boolean;
    }
  | {
      url: string;
      reference: string;
      accessCode: string;
      redirect: boolean;
    }
  | undefined
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

      // Handle scheduleAtPeriodEnd for existing subscriptions
      if (plan !== undefined && scheduleAtPeriodEnd === true) {
        const existingSub = await getOrganizationSubscription(ctx, referenceId);
        if (existingSub?.status === "active") {
          await ctx.context.adapter.update({
            model: "subscription",
            where: [{ field: "id", value: existingSub.id }],
            update: {
              pendingPlan: plan.name,
              updatedAt: new Date(),
            },
          });
          return ctx.json({
            status: "success",
            message: "Plan change scheduled at period end.",
            scheduled: true,
          });
        }
      }

      // Handle cancelAtPeriodEnd for existing subscriptions
      if (cancelAtPeriodEnd === true) {
        const existingSub = await getOrganizationSubscription(ctx, referenceId);
        if (existingSub?.status === "active") {
          await ctx.context.adapter.update({
            model: "subscription",
            where: [{ field: "id", value: existingSub.id }],
            update: {
              cancelAtPeriodEnd: true,
              updatedAt: new Date(),
            },
          });

          return ctx.json({
            status: "success",
            message: "Subscription cancellation scheduled at period end.",
            scheduled: true,
          });
        }
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

      // Check trial eligibility - prevent trial abuse
      let trialStart: Date | undefined;
      let trialEnd: Date | undefined;
      const requestedTrialDays =
        plan?.freeTrial?.days !== undefined && plan.freeTrial.days > 0 ? plan.freeTrial.days : 0;
      const trialRequested = requestedTrialDays > 0;
      let trialGranted = false;
      let trialDeniedReason: "already_used" | undefined;
      if (trialRequested) {
        // Check if user/referenceId has ever had a trial
        const previousTrials = await ctx.context.adapter.findMany<Subscription>({
          model: "subscription",
          where: [{ field: "referenceId", value: referenceId }],
        });
        const hadTrial = previousTrials?.some(
          (sub: Subscription) =>
            (sub.trialStart !== undefined && sub.trialStart !== null) ||
            (sub.trialEnd !== undefined && sub.trialEnd !== null) ||
            sub.status === "trialing",
        );

        if (hadTrial === false) {
          trialStart = new Date();
          trialEnd = new Date();
          trialEnd.setDate(trialEnd.getDate() + requestedTrialDays);
          trialGranted = true;
        } else {
          trialDeniedReason = "already_used";
        }
      }

      try {
        // Determine Customer Email & Code (Organization support)
        let targetEmail = email ?? user.email;

        if (
          options.organization?.enabled === true &&
          referenceId !== undefined &&
          referenceId !== null &&
          referenceId !== user.id
        ) {
          const org = await ctx.context.adapter.findOne({
            model: "organization",
            where: [{ field: "id", value: referenceId }],
          });
          if (org !== undefined && org !== null) {
            const orgWithEmail = org as { email?: string | null };
            if (
              orgWithEmail.email !== undefined &&
              orgWithEmail.email !== null &&
              orgWithEmail.email !== ""
            ) {
              targetEmail = orgWithEmail.email;
            } else {
              // Fallback: Use Organization Owner Email
              const ownerMember = await ctx.context.adapter.findOne({
                model: "member",
                where: [
                  { field: "organizationId", value: referenceId },
                  { field: "role", value: "owner" },
                ],
              });

              if (ownerMember !== undefined && ownerMember !== null) {
                const ownerUser = (await ctx.context.adapter.findOne({
                  model: "user",
                  where: [{ field: "id", value: (ownerMember as Member).userId }],
                })) as User | null;

                if (
                  ownerUser !== undefined &&
                  ownerUser !== null &&
                  ownerUser.email !== undefined &&
                  ownerUser.email !== null &&
                  ownerUser.email !== ""
                ) {
                  targetEmail = ownerUser.email;
                }
              }
            }
          }
        }

        const allowedSubscriptionChannels = plan
          ? getAllowedSubscriptionChannels(options)
          : undefined;

        // Construct Metadata
        const metadata = JSON.stringify({
          referenceId,
          userId: user.id,
          plan: plan !== undefined ? plan.name.toLowerCase() : undefined, // Undefined for one-time
          product: product !== undefined ? product.name.toLowerCase() : undefined,
          ...extraMetadata,
          isTrial: trialStart !== undefined,
          trialRequested,
          trialGranted,
          trialDeniedReason,
          trialEnd: trialEnd !== undefined ? trialEnd.toISOString() : undefined,
        });

        const initBody: {
          email: string;
          callback_url?: string;
          metadata: string;
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
            quantity,
            targetEmail,
            userId: user.id,
            finalCurrency,
            callbackURL,
            allowedSubscriptionChannels,
          });

          if (proration?.kind === "checkout") {
            return ctx.json({
              url: proration.url ?? "",
              reference: proration.reference ?? "",
              accessCode: proration.accessCode ?? "",
              redirect: proration.redirect,
            });
          }

          if (proration?.kind === "completed") {
            return ctx.json({
              status: proration.status,
              message: proration.message,
              prorated: proration.prorated,
            });
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
        model: "paystackTransaction",
        data: {
          reference: reference ?? "",
          referenceId,
          userId: user.id,
          amount: amount ?? 0,
          currency: plan?.currency ?? currency ?? "NGN",
          status: "pending",
          plan: plan !== undefined ? plan.name.toLowerCase() : undefined,
          product: product !== undefined ? product.name.toLowerCase() : undefined,
          metadata:
            extraMetadata !== undefined && Object.keys(extraMetadata).length > 0
              ? JSON.stringify(extraMetadata)
              : undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      if (plan !== undefined) {
        let storedCustomerCode = (user as PaystackUser).paystackCustomerCode;
        if (options.organization?.enabled === true && referenceId !== user.id) {
          const org = await ctx.context.adapter.findOne({
            model: "organization",
            where: [{ field: "id", value: referenceId }],
          });
          if (org !== undefined && org !== null) {
            const paystackOrg = org as PaystackOrganization;
            if (
              paystackOrg.paystackCustomerCode !== undefined &&
              paystackOrg.paystackCustomerCode !== null &&
              paystackOrg.paystackCustomerCode !== ""
            ) {
              storedCustomerCode = paystackOrg.paystackCustomerCode;
            }
          }
        }

        const newSubscription = await ctx.context.adapter.create<Subscription>({
          model: "subscription",
          data: {
            plan: plan.name.toLowerCase(),
            referenceId,
            userId: user.id,
            paystackCustomerCode: storedCustomerCode ?? "",
            paystackSubscriptionCode: "",
            paystackPlanCode: plan.planCode,
            paystackAuthorizationCode: "",
            paystackTransactionReference: reference ?? "",
            status: trialStart !== undefined ? "trialing" : "incomplete",
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
        url,
        reference,
        accessCode,
        redirect: true,
      });
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
  | {
      status: string;
      message: string;
      scheduled: boolean;
    }
  | {
      status: string;
      message: string;
      prorated: boolean;
    }
  | {
      url: string;
      reference: string;
      accessCode: string;
      redirect: boolean;
    }
  | undefined
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
  | {
      status: string;
      message: string;
      scheduled: boolean;
    }
  | {
      status: string;
      message: string;
      prorated: boolean;
    }
  | {
      url: string;
      reference: string;
      accessCode: string;
      redirect: boolean;
    }
  | undefined
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
      const paystack = getPaystackOps(options.paystackClient);
      let data: PaystackTransactionResponse | undefined;

      try {
        const verifyRaw = await paystack?.transaction?.verify(ctx.body.reference);
        // unwrapSdkResult might return the data field or the whole body depending on its impl.
        // But with PaystackResponse and ours, it should give us the 'data' part for success.
        data = unwrapSdkResult<PaystackTransactionResponse>(verifyRaw);
      } catch (error: unknown) {
        ctx.context.logger.error("Failed to verify Paystack transaction", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : PAYSTACK_ERROR_CODES.FAILED_TO_VERIFY_TRANSACTION.message;
        throw new APIError("BAD_REQUEST", {
          code: "FAILED_TO_VERIFY_TRANSACTION",
          message: errorMessage,
        });
      }

      if (data === undefined || data === null) {
        throw new APIError("BAD_REQUEST", {
          message: "Failed to fetch transaction data from Paystack.",
        });
      }

      const status = data.status ?? "failed";
      const reference = data.reference ?? ctx.body.reference;
      const paystackIdRaw = data.id;
      const paystackId =
        paystackIdRaw !== undefined && paystackIdRaw !== null ? String(paystackIdRaw) : undefined;
      const authorizationCode = (data.authorization as { authorization_code?: string | null })
        ?.authorization_code;
      const allowedSubscriptionChannels = getAllowedSubscriptionChannels(options);

      if (status === "success") {
        const session = await getSessionFromCtx(ctx);

        // Get the local transaction record to know the intended referenceId (Org or User)
        const txRecord = await ctx.context.adapter.findOne<
          PaystackTransaction & { referenceId?: string }
        >({
          model: "paystackTransaction",
          where: [{ field: "reference", value: reference }],
        });

        // Trust the referenceId from the record, fallback to session user if missing
        const referenceId =
          txRecord !== undefined &&
          txRecord !== null &&
          txRecord.referenceId !== undefined &&
          txRecord.referenceId !== null &&
          txRecord.referenceId !== ""
            ? txRecord.referenceId
            : session !== undefined && session !== null
              ? session.user.id
              : undefined;

        const isSubscriptionFlow =
          (txRecord?.plan !== undefined && txRecord.plan !== null && txRecord.plan !== "") ||
          Boolean((data as { plan?: unknown }).plan);

        if (
          isSubscriptionFlow &&
          isAllowedSubscriptionChannel(data.channel ?? undefined, allowedSubscriptionChannels) ===
            false
        ) {
          await ctx.context.adapter.update({
            model: "paystackTransaction",
            update: {
              status: "failed",
              paystackId,
              amount: data.amount,
              currency: data.currency,
              updatedAt: new Date(),
            },
            where: [{ field: "reference", value: reference }],
          });

          throw new APIError("BAD_REQUEST", {
            code: "SUBSCRIPTION_PAYMENT_CHANNEL_NOT_ALLOWED",
            message: `This subscription requires one of: ${allowedSubscriptionChannels?.join(", ") ?? "allowed channels"}.`,
          });
        }

        // Authorization check: ensure the current user has access to this referenceId
        if (
          session !== undefined &&
          session !== null &&
          referenceId !== undefined &&
          referenceId !== null &&
          referenceId !== "" &&
          referenceId !== session.user.id
        ) {
          await authorizeBillingReference(ctx as GenericEndpointContext, options, {
            user: session.user as User,
            session: session.session,
            referenceId,
            action: "verify-transaction",
          });
        }

        try {
          await ctx.context.adapter.update({
            model: "paystackTransaction",
            update: {
              status: "success",
              paystackId,
              amount: data.amount,
              currency: data.currency,
              updatedAt: new Date(),
            },
            where: [{ field: "reference", value: reference }],
          });

          const paystackCustomerCodeFromPaystack = data.customer?.customer_code;
          if (
            paystackCustomerCodeFromPaystack !== undefined &&
            paystackCustomerCodeFromPaystack !== null &&
            paystackCustomerCodeFromPaystack !== "" &&
            referenceId !== undefined &&
            referenceId !== null &&
            referenceId !== ""
          ) {
            let isOrg =
              options.organization?.enabled === true &&
              typeof referenceId === "string" &&
              referenceId.startsWith("org_");
            if (isOrg === false && options.organization?.enabled === true) {
              const org = await ctx.context.adapter.findOne({
                model: "organization",
                where: [{ field: "id", value: referenceId }],
              });
              isOrg = org !== undefined && org !== null;
            }

            if (isOrg) {
              await ctx.context.adapter.update({
                model: "organization",
                update: { paystackCustomerCode: paystackCustomerCodeFromPaystack },
                where: [{ field: "id", value: referenceId }],
              });
            } else {
              await ctx.context.adapter.update({
                model: "user",
                update: { paystackCustomerCode: paystackCustomerCodeFromPaystack },
                where: [{ field: "id", value: referenceId }],
              });
            }
          }

          // Decrement product quantity if applicable
          const transaction = await ctx.context.adapter.findOne<PaystackTransaction>({
            model: "paystackTransaction",
            where: [{ field: "reference", value: reference }],
          });
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
          }

          // Check for trial activation
          let isTrial = false;
          let trialEnd: string | undefined;
          let targetPlan: string | undefined;
          let metadataObj: Record<string, unknown> = {};

          if (data.metadata !== undefined && data.metadata !== null && data.metadata !== "") {
            metadataObj = (
              typeof data.metadata === "string" ? JSON.parse(data.metadata) : data.metadata
            ) as Record<string, unknown>;
            isTrial = metadataObj.isTrial === true || metadataObj.isTrial === "true";
            trialEnd = metadataObj.trialEnd as string | undefined;
            targetPlan = metadataObj.plan as string | undefined;
          }

          if (metadataObj.type === "proration") {
            const subscriptionId = metadataObj.subscriptionId as string | undefined;
            const newPlan = metadataObj.newPlan as string | undefined;
            const newSeatCount = metadataObj.newSeatCount as number | undefined;

            if (
              subscriptionId !== undefined &&
              subscriptionId !== "" &&
              newPlan !== undefined &&
              newPlan !== ""
            ) {
              await ctx.context.adapter.update<Subscription>({
                model: "subscription",
                update: {
                  plan: newPlan,
                  ...(typeof newSeatCount === "number" ? { seats: newSeatCount } : {}),
                  paystackTransactionReference: reference,
                  ...(authorizationCode !== undefined && authorizationCode !== null
                    ? { paystackAuthorizationCode: authorizationCode }
                    : {}),
                  updatedAt: new Date(),
                },
                where: [{ field: "id", value: subscriptionId }],
              });
            }

            return ctx.json({ status, reference, data });
          }

          let paystackSubscriptionCode: string | undefined;

          if (isTrial && targetPlan !== undefined && trialEnd !== undefined) {
            // Trial Flow: Create subscription with future start date using auth code
            const email = data.customer?.email;

            const plans = await getPlans(subscriptionOptions);
            const planConfig = plans.find(
              (p) => p.name.toLowerCase() === targetPlan?.toLowerCase(),
            );

            // For local plans (no planCode), generate a local subscription code
            if (
              planConfig !== undefined &&
              planConfig !== null &&
              (planConfig.planCode === undefined ||
                planConfig.planCode === null ||
                planConfig.planCode === "")
            ) {
              paystackSubscriptionCode = `LOC_${reference}`;
            }

            if (
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
              paystackSubscriptionCode = subRes?.subscription_code;
            }
          } else if (isTrial === false) {
            const planCodeFromPaystack = (data as { plan?: { plan_code?: string | null } }).plan
              ?.plan_code;
            if (
              planCodeFromPaystack === undefined ||
              planCodeFromPaystack === null ||
              planCodeFromPaystack === ""
            ) {
              // Local Plan
              paystackSubscriptionCode = `LOC_${reference}`;
            } else {
              // Native Paystack subscription (if created during charge)
              paystackSubscriptionCode =
                (data as { subscription?: { subscription_code?: string | null } }).subscription
                  ?.subscription_code ?? undefined;
            }
          }

          const existingSubs = await ctx.context.adapter.findMany<Subscription>({
            model: "subscription",
            where: [{ field: "paystackTransactionReference", value: reference }],
          });

          const targetSub = existingSubs?.find(
            (s) =>
              referenceId === undefined ||
              referenceId === null ||
              referenceId === "" ||
              s.referenceId === referenceId,
          );

          let updatedSubscription: Subscription | null = null;
          if (targetSub !== undefined && targetSub !== null) {
            updatedSubscription = await ctx.context.adapter.update<Subscription>({
              model: "subscription",
              update: {
                status: isTrial ? "trialing" : "active",
                periodStart: new Date(),
                updatedAt: new Date(),
                ...(isTrial && trialEnd !== undefined
                  ? {
                      trialStart: new Date(),
                      trialEnd: new Date(trialEnd),
                      periodEnd: new Date(trialEnd),
                    }
                  : {}),
                ...(paystackSubscriptionCode !== undefined ? { paystackSubscriptionCode } : {}),
                ...(authorizationCode !== undefined && authorizationCode !== null
                  ? { paystackAuthorizationCode: authorizationCode }
                  : {}),
              },
              where: [{ field: "id", value: targetSub.id }],
            });
          }

          if (
            updatedSubscription !== undefined &&
            updatedSubscription !== null &&
            subscriptionOptions?.onSubscriptionComplete !== undefined
          ) {
            const plans = await getPlans(subscriptionOptions);
            const plan = plans.find(
              (p) => p.name.toLowerCase() === updatedSubscription.plan.toLowerCase(),
            );
            if (plan !== undefined) {
              await subscriptionOptions.onSubscriptionComplete(
                {
                  event: data as unknown as PaystackWebhookPayload,
                  subscription: updatedSubscription,
                  plan,
                },
                ctx as GenericEndpointContext,
              );
            }
          }
        } catch (e: unknown) {
          ctx.context.logger.error(
            "Failed to update transaction/subscription after verification",
            e,
          );
        }
      }

      return ctx.json({ status, reference, data });
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

const enableDisableBodySchema = z.object({
  referenceId: z.string().optional(),
  subscriptionCode: z.string(),
  emailToken: z.string().optional(),
  atPeriodEnd: z.boolean().optional(),
});

function decodeBase64UrlToString(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  const binaryString = atob(padded);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function tryGetEmailTokenFromSubscriptionManageLink(link: string): string | undefined {
  try {
    const url = new URL(link);
    const subscriptionToken = url.searchParams.get("subscription_token");
    if (subscriptionToken === undefined || subscriptionToken === null || subscriptionToken === "")
      return undefined;
    const parts = subscriptionToken.split(".");
    if (parts.length < 2) return undefined;
    const payloadJson = decodeBase64UrlToString(parts[1]);
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    return typeof payload.email_token === "string" ? payload.email_token : undefined;
  } catch {
    return undefined;
  }
}

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
            model: "subscription",
            where: [{ field: "paystackSubscriptionCode", value: subscriptionCode }],
          });

          if (sub !== null && sub !== undefined) {
            await ctx.context.adapter.update({
              model: "subscription",
              update: {
                status: atPeriodEnd === false ? "canceled" : "active",
                cancelAtPeriodEnd: atPeriodEnd !== false,
                updatedAt: new Date(),
              },
              where: [{ field: "id", value: sub.id }],
            });
            return ctx.json({ status: "success" });
          }
          throw new APIError("BAD_REQUEST", { message: "Subscription not found" });
        }

        let emailToken = ctx.body.emailToken;
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

        await paystack?.subscription?.disable({
          body: { code: subscriptionCode, token: emailToken },
        });

        const periodEnd =
          nextPaymentDate !== undefined && nextPaymentDate !== null && nextPaymentDate !== ""
            ? new Date(nextPaymentDate)
            : undefined;

        const sub = await ctx.context.adapter.findOne<Subscription>({
          model: "subscription",
          where: [{ field: "paystackSubscriptionCode", value: subscriptionCode }],
        });

        if (sub !== undefined && sub !== null) {
          await ctx.context.adapter.update({
            model: "subscription",
            update: {
              status: atPeriodEnd === false ? "canceled" : "active",
              cancelAtPeriodEnd: atPeriodEnd !== false,
              periodEnd,
              updatedAt: new Date(),
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
        let emailToken = ctx.body.emailToken;
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

        await paystack?.subscription?.enable({
          body: { code: subscriptionCode, token: emailToken },
        });

        // Update local status immediately
        await ctx.context.adapter.update({
          model: "subscription",
          update: {
            status: "active",
            updatedAt: new Date(),
          },
          where: [{ field: "paystackSubscriptionCode", value: subscriptionCode }],
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
      const products = await createBillingStore(ctx).listProducts();
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
        const plans = await createBillingStore(ctx).listPlans();
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
      const plans =
        options.subscription?.enabled === true ? await getPlans(options.subscription) : [];
      const products = await getProducts(options.products);
      return ctx.json({ plans, products });
    },
  );
};

export { PAYSTACK_ERROR_CODES };
