import { createAuthEndpoint } from "@better-auth/core/api";
import { defineErrorCodes } from "@better-auth/core/utils";
import { HIDE_METADATA } from "better-auth";
import {
    APIError,
    getSessionFromCtx,
    originCheck,
    sessionMiddleware,
} from "better-auth/api";
import * as z from "zod/v4";

import type { InputPaystackTransaction, InputSubscription, PaystackOptions, PaystackTransaction, Subscription, Organization, Member, User } from "./types";
import { getPlanByName, getPlans, getProductByName, getProducts } from "./utils";
import { referenceMiddleware } from "./middleware";
import { getPaystackOps, unwrapSdkResult } from "./paystack-sdk";

type AnyPaystackOptions = PaystackOptions<any>;

const PAYSTACK_ERROR_CODES = defineErrorCodes({
    SUBSCRIPTION_NOT_FOUND: "Subscription not found",
    SUBSCRIPTION_PLAN_NOT_FOUND: "Subscription plan not found",
    UNABLE_TO_CREATE_CUSTOMER: "Unable to create customer",
    FAILED_TO_INITIALIZE_TRANSACTION: "Failed to initialize transaction",
    FAILED_TO_VERIFY_TRANSACTION: "Failed to verify transaction",
    FAILED_TO_DISABLE_SUBSCRIPTION: "Failed to disable subscription",
    FAILED_TO_ENABLE_SUBSCRIPTION: "Failed to enable subscription",
    EMAIL_VERIFICATION_REQUIRED:
        "Email verification is required before you can subscribe to a plan",
});

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const msgData = encoder.encode(message);

    const subtle = (globalThis.crypto as any)?.subtle;
    if (subtle) {
        const key = await subtle.importKey(
            "raw",
            keyData,
            { name: "HMAC", hash: "SHA-512" },
            false,
            ["sign"],
        );
        const signature = await subtle.sign("HMAC", key, msgData);
        return Array.from(new Uint8Array(signature))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    }

    const { createHmac } = await import("node:crypto");
    return createHmac("sha512", secret).update(message).digest("hex");
}

export const paystackWebhook = (options: AnyPaystackOptions) => {
    return createAuthEndpoint(
        "/paystack/webhook",
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
            const request = (ctx as any).requestClone ?? ctx.request;
            const payload = await request.text();
            const headers = (ctx as any).headers ?? (ctx.request as any)?.headers;
            const signature = headers?.get("x-paystack-signature") as
                | string
                | null
                | undefined;

            if (!signature) {
                throw new APIError("UNAUTHORIZED", {
                    message: "Missing x-paystack-signature header",
                    status: 401,
                });
            }

            const expected = await hmacSha512Hex(options.paystackWebhookSecret, payload);
            if (expected !== signature) {
                throw new APIError("UNAUTHORIZED", {
                    message: "Invalid Paystack webhook signature",
                    status: 401,
                });
            }

            const event = JSON.parse(payload) as any;

            // Best-effort local state sync for subscription lifecycle.
            if (options.subscription?.enabled) {
                const eventName = String(event?.event ?? "");
                const data = event?.data as any;
                try {
                    if (eventName === "charge.success") {
                        const reference = data?.reference;
                        const paystackId = data?.id ? String(data.id) : undefined;
                        if (reference) {
                            await ctx.context.adapter.update({
                                model: "paystackTransaction",
                                update: {
                                    status: "success",
                                    paystackId,
                                    updatedAt: new Date(),
                                },
                                where: [{ field: "reference", value: reference }],
                            });
                        }
                    }

                    if (eventName === "charge.failure") {
                         const reference = data?.reference;
                         if (reference) {
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
                                  // Transaction might not exist or other error, log and ignore
                                  ctx.context.logger.warn("Failed to update transaction status for charge.failure", e);
                              }
                         }
                    }

                    if (eventName === "subscription.create") {
                        const subscriptionCode =
                            data?.subscription_code ??
                            data?.subscription?.subscription_code ??
                            data?.code;
                        const customerCode =
                            data?.customer?.customer_code ??
                            data?.customer_code ??
                            data?.customer?.code;
                        const planCode =
                            data?.plan?.plan_code ?? data?.plan_code ?? data?.plan;

                        let metadata: any = data?.metadata;
                        if (typeof metadata === "string") {
                            try {
                                metadata = JSON.parse(metadata);
                            } catch {
                                // ignore
                            }
                        }

                        const referenceIdFromMetadata =
                            typeof metadata === "object" && metadata
                                ? (metadata.referenceId as string | undefined)
                                : undefined;

                        let planNameFromMetadata =
                            typeof metadata === "object" && metadata
                                ? (metadata.plan as string | undefined)
                                : undefined;
                        if (typeof planNameFromMetadata === "string") {
                            planNameFromMetadata = planNameFromMetadata.toLowerCase();
                        }

                        const plans = await getPlans(options.subscription);
                        const planFromCode = planCode
                            ? plans.find((p) => p.planCode && p.planCode === planCode)
                            : undefined;
                        const planName = (planFromCode?.name ?? planNameFromMetadata)?.toLowerCase();

                        if (subscriptionCode) {
                            const where: Array<{ field: string; value: any }> = [];
                            if (referenceIdFromMetadata) {
                                where.push({ field: "referenceId", value: referenceIdFromMetadata });
                            } else if (customerCode) {
                                where.push({ field: "paystackCustomerCode", value: customerCode });
                            }
                            if (planName) {
                                where.push({ field: "plan", value: planName });
                            }

                            if (where.length > 0) {
                                const matches = await ctx.context.adapter.findMany<Subscription>({
                                    model: "subscription",
                                    where,
                                });
                                const subscription = matches?.[0];
                                if (subscription) {
                                    await ctx.context.adapter.update({
                                        model: "subscription",
                                        update: {
                                            paystackSubscriptionCode: subscriptionCode,
                                            status: "active",
                                            updatedAt: new Date(),
                                        },
                                        where: [{ field: "id", value: subscription.id }],
                                    });

                                    const plan = planFromCode ?? (planName ? await getPlanByName(options, planName) : undefined);
                                    if (plan) {
                                        await options.subscription.onSubscriptionComplete?.(
                                            { event, subscription: { ...subscription, paystackSubscriptionCode: subscriptionCode, status: "active" }, plan },
                                            ctx as any,
                                        );
                                        // Also call onSubscriptionCreated for subscriptions created outside of checkout
                                        await options.subscription.onSubscriptionCreated?.(
                                            { event, subscription: { ...subscription, paystackSubscriptionCode: subscriptionCode, status: "active" }, plan },
                                            ctx as any,
                                        );
                                    }
                                }
                            }
                        }
                    }

                    if (eventName === "subscription.disable" || eventName === "subscription.not_renew") {
                        const subscriptionCode =
                            data?.subscription_code ??
                            data?.subscription?.subscription_code ??
                            data?.code;
                        if (subscriptionCode) {
                            // Find the subscription first to get full data for the hook
                            const existing = await ctx.context.adapter.findOne<Subscription>({
                                model: "subscription",
                                where: [{ field: "paystackSubscriptionCode", value: subscriptionCode }],
                            });

                            await ctx.context.adapter.update({
                                model: "subscription",
                                update: {
                                    status: "canceled",
                                    updatedAt: new Date(),
                                },
                                where: [
                                    { field: "paystackSubscriptionCode", value: subscriptionCode },
                                ],
                            });

                            if (existing) {
                                await options.subscription.onSubscriptionCancel?.(
                                    { event, subscription: { ...existing, status: "canceled" } },
                                    ctx as any,
                                );
                            }
                        }
                    }
                } catch (e: any) {
                    ctx.context.logger.error("Failed to sync Paystack webhook event", e);
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
    amount: z.number().int().positive().optional(), // Amount in smallest currency unit (e.g., kobo)
    currency: z.string().optional(),
    email: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    referenceId: z.string().optional(),
    callbackURL: z.string().optional(),
    quantity: z.number().int().positive().optional(),
});

export const initializeTransaction = <P extends string = "/paystack/initialize-transaction">(options: AnyPaystackOptions, path: P = "/paystack/initialize-transaction" as P) => {
    const subscriptionOptions = options.subscription;
    // If subscriptions are enabled, use full middleware stack; otherwise just basics.
    // However, for one-time payments, we might not strictly need subscription middleware
    // checking for existing subs, but let's keep it consistent for now.
    const useMiddlewares = subscriptionOptions?.enabled
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
            const { plan: planName, product: productName, amount: bodyAmount, currency, email, metadata: extraMetadata, callbackURL, quantity } = ctx.body;

            // 1. Validate Callback URL validation (same as before)
            if (callbackURL) {
                const checkTrusted = () => {
                    try {
                        if (!callbackURL) return false;
                        if (callbackURL.startsWith("/")) return true;
                        const baseUrl =
                            (ctx.context as any)?.baseURL ??
                            (ctx.request as any)?.url ??
                            "";
                        if (!baseUrl) return false;
                        const baseOrigin = new URL(baseUrl).origin;
                        return new URL(callbackURL).origin === baseOrigin;
                    } catch {
                        return false;
                    }
                };
                if (!checkTrusted()) {
                    throw new APIError("FORBIDDEN", {
                        message: "callbackURL is not a trusted origin.",
                        status: 403,
                    });
                }
            }

            // 2. Get User & Session
            const session = await getSessionFromCtx(ctx);
            if (!session) throw new APIError("UNAUTHORIZED");
            const user = session.user;
            
            // 3. Email Verification Check (only if subscription options enforce it)
            if (subscriptionOptions?.enabled && subscriptionOptions.requireEmailVerification && !user.emailVerified) {
                throw new APIError("BAD_REQUEST", {
                    code: "EMAIL_VERIFICATION_REQUIRED",
                    message: PAYSTACK_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED,
                });
            }

            // 4. Determine Payment Mode: Subscription (Plan) vs Product vs One-Time (Amount)
            let plan: ReturnType<typeof getPlanByName> extends Promise<infer U> ? U : never;
            let product: ReturnType<typeof getProductByName> extends Promise<infer U> ? U : never;
            
            if (planName) {
                if (!subscriptionOptions?.enabled) {
                    throw new APIError("BAD_REQUEST", { message: "Subscriptions are not enabled." });
                }
                plan = await getPlanByName(options, planName);
                if (!plan) {
                    throw new APIError("BAD_REQUEST", {
                        code: "SUBSCRIPTION_PLAN_NOT_FOUND",
                        message: PAYSTACK_ERROR_CODES.SUBSCRIPTION_PLAN_NOT_FOUND,
                        status: 400
                    });
                }
            } else if (productName) {
                product = await getProductByName(options, productName);
                if (!product) {
                    throw new APIError("BAD_REQUEST", {
                        message: `Product '${productName}' not found.`,
                        status: 400
                    });
                }
            } else if (!bodyAmount) {
                throw new APIError("BAD_REQUEST", {
                    message: "Either 'plan', 'product', or 'amount' is required to initialize a transaction.",
                    status: 400
                });
            }

            const amount = bodyAmount || product?.amount;
            const finalCurrency = currency || product?.currency || plan?.currency || "NGN";

            let url: string | undefined;
            let reference: string | undefined;
            let accessCode: string | undefined;

            // 5. Prepare Payload

            const referenceIdFromCtx = (ctx.context as any).referenceId as string | undefined;
            const referenceId = ctx.body.referenceId || referenceIdFromCtx || (session.user as any).id;

            console.log("DEBUG ROUTES REF:", {
                referenceId,
                referenceIdFromCtx,
                bodyRef: ctx.body.referenceId,
                userId: (session.user as any).id,
                orgEnabled: options.organization?.enabled,
                contextKeys: Object.keys((ctx as any).context || {}),
                fullContext: (ctx as any).context
            });

                // Check trial eligibility - prevent trial abuse
                let trialStart: Date | undefined;
                let trialEnd: Date | undefined;
                if (plan && plan.freeTrial?.days && plan.freeTrial.days > 0) {
                    // Check if user/referenceId has ever had a trial
                    const previousTrials = await ctx.context.adapter.findMany<Subscription>({
                        model: "subscription",
                        where: [{ field: "referenceId", value: referenceId }],
                    });
                    const hadTrial = previousTrials?.some(
                        (sub) => sub.trialStart || sub.trialEnd || sub.status === "trialing"
                    );
                    
                    if (!hadTrial) {
                        trialStart = new Date();
                        trialEnd = new Date();
                        trialEnd.setDate(trialEnd.getDate() + plan.freeTrial.days);
                    }
                }

                try {
                // Determine Customer Email & Code (Organization support)
                let targetEmail = email || user.email;
                let paystackCustomerCode = (user as any).paystackCustomerCode;

                if (options.organization?.enabled && referenceId && referenceId !== user.id) {
                     const org = await ctx.context.adapter.findOne<Organization>({
                         model: "organization",
                         where: [{ field: "id", value: referenceId }],
                     });
                     if (org) {
                         // Prefer organization's existing Paystack customer code
                         if (org.paystackCustomerCode) {
                             paystackCustomerCode = org.paystackCustomerCode;
                         }
                                                  if (org.email) {
                               targetEmail = org.email;
                          } else {
                               // Fallback: Use Organization Owner Email
                               const ownerMember = await ctx.context.adapter.findOne<Member>({
                                   model: "member",
                                   where: [
                                       { field: "organizationId", value: referenceId },
                                       { field: "role", value: "owner" }
                                   ]
                               });

                                if (ownerMember) {
                                    const ownerUser = await ctx.context.adapter.findOne<User>({
                                        model: "user",
                                        where: [{ field: "id", value: ownerMember.userId }]
                                    });

                                    if (ownerUser?.email) {
                                       targetEmail = ownerUser.email;
                                   }
                               }
                          }
                     }
                }

                // Construct Metadata
                const metadata = JSON.stringify({
                    referenceId,
                    userId: user.id,
                    plan: plan?.name.toLowerCase(), // Undefined for one-time
                    product: product?.name.toLowerCase(),
                    isTrial: !!trialStart,
                    trialEnd: trialEnd?.toISOString(),
                    ...extraMetadata,
                });

                const initBody: any = {
                    email: targetEmail,
                    callback_url: callbackURL,
                    metadata,
                    // If plan/product exists, use its currency; otherwise fallback to provided or default
                    currency: finalCurrency,
                    quantity,
                };

                // Sync/Update Customer: ensure email matches if code exists
                if (paystackCustomerCode) {
                    try {
                        const ops = getPaystackOps(options.paystackClient);
                        // Only update if email is present
                         if (initBody.email) {
                             await ops.customerUpdate(paystackCustomerCode, { email: initBody.email });
                         }
                    } catch (e) {
                        // Ignore sync errors
                    }
                }


                if (plan) {
                    // Subscription Flow
                    if (trialStart) {
                         // Trial Flow: Authorize card with minimum amount, don't start sub yet
                         initBody.amount = 5000; // 50 NGN (minimum allowed)
                         // Do NOT set initBody.plan
                    } else {
                        // Standard Flow
                        initBody.plan = plan.planCode;
                        initBody.invoice_limit = plan.invoiceLimit;
                        // Paystack requires amount even with planCode (it uses plan's stored amount)
                        // For local plans without planCode, use finalAmount; for planCode plans, use plan.amount or minimum
                        const planAmount = amount ?? plan.amount ?? 50000; // 500 NGN minimum fallback
                        initBody.amount = Math.max(Math.round(planAmount), 50000);
                        if (quantity) {
                            initBody.amount = initBody.amount * quantity;
                        }
                    }
                } else {
                    // One-Time Payment Flow
                    if (!amount) throw new Error("Amount is required for one-time payments");
                    initBody.amount = Math.round(amount);
                }

                const initRaw = await paystack.transactionInitialize(initBody);
                const initRes = unwrapSdkResult<any>(initRaw);
                let data =
                    initRes && typeof initRes === "object" && "status" in initRes && "data" in initRes
                        ? (initRes as any).data
                        : initRes?.data ?? initRes;
                
                if (data && typeof data === "object" && "status" in data && "data" in data) {
                    data = data.data;
                }
                url = data?.authorization_url;
                reference = data?.reference;
                accessCode = data?.access_code;
            } catch (error: any) {
                ctx.context.logger.error("Failed to initialize Paystack transaction", error);
                throw new APIError("BAD_REQUEST", {
                    code: "FAILED_TO_INITIALIZE_TRANSACTION",
                    message: error?.message || PAYSTACK_ERROR_CODES.FAILED_TO_INITIALIZE_TRANSACTION,
                });
            }

            // 6. Record Transaction & Subscription
            await ctx.context.adapter.create<InputPaystackTransaction, PaystackTransaction>({
                model: "paystackTransaction",
                data: {
                    reference: reference!,
                    referenceId,
                    userId: user.id,
                    amount: amount!,
                    currency: plan?.currency || currency || "NGN",
                    status: "pending",
                    plan: plan?.name.toLowerCase(),
                    metadata: extraMetadata ? JSON.stringify(extraMetadata) : undefined,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            });

            if (plan) {
                // Re-fetch customer code if it wasn't available before (though we didn't force-create it here)
                // For now, use what we have (user's or org's)
                let storedCustomerCode = (user as any).paystackCustomerCode;
                if (options.organization?.enabled && referenceId !== user.id) {
                     const org = await ctx.context.adapter.findOne<Organization>({
                         model: "organization",
                         where: [{ field: "id", value: referenceId }],
                     });
                     if (org?.paystackCustomerCode) {
                         storedCustomerCode = org.paystackCustomerCode;
                     }
                }

                const newSubscription = await ctx.context.adapter.create<InputSubscription, Subscription>({
                    model: "subscription",
                    data: {
                        plan: plan.name.toLowerCase(),
                        referenceId,
                        paystackCustomerCode: storedCustomerCode,
                        paystackTransactionReference: reference,
                        status: trialStart ? "trialing" : "incomplete",
                        seats: quantity,
                        trialStart,
                        trialEnd,
                    },
                });

                // Call trial start hook if trial was granted
                if (trialStart && newSubscription && plan.freeTrial?.onTrialStart) {
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
export const createSubscription = (options: AnyPaystackOptions) =>
	initializeTransaction(options, "/paystack/create-subscription");
export const upgradeSubscription = (options: AnyPaystackOptions) =>
	initializeTransaction(options, "/paystack/upgrade-subscription");
export const restoreSubscription = (options: AnyPaystackOptions) => {
	// Alias for enable
	return enablePaystackSubscription(options, "/paystack/restore-subscription");
};
export const cancelSubscription = (options: AnyPaystackOptions) => {
	// Alias for disable
	return disablePaystackSubscription(options, "/paystack/cancel-subscription");
};


export const verifyTransaction = <P extends string = "/paystack/verify-transaction">(options: AnyPaystackOptions, path: P = "/paystack/verify-transaction" as P) => {
    const verifyBodySchema = z.object({
        reference: z.string(),
    });

    const subscriptionOptions = options.subscription;
    const useMiddlewares = subscriptionOptions?.enabled
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
            let verifyRes: any;
            try {
                const verifyRaw = await paystack.transactionVerify(ctx.body.reference);
                verifyRes = unwrapSdkResult<any>(verifyRaw);
            } catch (error: any) {
                ctx.context.logger.error("Failed to verify Paystack transaction", error);
                throw new APIError("BAD_REQUEST", {
                    code: "FAILED_TO_VERIFY_TRANSACTION",
                    message:
                        error?.message || PAYSTACK_ERROR_CODES.FAILED_TO_VERIFY_TRANSACTION,
                });
            }
            let data =
                verifyRes && typeof verifyRes === "object" && "status" in verifyRes && "data" in verifyRes
                    ? (verifyRes as any).data
                    : verifyRes?.data ?? verifyRes;
            
            if (data && typeof data === "object" && "status" in data && "data" in data) {
                data = data.data;
            }
            const status = data?.status;
            const reference = data?.reference ?? ctx.body.reference;
            const paystackId = data?.id ? String(data.id) : undefined;

            if (status === "success") {
                try {
                    const session = await getSessionFromCtx(ctx);
                    
                    // Get the local transaction record to know the intended referenceId (Org or User)
                    const txRecord = await ctx.context.adapter.findOne<any>({
                        model: "paystackTransaction",
                        where: [{ field: "reference", value: reference }],
                    });
                    
                    // Trust the referenceId from the record, fallback to session user if missing
                    const referenceId = txRecord?.referenceId ?? (session?.user as any)?.id;

                     // Authorization check: ensure the current user has access to this referenceId
                     if (session && referenceId !== session.user.id) {
                          const authRef = (subscriptionOptions as any)?.authorizeReference;
                          let authorized = false;
                          if (authRef) {
                              authorized = await authRef({
                                  user: session.user,
                                  session,
                                  referenceId,
                                  action: "verify-transaction"
                              }, ctx);
                          } else if (options.organization?.enabled) {
                               const member = await ctx.context.adapter.findOne({
                                   model: "member",
                                   where: [
                                       { field: "userId", value: session.user.id },
                                       { field: "organizationId", value: referenceId }
                                   ]
                               });
                               if (member) authorized = true;
                          }
                          
                          if (!authorized) {
                              throw new APIError("UNAUTHORIZED");
                          }
                     }

                    await ctx.context.adapter.update({
                        model: "paystackTransaction",
                        update: {
                            status: "success",
                            paystackId,
                            // Update with actual amount/currency from Paystack (for planCode subscriptions)
                            ...(data?.amount && { amount: data.amount }),
                            ...(data?.currency && { currency: data.currency }),
                            updatedAt: new Date(),
                        },
                        where: [{ field: "reference", value: reference }],
                    });

                    // Sync Customer Code back to User or Org if missing
                    const paystackCustomerCodeFromPaystack = data?.customer?.customer_code;
                    if (paystackCustomerCodeFromPaystack && referenceId) {
                        const isOrg = options.organization?.enabled && (referenceId.startsWith("org_") || (await ctx.context.adapter.findOne({ model: "organization", where: [{ field: "id", value: referenceId }] })));

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

                    // Check for trial activation
                    let isTrial = false;
                    let trialEnd: string | undefined;
                    let targetPlan: string | undefined;

                    if (data?.metadata) {
                         const meta = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata;
                         isTrial = !!meta.isTrial;
                         trialEnd = meta.trialEnd;
                         targetPlan = meta.plan;
                    }

                    let paystackSubscriptionCode: string | undefined;

                    if (isTrial && targetPlan && trialEnd) {
                        // Trial Flow: Create subscription with future start date using auth code
                        const authorizationCode = data?.authorization?.authorization_code;
                        const email = data?.customer?.email;
                        
                        // We need the planCode. We have the plan NAME in metadata (lowercased).
                        const plans = await getPlans(subscriptionOptions as any);
                        const planConfig = plans.find(p => p.name.toLowerCase() === targetPlan?.toLowerCase());

                        if (authorizationCode && email && planConfig?.planCode) {
                             const subRes = await paystack.subscriptionCreate({
                                 customer: email,
                                 plan: planConfig.planCode,
                                 authorization: authorizationCode,
                                 start_date: trialEnd
                             });
                             const subData = unwrapSdkResult<any>(subRes);
                             const cleanSubData = (subData as any).data || subData;
                             console.log("Trial Subscription Created:", JSON.stringify(cleanSubData, null, 2));
                             paystackSubscriptionCode = cleanSubData?.subscription_code;
                        }
                    }

                    const updatedSubscription = await ctx.context.adapter.update<Subscription>({
                        model: "subscription",
                        update: {
                            status: isTrial ? "trialing" : "active",
                            periodStart: new Date(),
                            updatedAt: new Date(),
                            ...(paystackSubscriptionCode && { paystackSubscriptionCode }),
                        },
                        where: [
                            { field: "paystackTransactionReference", value: reference },
                            ...(referenceId ? [{ field: "referenceId", value: referenceId }] : []),
                        ],
                    });

                    if (updatedSubscription && subscriptionOptions?.enabled && (subscriptionOptions as any).onSubscriptionComplete) {
                        const subOpts = subscriptionOptions as any;
                        const plans = await getPlans(subOpts);
                        const plan = plans.find(p => p.name.toLowerCase() === updatedSubscription.plan.toLowerCase());
                        if (plan) {
                            await subOpts.onSubscriptionComplete({
                                event: data,
                                subscription: updatedSubscription,
                                plan
                            }, ctx as any);
                        }
                    }
                } catch (e: any) {
                    ctx.context.logger.error(
                        "Failed to update transaction/subscription after verification",
                        e,
                    );
                }
            } else if (status === "failed" || status === "abandoned") {
                try {
                    await ctx.context.adapter.update({
                        model: "paystackTransaction",
                        update: {
                            status,
                            updatedAt: new Date(),
                        },
                        where: [{ field: "reference", value: reference }],
                    });
                } catch (e: any) {
                    ctx.context.logger.error("Failed to update transaction status", e);
                }
            }

            return ctx.json({
                status,
                reference,
                data,
            });
        },
    );
};

export const listSubscriptions = (options: AnyPaystackOptions) => {
    const listQuerySchema = z.object({
        referenceId: z.string().optional(),
    });

    const subscriptionOptions = options.subscription;
    const useMiddlewares = subscriptionOptions?.enabled
        ? [sessionMiddleware, originCheck, referenceMiddleware(options, "list-subscriptions")]
        : [sessionMiddleware, originCheck];

    return createAuthEndpoint(
        "/paystack/list-subscriptions",
        {
            method: "GET",
            query: listQuerySchema,
            use: useMiddlewares,
        },
        async (ctx) => {
            if (!subscriptionOptions?.enabled) {
                throw new APIError("BAD_REQUEST", {
                    message: "Subscriptions are not enabled in the Paystack options.",
                });
            }
            const session = await getSessionFromCtx(ctx);
            if (!session) throw new APIError("UNAUTHORIZED");
            const referenceId =
                ((ctx.context as any).referenceId as string | undefined) ??
                (ctx.query?.referenceId as string | undefined) ??
                ((session.user as any).id as string);
            const res = await ctx.context.adapter.findMany<Subscription>({
                model: "subscription",
                where: [{ field: "referenceId", value: referenceId }],
            });
            return ctx.json({ subscriptions: res });
        },
    );
};

export const listTransactions = <P extends string = "/paystack/list-transactions">(options: AnyPaystackOptions, path: P = "/paystack/list-transactions" as P) => {
    const listQuerySchema = z.object({
        referenceId: z.string().optional(),
    });

    const subscriptionOptions = options.subscription;
    const useMiddlewares = subscriptionOptions?.enabled
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
            if (!session) throw new APIError("UNAUTHORIZED");
            const referenceId =
                ((ctx.context as any).referenceId as string | undefined) ??
                (ctx.query?.referenceId as string | undefined) ??
                ((session.user as any).id as string);
            const res = await ctx.context.adapter.findMany<PaystackTransaction>({
                model: "paystackTransaction",
                where: [{ field: "referenceId", value: referenceId }],
            });
            // Sort by createdAt desc locally if adapter doesn't support it well, 
            // but Better Auth adapters usually return in insertion order.
            // Let's sort to be sure.
            const sorted = res.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            return ctx.json({ transactions: sorted });
        },
    );
};

const enableDisableBodySchema = z.object({
    referenceId: z.string().optional(),
    subscriptionCode: z.string(),
    emailToken: z.string().optional(),
});

function decodeBase64UrlToString(value: string): string {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "===".slice((normalized.length + 3) % 4);
    if (typeof (globalThis as any).atob === "function") {
        return (globalThis as any).atob(padded);
    }
    // Node fallback
     
    return Buffer.from(padded, "base64").toString("utf8");
}

function tryGetEmailTokenFromSubscriptionManageLink(link: string): string | undefined {
    try {
        const url = new URL(link);
        const subscriptionToken = url.searchParams.get("subscription_token");
        if (!subscriptionToken) return undefined;
        const parts = subscriptionToken.split(".");
        if (parts.length < 2) return undefined;
        const payloadJson = decodeBase64UrlToString(parts[1]!);
        const payload = JSON.parse(payloadJson) as any;
        return typeof payload?.email_token === "string" ? payload.email_token : undefined;
    } catch {
        return undefined;
    }
}

export const disablePaystackSubscription = <P extends string = "/paystack/disable-subscription">(options: AnyPaystackOptions, path: P = "/paystack/disable-subscription" as P) => {
    const subscriptionOptions = options.subscription;
    const useMiddlewares = subscriptionOptions?.enabled
        ? [sessionMiddleware, originCheck, referenceMiddleware(options, "disable-subscription")]
        : [sessionMiddleware, originCheck];

    return createAuthEndpoint(
        path,
        { method: "POST", body: enableDisableBodySchema, use: useMiddlewares },
        async (ctx) => {
            const { subscriptionCode } = ctx.body;
            const paystack = getPaystackOps(options.paystackClient);
            try {
                let emailToken = ctx.body.emailToken;
                if (!emailToken) {
                    try {
                        const raw = await paystack.subscriptionFetch(subscriptionCode);
                        const fetchRes = unwrapSdkResult<any>(raw);
                        const data =
                            fetchRes && typeof fetchRes === "object" && "status" in fetchRes && "data" in fetchRes
                                ? (fetchRes as any).data
                                : fetchRes?.data ?? fetchRes;
                        emailToken = data?.email_token;
                    } catch {
                        // ignore; try manage-link fallback below
                    }
                }

                if (!emailToken) {
                    try {
                        const raw = await paystack.subscriptionManageLink(subscriptionCode);
                        const linkRes = unwrapSdkResult<any>(raw);
                        const data =
                            linkRes && typeof linkRes === "object" && "status" in linkRes && "data" in linkRes
                                ? (linkRes as any).data
                                : linkRes?.data ?? linkRes;
                        // data might be string (link) or object with link?
                        // SDK says it returns string usually? 
                        // Actually the SDK wrapper returns the response object.
                        const link = typeof data === "string" ? data : data?.link;
                        
                        if (link) {
                            emailToken = tryGetEmailTokenFromSubscriptionManageLink(link);
                        }
                    } catch {
                        // ignore
                    }
                }
                
                if (!emailToken) {
                    // One last try: send email to owner? No, that's async.
                    // If we still don't have emailToken, we can't disable.
                    throw new Error("Could not retrieve email_token for subscription disable.");
                }

                await paystack.subscriptionDisable({ code: subscriptionCode, token: emailToken });
                
                // Update local status immediately
                await ctx.context.adapter.update({
                    model: "subscription",
                    update: {
                        status: "canceled",
                        updatedAt: new Date(),
                    },
                    where: [{ field: "paystackSubscriptionCode", value: subscriptionCode }],
                });

                return ctx.json({ status: "success" });
            } catch (error: any) {
                ctx.context.logger.error("Failed to disable subscription", error);
                throw new APIError("BAD_REQUEST", {
                    code: "FAILED_TO_DISABLE_SUBSCRIPTION",
                    message:
                        error?.message || PAYSTACK_ERROR_CODES.FAILED_TO_DISABLE_SUBSCRIPTION,
                });
            }
        },
    );
};

export const enablePaystackSubscription = <P extends string = "/paystack/enable-subscription">(options: AnyPaystackOptions, path: P = "/paystack/enable-subscription" as P) => {
    const subscriptionOptions = options.subscription;
    const useMiddlewares = subscriptionOptions?.enabled
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
                 if (!emailToken) {
                     try {
                         const raw = await paystack.subscriptionFetch(subscriptionCode);
                         const fetchRes = unwrapSdkResult<any>(raw);
                         const data =
                             fetchRes && typeof fetchRes === "object" && "status" in fetchRes && "data" in fetchRes
                                 ? (fetchRes as any).data
                                 : fetchRes?.data ?? fetchRes;
                         emailToken = data?.email_token;
                     } catch {
                     }
                 }

                 if (!emailToken) {
                     try {
                         const raw = await paystack.subscriptionManageLink(subscriptionCode);
                         const linkRes = unwrapSdkResult<any>(raw);
                         const data =
                             linkRes && typeof linkRes === "object" && "status" in linkRes && "data" in linkRes
                                 ? (linkRes as any).data
                                 : linkRes?.data ?? linkRes;
                         const link = typeof data === "string" ? data : data?.link;
                         
                         if (link) {
                             emailToken = tryGetEmailTokenFromSubscriptionManageLink(link);
                         }
                     } catch {
                     }
                 }
                
                if (!emailToken) {
                    throw new Error("Could not retrieve email_token for subscription enable.");
                }

                await paystack.subscriptionEnable({ code: subscriptionCode, token: emailToken });

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
            } catch (error: any) {
                ctx.context.logger.error("Failed to enable subscription", error);
                throw new APIError("BAD_REQUEST", {
                    code: "FAILED_TO_ENABLE_SUBSCRIPTION",
                    message:
                        error?.message || PAYSTACK_ERROR_CODES.FAILED_TO_ENABLE_SUBSCRIPTION,
                });
            }
        },
    );
};

export const getSubscriptionManageLink = (options: AnyPaystackOptions) => {
    const manageLinkQuerySchema = z.object({
        subscriptionCode: z.string(),
    });
    const subscriptionOptions = options.subscription;
    const useMiddlewares = subscriptionOptions?.enabled
        ? [sessionMiddleware, originCheck, referenceMiddleware(options, "get-subscription-manage-link")]
        : [sessionMiddleware, originCheck];

    return createAuthEndpoint(
        "/paystack/get-subscription-manage-link",
        {
            method: "GET",
            query: manageLinkQuerySchema,
            use: useMiddlewares,
        },
        async (ctx) => {
            const { subscriptionCode } = ctx.query;
            const paystack = getPaystackOps(options.paystackClient);
            try {
                const raw = await paystack.subscriptionManageLink(subscriptionCode);
                const res = unwrapSdkResult<any>(raw);
                const data =
                    res && typeof res === "object" && "status" in res && "data" in res
                        ? (res as any).data
                        : res?.data ?? res;
                // data might be string or object with link
                const link = typeof data === "string" ? data : data?.link;
                
                return ctx.json({ link });
            } catch (error: any) {
                ctx.context.logger.error("Failed to get subscription manage link", error);
                throw new APIError("BAD_REQUEST", {
                    message: error?.message || "Failed to get subscription manage link",
                });
            }
        },
    );
};

export const getConfig = (options: AnyPaystackOptions) => {
    return createAuthEndpoint(
        "/paystack/get-config",
        {
            method: "GET",
            metadata: {
                openapi: {
                    operationId: "getPaystackConfig",
                },
            },
        },
        async (ctx) => {
            const plans = options.subscription?.enabled
                ? await getPlans(options.subscription)
                : [];
            const products = await getProducts(options.products);
            return ctx.json({
                plans,
                products,
            });
        }
    );
};

export { PAYSTACK_ERROR_CODES };
