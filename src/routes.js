import { createAuthEndpoint } from "@better-auth/core/api";
import { defineErrorCodes } from "@better-auth/core/utils/error-codes";
import { HIDE_METADATA } from "better-auth";
import { APIError, getSessionFromCtx, originCheck, sessionMiddleware, } from "better-auth/api";
import * as z from "zod/v4";
import { syncProductQuantityFromPaystack, getPlanByName, getPlans, getProductByName, getProducts, validateMinAmount, getNextPeriodEnd, } from "./utils";
import { referenceMiddleware } from "./middleware";
import { getPaystackOps, unwrapSdkResult } from "./paystack-sdk";
import { getOrganizationSubscription } from "./limits";
const PAYSTACK_ERROR_CODES = defineErrorCodes({
    SUBSCRIPTION_NOT_FOUND: "Subscription not found",
    SUBSCRIPTION_PLAN_NOT_FOUND: "Subscription plan not found",
    UNABLE_TO_CREATE_CUSTOMER: "Unable to create customer",
    FAILED_TO_INITIALIZE_TRANSACTION: "Failed to initialize transaction",
    FAILED_TO_VERIFY_TRANSACTION: "Failed to verify transaction",
    FAILED_TO_DISABLE_SUBSCRIPTION: "Failed to disable subscription",
    FAILED_TO_ENABLE_SUBSCRIPTION: "Failed to enable subscription",
    EMAIL_VERIFICATION_REQUIRED: "Email verification is required before you can subscribe to a plan",
});
async function hmacSha512Hex(secret, message) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const msgData = encoder.encode(message);
    const crypto = globalThis.crypto;
    if (crypto !== undefined && crypto !== null && "subtle" in crypto) {
        const subtle = crypto.subtle;
        const key = await subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
        const signature = await subtle.sign("HMAC", key, msgData);
        return Array.from(new Uint8Array(signature))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    }
    const { createHmac } = await import("node:crypto");
    return createHmac("sha512", secret).update(message).digest("hex");
}
export const paystackWebhook = (options) => {
    return createAuthEndpoint("/paystack/webhook", {
        method: "POST",
        metadata: {
            ...HIDE_METADATA,
            openapi: {
                operationId: "handlePaystackWebhook",
            },
        },
        cloneRequest: true,
        disableBody: true,
    }, async (ctx) => {
        const request = ctx.requestClone ?? ctx.request;
        if (request === undefined || request === null) {
            throw new APIError("BAD_REQUEST", {
                message: "Request object is missing from context",
            });
        }
        const payload = await request.text();
        const headers = ctx.headers ?? ctx.request?.headers;
        const signature = headers?.get("x-paystack-signature");
        if (signature === undefined || signature === null || signature === "") {
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
        const event = JSON.parse(payload);
        const eventName = event.event;
        const data = event.data;
        // Core Transaction Status Sync (Applies to both one-time and recurring)
        if (eventName === "charge.success") {
            const reference = data?.reference;
            const paystackId = data?.id !== undefined && data?.id !== null ? String((data).id) : undefined;
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
                }
                catch (e) {
                    // Transaction record might not exist yet (e.g. webhook arrives before local record)
                    ctx.context.logger.warn("Failed to update transaction status for charge.success", e);
                }
                // Sync product quantity from Paystack after successful charge
                try {
                    const transaction = await ctx.context.adapter.findOne({
                        model: "paystackTransaction",
                        where: [{ field: "reference", value: reference }],
                    });
                    if (transaction?.product !== undefined && transaction.product !== null && transaction.product !== "") {
                        await syncProductQuantityFromPaystack(ctx, transaction.product, options.paystackClient);
                    }
                }
                catch (e) {
                    ctx.context.logger.warn("Failed to sync product quantity", e);
                }
            }
        }
        if (eventName === "charge.failure") {
            const reference = data?.reference;
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
                }
                catch (e) {
                    ctx.context.logger.warn("Failed to update transaction status for charge.failure", e);
                }
            }
        }
        // Best-effort local state sync for subscription lifecycle.
        if (options.subscription?.enabled === true) {
            try {
                if (eventName === "subscription.create") {
                    const payloadData = data;
                    const subscriptionCode = payloadData?.subscription_code ??
                        payloadData?.subscription?.subscription_code ??
                        payloadData?.code;
                    const customerCode = payloadData?.customer?.customer_code ??
                        payloadData?.customer_code ??
                        payloadData?.customer?.code;
                    const planCode = payloadData?.plan?.plan_code ?? payloadData?.plan_code ?? payloadData?.plan;
                    let metadata = payloadData?.metadata;
                    if (typeof metadata === "string") {
                        try {
                            metadata = JSON.parse(metadata);
                        }
                        catch {
                            // ignore
                        }
                    }
                    const referenceIdFromMetadata = typeof metadata === "object" && metadata !== null
                        ? metadata.referenceId
                        : undefined;
                    let planNameFromMetadata = typeof metadata === "object" && metadata !== null
                        ? metadata.plan
                        : undefined;
                    if (typeof planNameFromMetadata === "string") {
                        planNameFromMetadata = planNameFromMetadata.toLowerCase();
                    }
                    const plans = await getPlans(options.subscription);
                    const planFromCode = (planCode !== undefined && planCode !== null && planCode !== "")
                        ? plans.find((p) => p.planCode !== undefined && p.planCode !== null && p.planCode === planCode)
                        : undefined;
                    const planPart = planFromCode?.name ?? planNameFromMetadata;
                    const planName = planPart !== undefined && planPart !== null && planPart !== "" ? planPart.toLowerCase() : undefined;
                    if (subscriptionCode !== undefined && subscriptionCode !== null && subscriptionCode !== "") {
                        const where = [];
                        if (referenceIdFromMetadata !== undefined && referenceIdFromMetadata !== null && referenceIdFromMetadata !== "") {
                            where.push({ field: "referenceId", value: referenceIdFromMetadata });
                        }
                        else if (customerCode !== undefined && customerCode !== null && customerCode !== "") {
                            where.push({ field: "paystackCustomerCode", value: customerCode });
                        }
                        if (planName !== undefined && planName !== null && planName !== "") {
                            where.push({ field: "plan", value: planName });
                        }
                        if (where.length > 0) {
                            const matches = await ctx.context.adapter.findMany({
                                model: "subscription",
                                where: where,
                            });
                            const subscription = matches?.[0];
                            if (subscription !== undefined && subscription !== null) {
                                await ctx.context.adapter.update({
                                    model: "subscription",
                                    update: {
                                        paystackSubscriptionCode: subscriptionCode,
                                        status: "active",
                                        updatedAt: new Date(),
                                        periodEnd: (payloadData?.next_payment_date !== undefined && payloadData.next_payment_date !== null && payloadData.next_payment_date !== "") ? new Date(payloadData.next_payment_date) : undefined,
                                    },
                                    where: [{ field: "id", value: subscription.id }],
                                });
                                const plan = planFromCode ?? (planName !== undefined && planName !== null && planName !== "" ? await getPlanByName(options, planName) : undefined);
                                if (plan !== undefined && plan !== null) {
                                    await options.subscription.onSubscriptionComplete?.({ event, subscription: { ...subscription, paystackSubscriptionCode: subscriptionCode, status: "active" }, plan }, ctx);
                                    // Also call onSubscriptionCreated for subscriptions created outside of checkout
                                    await options.subscription.onSubscriptionCreated?.({ event, subscription: { ...subscription, paystackSubscriptionCode: subscriptionCode, status: "active" }, plan }, ctx);
                                }
                            }
                        }
                    }
                }
                if (eventName === "subscription.disable" || eventName === "subscription.not_renew") {
                    const payloadData = data;
                    const subscriptionCode = payloadData?.subscription_code ??
                        payloadData?.subscription?.subscription_code ??
                        payloadData?.code;
                    if (subscriptionCode !== undefined && subscriptionCode !== null && subscriptionCode !== "") {
                        // Find the subscription first to get full data for the hook
                        const existing = await ctx.context.adapter.findOne({
                            model: "subscription",
                            where: [{ field: "paystackSubscriptionCode", value: subscriptionCode }],
                        });
                        let newStatus = "canceled";
                        const nextPaymentDate = data?.next_payment_date;
                        const periodEnd = (nextPaymentDate !== undefined && nextPaymentDate !== null && nextPaymentDate !== "") ? new Date(nextPaymentDate) : (existing?.periodEnd !== undefined ? new Date(existing.periodEnd) : undefined);
                        if (periodEnd !== undefined && periodEnd > new Date()) {
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
                            where: [
                                { field: "paystackSubscriptionCode", value: subscriptionCode },
                            ],
                        });
                        if (existing !== undefined && existing !== null) {
                            await options.subscription.onSubscriptionCancel?.({ event, subscription: { ...existing, status: "canceled" } }, ctx);
                        }
                    }
                }
                // Handle plan changes on renewal
                if (eventName === "charge.success" || eventName === "invoice.update") {
                    const payloadData = data;
                    const subscriptionCode = payloadData?.subscription?.subscription_code ?? payloadData?.subscription_code;
                    if (subscriptionCode !== undefined && subscriptionCode !== null && subscriptionCode !== "") {
                        const existingSub = await ctx.context.adapter.findOne({
                            model: "subscription",
                            where: [{ field: "paystackSubscriptionCode", value: subscriptionCode }],
                        });
                        if (existingSub?.pendingPlan !== undefined && existingSub.pendingPlan !== null && existingSub.pendingPlan !== "") {
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
            }
            catch (_e) {
                ctx.context.logger.error("Failed to sync Paystack webhook event", _e);
            }
        }
        await options.onEvent?.(event);
        return ctx.json({ received: true });
    });
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
export const initializeTransaction = (options, path = "/paystack/initialize-transaction") => {
    const subscriptionOptions = options.subscription;
    // However, for one-time payments, we might not strictly need subscription middleware
    // checking for existing subs, but let's keep it consistent for now.
    const useMiddlewares = subscriptionOptions?.enabled === true
        ? [sessionMiddleware, originCheck, referenceMiddleware(options, "initialize-transaction")]
        : [sessionMiddleware, originCheck];
    return createAuthEndpoint(path, {
        method: "POST",
        body: initializeTransactionBodySchema,
        use: useMiddlewares,
    }, async (ctx) => {
        const paystack = getPaystackOps(options.paystackClient);
        const { plan: planName, product: productName, amount: bodyAmount, currency, email, metadata: extraMetadata, callbackURL, quantity, scheduleAtPeriodEnd, cancelAtPeriodEnd, prorateAndCharge } = ctx.body;
        // 1. Validate Callback URL validation (same as before)
        if (callbackURL !== undefined && callbackURL !== null && callbackURL !== "") {
            const checkTrusted = () => {
                try {
                    if (callbackURL === undefined || callbackURL === null || callbackURL === "")
                        return false;
                    if (callbackURL.startsWith("/"))
                        return true;
                    const baseUrl = ctx.context?.baseURL ??
                        (ctx.request?.url) ??
                        "";
                    if (!baseUrl)
                        return false;
                    const baseOrigin = new URL(baseUrl).origin;
                    return new URL(callbackURL).origin === baseOrigin;
                }
                catch {
                    return false;
                }
            };
            if (checkTrusted() !== true) {
                throw new APIError("FORBIDDEN", {
                    message: "callbackURL is not a trusted origin.",
                    status: 403,
                });
            }
        }
        // 2. Get User & Session
        const session = await getSessionFromCtx(ctx);
        if (!session)
            throw new APIError("UNAUTHORIZED");
        const user = session.user;
        // 3. Email Verification Check (only if subscription options enforce it)
        if (subscriptionOptions?.enabled === true && subscriptionOptions.requireEmailVerification === true && user.emailVerified !== true) {
            throw new APIError("BAD_REQUEST", {
                code: "EMAIL_VERIFICATION_REQUIRED",
                message: PAYSTACK_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED.message,
            });
        }
        // 4. Determine Payment Mode: Subscription (Plan) vs Product vs One-Time (Amount)
        let plan;
        let product;
        if (planName !== undefined && planName !== null && planName !== "") {
            if (subscriptionOptions?.enabled !== true) {
                throw new APIError("BAD_REQUEST", { message: "Subscriptions are not enabled." });
            }
            plan = await getPlanByName(options, planName) ?? undefined;
            if (plan === null || plan === undefined) {
                // Fallback: Check database for synced plans
                const nativePlan = await ctx.context.adapter.findOne({
                    model: "paystackPlan",
                    where: [{ field: "name", value: planName }],
                });
                if (nativePlan !== undefined && nativePlan !== null) {
                    plan = nativePlan;
                }
                else {
                    // Try checking by planCode as well
                    const nativePlanByCode = await ctx.context.adapter.findOne({
                        model: "paystackPlan",
                        where: [{ field: "planCode", value: planName }],
                    });
                    plan = nativePlanByCode ?? undefined;
                }
            }
            if (plan === null || plan === undefined) {
                throw new APIError("BAD_REQUEST", {
                    code: "SUBSCRIPTION_PLAN_NOT_FOUND",
                    message: PAYSTACK_ERROR_CODES.SUBSCRIPTION_PLAN_NOT_FOUND.message,
                    status: 400
                });
            }
        }
        else if (productName !== undefined && productName !== null && productName !== "") {
            if (typeof productName === 'string') {
                product ??= await getProductByName(options, productName) ?? undefined;
                // Fallback: Check database for synced products
                product ??= (await ctx.context.adapter.findOne({
                    model: "paystackProduct",
                    where: [{ field: "name", value: productName }],
                })) ?? undefined;
            }
            if (product === null || product === undefined) {
                throw new APIError("BAD_REQUEST", {
                    message: `Product '${productName}' not found.`,
                    status: 400
                });
            }
        }
        else if (bodyAmount === undefined || bodyAmount === null || bodyAmount === 0) {
            throw new APIError("BAD_REQUEST", {
                message: "Either 'plan', 'product', or 'amount' is required to initialize a transaction.",
                status: 400
            });
        }
        let amount = bodyAmount ?? (product)?.price;
        const finalCurrency = currency ?? (product)?.currency ?? plan?.currency ?? "NGN";
        const referenceIdFromCtx = ctx.context.referenceId;
        const referenceId = (ctx.body.referenceId !== undefined && ctx.body.referenceId !== null && ctx.body.referenceId !== "")
            ? ctx.body.referenceId
            : (referenceIdFromCtx !== undefined && referenceIdFromCtx !== null && referenceIdFromCtx !== "")
                ? referenceIdFromCtx
                : session.user.id;
        // Handle scheduleAtPeriodEnd for existing subscriptions
        if (plan && scheduleAtPeriodEnd === true) {
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
        // Calculate final amount considering seats if applicable
        if (plan !== null && plan !== undefined && (plan.seatAmount !== undefined || 'seatPriceId' in plan)) {
            const members = await ctx.context.adapter.findMany({
                model: "member",
                where: [{ field: "organizationId", value: referenceId }],
            });
            const seatCount = members.length > 0 ? members.length : 1;
            const quantityToUse = quantity ?? seatCount;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            amount = (plan.amount ?? 0) + (quantityToUse * (plan.seatAmount ?? plan.seatPriceId ?? 0));
        }
        let url;
        let reference;
        let accessCode;
        // Check trial eligibility - prevent trial abuse
        let trialStart;
        let trialEnd;
        if (plan?.freeTrial?.days !== undefined && plan.freeTrial.days !== null && plan.freeTrial.days > 0) {
            // Check if user/referenceId has ever had a trial
            const previousTrials = await ctx.context.adapter.findMany({
                model: "subscription",
                where: [{ field: "referenceId", value: referenceId }],
            });
            const hadTrial = previousTrials?.some((sub) => (sub.trialStart !== undefined && sub.trialStart !== null) || (sub.trialEnd !== undefined && sub.trialEnd !== null) || sub.status === "trialing");
            if (hadTrial !== true) {
                trialStart = new Date();
                trialEnd = new Date();
                trialEnd.setDate(trialEnd.getDate() + plan.freeTrial.days);
            }
        }
        try {
            // Determine Customer Email & Code (Organization support)
            let targetEmail = (email !== undefined && email !== null && email !== "") ? email : user.email;
            let paystackCustomerCode = user.paystackCustomerCode;
            if (options.organization?.enabled === true && referenceId !== undefined && referenceId !== null && referenceId !== "" && referenceId !== user.id) {
                const org = await ctx.context.adapter.findOne({
                    model: "organization",
                    where: [{ field: "id", value: referenceId }],
                });
                if (org !== undefined && org !== null) {
                    // Prefer organization's existing Paystack customer code
                    if (org.paystackCustomerCode !== undefined && org.paystackCustomerCode !== null && org.paystackCustomerCode !== "") {
                        paystackCustomerCode = org.paystackCustomerCode;
                    }
                    if (org.email !== undefined && org.email !== null && org.email !== "") {
                        targetEmail = org.email;
                    }
                    else {
                        // Fallback: Use Organization Owner Email
                        const ownerMember = await ctx.context.adapter.findOne({
                            model: "member",
                            where: [
                                { field: "organizationId", value: referenceId },
                                { field: "role", value: "owner" }
                            ]
                        });
                        if (ownerMember !== undefined && ownerMember !== null) {
                            const ownerUser = await ctx.context.adapter.findOne({
                                model: "user",
                                where: [{ field: "id", value: ownerMember.userId }]
                            });
                            if (ownerUser?.email !== undefined && ownerUser?.email !== null && ownerUser?.email !== "") {
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
                isTrial: trialStart !== undefined && trialStart !== null,
                trialEnd: trialEnd?.toISOString(),
                ...extraMetadata,
            });
            const initBody = {
                email: targetEmail,
                callback_url: callbackURL,
                metadata,
                // If plan/product exists, use its currency; otherwise fallback to provided or default
                currency: finalCurrency,
                quantity,
            };
            // Sync/Update Customer: ensure email matches if code exists
            if (paystackCustomerCode !== undefined && paystackCustomerCode !== null && paystackCustomerCode !== "") {
                try {
                    const ops = getPaystackOps(options.paystackClient);
                    // Only update if email is present
                    if (initBody.email !== undefined && initBody.email !== null && initBody.email !== "") {
                        await ops.customerUpdate(paystackCustomerCode, { email: initBody.email });
                    }
                }
                catch (_e) {
                    // Ignore sync errors
                }
            }
            // Handle prorateAndCharge for existing active subscriptions
            if (plan !== undefined && plan !== null && prorateAndCharge === true) {
                const existingSub = await getOrganizationSubscription(ctx, referenceId);
                if (existingSub?.status === "active" && existingSub.paystackAuthorizationCode !== null && existingSub.paystackAuthorizationCode !== undefined && existingSub.paystackSubscriptionCode !== null && existingSub.paystackSubscriptionCode !== undefined) {
                    // 1. Calculate remaining days
                    const now = new Date();
                    const periodEndLocal = existingSub.periodEnd ? new Date(existingSub.periodEnd) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // fallback 30 days
                    const periodStartLocal = existingSub.periodStart ? new Date(existingSub.periodStart) : now;
                    const totalDays = Math.max(1, Math.ceil((periodEndLocal.getTime() - periodStartLocal.getTime()) / (1000 * 60 * 60 * 24)));
                    const remainingDays = Math.max(0, Math.ceil((periodEndLocal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                    // 2. Fetch old plan/amount
                    let oldAmount = 0;
                    if (existingSub.plan !== undefined && existingSub.plan !== null && existingSub.plan !== "") {
                        const oldPlan = (await getPlanByName(options, existingSub.plan)) ?? (await ctx.context.adapter.findOne({ model: "paystackPlan", where: [{ field: "name", value: existingSub.plan }] }));
                        if (oldPlan !== null && oldPlan !== undefined) {
                            const oldSeatCount = existingSub.seats ?? 1;
                            oldAmount = (oldPlan.amount ?? 0) + (oldSeatCount * (oldPlan.seatAmount ?? oldPlan.seatPriceId ?? 0));
                        }
                    }
                    // 3. Calculate new total amount
                    let membersCount = 1;
                    if (plan.seatAmount !== undefined || plan.seatPriceId !== undefined) {
                        const members = await ctx.context.adapter.findMany({
                            model: "member",
                            where: [{ field: "organizationId", value: referenceId }],
                        });
                        membersCount = members.length > 0 ? members.length : 1;
                    }
                    const newSeatCount = quantity ?? existingSub.seats ?? membersCount;
                    const newAmount = (plan.amount ?? 0) + (newSeatCount * (plan.seatAmount ?? plan.seatPriceId ?? 0));
                    // 4. Calculate Difference & Charge
                    const costDifference = newAmount - oldAmount;
                    if (costDifference > 0 && remainingDays > 0) {
                        const proratedAmount = Math.round((costDifference / totalDays) * remainingDays);
                        // Ensure minimum Paystack charge limit is met (50 NGN -> 5000)
                        if (proratedAmount >= 5000) {
                            const ops = getPaystackOps(options.paystackClient);
                            const chargeResRaw = await ops.transactionChargeAuthorization({
                                email: targetEmail,
                                amount: proratedAmount,
                                authorization_code: existingSub.paystackAuthorizationCode,
                                reference: `prorate_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                                metadata: {
                                    type: "proration",
                                    referenceId,
                                    newPlan: plan.name,
                                    oldPlan: existingSub.plan,
                                    remainingDays,
                                },
                            });
                            const sdkRes = unwrapSdkResult(chargeResRaw);
                            const actualStatus = sdkRes?.status;
                            if (actualStatus !== "success") {
                                throw new APIError("BAD_REQUEST", { message: "Failed to process prorated charge via saved authorization." });
                            }
                        }
                    }
                    // 5. Update Subscription Future Cycle in Paystack
                    const ops = getPaystackOps(options.paystackClient);
                    await ops.subscriptionUpdate({
                        code: existingSub.paystackSubscriptionCode,
                        amount: newAmount,
                        plan: plan.planCode,
                    });
                    // 6. Update Local DB
                    await ctx.context.adapter.update({
                        model: "subscription",
                        where: [{ field: "id", value: existingSub.id }],
                        update: {
                            plan: plan.name,
                            seats: newSeatCount,
                            updatedAt: new Date(),
                        },
                    });
                    return ctx.json({
                        status: "success",
                        message: "Subscription successfully upgraded with prorated charge.",
                        prorated: true,
                    });
                }
            }
            if (plan !== undefined && plan !== null) {
                // Subscription Flow
                if (trialStart !== undefined && trialStart !== null) {
                    // Trial Flow: Authorize card with minimum amount, don't start sub yet
                    initBody.amount = 5000; // 50 NGN (minimum allowed)
                    // Do NOT set initBody.plan
                }
                else {
                    // Standard Flow
                    initBody.plan = plan.planCode;
                    initBody.invoice_limit = plan.invoiceLimit;
                    // Paystack requires amount even with planCode (it uses plan's stored amount)
                    // For local plans without planCode, use finalAmount; for planCode plans, use plan.amount or override
                    let finalAmount;
                    if (amount !== undefined && amount !== null) {
                        // amount was calculated via seat-based logic or provided as override
                        finalAmount = amount;
                        // We force quantity to 1 in the Paystack call because our amount already includes the quantity multiplier
                        initBody.quantity = 1;
                    }
                    else {
                        // Standard Flow: Plan Price * Quantity
                        finalAmount = (plan.amount ?? 0) * (quantity ?? 1);
                    }
                    initBody.amount = Math.max(Math.round(finalAmount), 5000);
                }
            }
            else {
                // One-Time Payment Flow
                if (amount === undefined || amount === null || amount === 0)
                    throw new APIError("BAD_REQUEST", { message: "Amount is required for one-time payments" });
                initBody.amount = Math.round(amount);
            }
            const initRaw = await paystack.transactionInitialize(initBody);
            const sdkRes = unwrapSdkResult(initRaw);
            url = sdkRes?.authorization_url ?? sdkRes?.data?.authorization_url;
            reference = sdkRes?.reference ?? sdkRes?.data?.reference;
            accessCode = sdkRes?.access_code ?? sdkRes?.data?.access_code;
        }
        catch (error) {
            ctx.context.logger.error("Failed to initialize Paystack transaction", error);
            throw new APIError("BAD_REQUEST", {
                code: "FAILED_TO_INITIALIZE_TRANSACTION",
                message: error?.message ?? PAYSTACK_ERROR_CODES.FAILED_TO_INITIALIZE_TRANSACTION.message,
            });
        }
        // 6. Record Transaction & Subscription
        await ctx.context.adapter.create({
            model: "paystackTransaction",
            data: {
                reference: reference,
                referenceId,
                userId: user.id,
                amount: amount ?? 0,
                currency: plan?.currency ?? currency ?? "NGN",
                status: "pending",
                plan: plan?.name.toLowerCase(),
                product: product?.name.toLowerCase(),
                metadata: (extraMetadata !== undefined && extraMetadata !== null && Object.keys(extraMetadata).length > 0) ? JSON.stringify(extraMetadata) : undefined,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
        if (plan !== undefined && plan !== null) {
            // Re-fetch customer code if it wasn't available before (though we didn't force-create it here)
            // For now, use what we have (user's or org's)
            let storedCustomerCode = user.paystackCustomerCode;
            if (options.organization?.enabled === true && referenceId !== user.id) {
                const org = await ctx.context.adapter.findOne({
                    model: "organization",
                    where: [{ field: "id", value: referenceId }],
                });
                if (org?.paystackCustomerCode !== undefined && org.paystackCustomerCode !== null && org.paystackCustomerCode !== "") {
                    storedCustomerCode = org.paystackCustomerCode;
                }
            }
            const newSubscription = await ctx.context.adapter.create({
                model: "subscription",
                data: {
                    plan: plan.name.toLowerCase(),
                    referenceId,
                    paystackCustomerCode: storedCustomerCode,
                    paystackTransactionReference: reference,
                    status: (trialStart !== undefined && trialStart !== null) ? "trialing" : "incomplete",
                    seats: quantity,
                    trialStart,
                    trialEnd,
                },
            });
            // Call trial start hook if trial was granted
            if ((trialStart !== undefined && trialStart !== null) && newSubscription !== null && plan.freeTrial?.onTrialStart !== undefined && plan.freeTrial?.onTrialStart !== null) {
                await plan.freeTrial.onTrialStart(newSubscription);
            }
        }
        return ctx.json({
            url,
            reference,
            accessCode,
            redirect: true,
        });
    });
};
// Aliases for Client DX Parity
export const createSubscription = (options) => initializeTransaction(options, "/paystack/create-subscription");
export const upgradeSubscription = (options) => initializeTransaction(options, "/paystack/upgrade-subscription");
export const restoreSubscription = (options) => {
    // Alias for enable
    return enablePaystackSubscription(options, "/paystack/restore-subscription");
};
export const cancelSubscription = (options) => {
    // Alias for disable
    return disablePaystackSubscription(options, "/paystack/cancel-subscription");
};
export const verifyTransaction = (options, path = "/paystack/verify-transaction") => {
    const verifyBodySchema = z.object({
        reference: z.string(),
    });
    const subscriptionOptions = options.subscription;
    const useMiddlewares = subscriptionOptions?.enabled === true
        ? [sessionMiddleware, originCheck, referenceMiddleware(options, "verify-transaction")]
        : [sessionMiddleware, originCheck];
    return createAuthEndpoint(path, {
        method: "POST",
        body: verifyBodySchema,
        use: useMiddlewares,
    }, async (ctx) => {
        const paystack = getPaystackOps(options.paystackClient);
        let verifyRes;
        try {
            const verifyRaw = await paystack.transactionVerify(ctx.body.reference);
            verifyRes = unwrapSdkResult(verifyRaw);
        }
        catch (error) {
            ctx.context.logger.error("Failed to verify Paystack transaction", error);
            throw new APIError("BAD_REQUEST", {
                code: "FAILED_TO_VERIFY_TRANSACTION",
                message: error?.message ?? PAYSTACK_ERROR_CODES.FAILED_TO_VERIFY_TRANSACTION.message,
            });
        }
        const dataRaw = unwrapSdkResult(verifyRes);
        const data = dataRaw?.data ?? dataRaw;
        const status = data?.status;
        const reference = data?.reference ?? ctx.body.reference;
        const paystackId = data?.id !== undefined && data?.id !== null ? String(data.id) : undefined;
        const authorizationCode = (data?.authorization)?.authorization_code;
        if (status === "success") {
            const session = await getSessionFromCtx(ctx);
            // Get the local transaction record to know the intended referenceId (Org or User)
            const txRecord = await ctx.context.adapter.findOne({
                model: "paystackTransaction",
                where: [{ field: "reference", value: reference }],
            });
            // Trust the referenceId from the record, fallback to session user if missing
            const referenceId = txRecord?.referenceId ?? session?.user?.id;
            // Authorization check: ensure the current user has access to this referenceId
            if (session !== null && session !== undefined && referenceId !== session.user.id) {
                const authRef = subscriptionOptions?.authorizeReference;
                let authorized = false;
                if (authRef !== undefined) {
                    authorized = await authRef({
                        user: session.user,
                        session,
                        referenceId,
                        action: "verify-transaction",
                    }, ctx);
                }
                if (authorized !== true) {
                    if (options.organization?.enabled === true) {
                        const member = await ctx.context.adapter.findOne({
                            model: "member",
                            where: [
                                { field: "userId", value: session.user.id },
                                { field: "organizationId", value: referenceId }
                            ]
                        });
                        if (member !== undefined && member !== null)
                            authorized = true;
                    }
                }
                if (!authorized) {
                    throw new APIError("UNAUTHORIZED");
                }
            }
            try {
                await ctx.context.adapter.update({
                    model: "paystackTransaction",
                    update: {
                        status: "success",
                        paystackId,
                        // Update with actual amount/currency from Paystack (for planCode subscriptions)
                        ...(data?.amount !== undefined && data?.amount !== null ? { amount: data.amount } : {}),
                        ...(data?.currency !== undefined && data?.currency !== null && data?.currency !== "" ? { currency: data.currency } : {}),
                        updatedAt: new Date(),
                    },
                    where: [{ field: "reference", value: reference }],
                });
                const customer = data?.customer;
                const paystackCustomerCodeFromPaystack = (customer !== undefined && customer !== null && typeof customer === "object")
                    ? customer.customer_code
                    : undefined;
                if (paystackCustomerCodeFromPaystack !== undefined && paystackCustomerCodeFromPaystack !== null && paystackCustomerCodeFromPaystack !== "" && referenceId !== undefined && referenceId !== null && referenceId !== "") {
                    let isOrg = (options.organization?.enabled === true && typeof referenceId === "string" && referenceId.startsWith("org_"));
                    if (!isOrg && options.organization?.enabled === true) {
                        const org = (await ctx.context.adapter.findOne({
                            model: "organization",
                            where: [{ field: "id", value: referenceId }],
                        }));
                        isOrg = org !== null && org !== undefined;
                    }
                    if (isOrg === true) {
                        await ctx.context.adapter.update({
                            model: "organization",
                            update: { paystackCustomerCode: paystackCustomerCodeFromPaystack },
                            where: [{ field: "id", value: referenceId }],
                        });
                    }
                    else {
                        await ctx.context.adapter.update({
                            model: "user",
                            update: { paystackCustomerCode: paystackCustomerCodeFromPaystack },
                            where: [{ field: "id", value: referenceId }],
                        });
                    }
                }
                // Decrement product quantity if applicable
                const transaction = await ctx.context.adapter.findOne({
                    model: "paystackTransaction",
                    where: [{ field: "reference", value: reference }],
                });
                if (transaction?.product !== undefined && transaction?.product !== null && transaction?.product !== "") {
                    await syncProductQuantityFromPaystack(ctx, transaction.product, options.paystackClient);
                }
                // Check for trial activation
                let isTrial = false;
                let trialEnd;
                let targetPlan;
                if (data?.metadata !== undefined && data?.metadata !== null) {
                    const metaRaw = data.metadata;
                    const meta = typeof metaRaw === "string" ? JSON.parse(metaRaw) : metaRaw;
                    isTrial = meta.isTrial === true || meta.isTrial === "true";
                    trialEnd = meta.trialEnd;
                    targetPlan = meta.plan;
                }
                let paystackSubscriptionCode;
                if (isTrial === true && (targetPlan !== undefined && targetPlan !== null && targetPlan !== "") && (trialEnd !== undefined && trialEnd !== null && trialEnd !== "")) {
                    // Trial Flow: Create subscription with future start date using auth code
                    const email = data.customer?.email;
                    // We need the planCode. We have the plan NAME in metadata (lowercased).
                    const plans = await getPlans(subscriptionOptions);
                    const planConfig = plans.find(p => p.name.toLowerCase() === targetPlan?.toLowerCase());
                    // For local plans (no planCode), generate a local subscription code
                    if (planConfig !== undefined && planConfig !== null && (planConfig.planCode === undefined || planConfig.planCode === null || planConfig.planCode === "")) {
                        paystackSubscriptionCode = `LOC_${reference}`;
                    }
                    if (authorizationCode !== undefined && authorizationCode !== null && authorizationCode !== "" && email !== undefined && email !== null && email !== "" && planConfig?.planCode !== undefined && planConfig.planCode !== null && planConfig.planCode !== "") {
                        const subResRaw = await paystack.subscriptionCreate({
                            customer: email,
                            plan: planConfig.planCode,
                            authorization: authorizationCode,
                            start_date: trialEnd
                        });
                        const subRes = unwrapSdkResult(subResRaw);
                        const cleanSubData = subRes?.data ?? subRes;
                        paystackSubscriptionCode = cleanSubData?.subscription_code;
                    }
                }
                else if (isTrial !== true) {
                    const planFromPaystack = data?.plan;
                    const planCodeFromPaystack = planFromPaystack?.plan_code;
                    if (planCodeFromPaystack === undefined || planCodeFromPaystack === null || planCodeFromPaystack === "") {
                        // Local Plan
                        paystackSubscriptionCode = `LOC_${reference}`;
                    }
                    else {
                        // Native Paystack subscription (if created during charge)
                        paystackSubscriptionCode = (data?.subscription)?.subscription_code;
                    }
                }
                const existingSubs = await ctx.context.adapter.findMany({
                    model: "subscription",
                    where: [{ field: "paystackTransactionReference", value: reference }],
                });
                let targetSub;
                if (existingSubs !== null && existingSubs !== undefined && existingSubs.length > 0) {
                    targetSub = existingSubs.find((s) => (referenceId === undefined || referenceId === null || referenceId === "") || s.referenceId === referenceId);
                }
                let updatedSubscription = null;
                if (targetSub !== undefined && targetSub !== null) {
                    updatedSubscription = await ctx.context.adapter.update({
                        model: "subscription",
                        update: {
                            status: isTrial ? "trialing" : "active",
                            periodStart: new Date(),
                            updatedAt: new Date(),
                            ...(isTrial === true && trialEnd !== undefined && trialEnd !== null ? {
                                trialStart: new Date(),
                                trialEnd: new Date(trialEnd),
                                periodEnd: new Date(trialEnd),
                            } : {}),
                            ...(paystackSubscriptionCode !== undefined && paystackSubscriptionCode !== null && paystackSubscriptionCode !== "" ? { paystackSubscriptionCode } : {}),
                            ...(authorizationCode !== undefined && authorizationCode !== null && authorizationCode !== "" ? { paystackAuthorizationCode: authorizationCode } : {}),
                        },
                        where: [{ field: "id", value: targetSub.id }],
                    });
                }
                if (updatedSubscription && subscriptionOptions?.enabled === true && "onSubscriptionComplete" in subscriptionOptions && typeof subscriptionOptions.onSubscriptionComplete === "function") {
                    const subOpts = subscriptionOptions;
                    const plans = await getPlans(subOpts);
                    const plan = plans.find(p => p.name.toLowerCase() === updatedSubscription.plan.toLowerCase());
                    if (plan) {
                        await subscriptionOptions.onSubscriptionComplete({
                            event: data,
                            subscription: updatedSubscription,
                            plan
                        }, ctx);
                    }
                }
            }
            catch (e) {
                ctx.context.logger.error("Failed to update transaction/subscription after verification", e);
            }
        }
        return ctx.json({
            status,
            reference,
            data,
        });
    });
};
export const listSubscriptions = (options) => {
    const listQuerySchema = z.object({
        referenceId: z.string().optional(),
    });
    const subscriptionOptions = options.subscription;
    const useMiddlewares = subscriptionOptions?.enabled === true
        ? [sessionMiddleware, originCheck, referenceMiddleware(options, "list-subscriptions")]
        : [sessionMiddleware, originCheck];
    return createAuthEndpoint("/paystack/list-subscriptions", {
        method: "GET",
        query: listQuerySchema,
        use: useMiddlewares,
    }, async (ctx) => {
        if (subscriptionOptions?.enabled !== true) {
            throw new APIError("BAD_REQUEST", {
                message: "Subscriptions are not enabled in the Paystack options.",
            });
        }
        const session = await getSessionFromCtx(ctx);
        if (!session)
            throw new APIError("UNAUTHORIZED");
        const referenceIdPart = ctx.context.referenceId;
        const queryRefId = ctx.query?.referenceId;
        const referenceId = referenceIdPart ?? queryRefId ?? session.user.id;
        const res = await ctx.context.adapter.findMany({
            model: "subscription",
            where: [{ field: "referenceId", value: referenceId }],
        });
        return ctx.json({ subscriptions: res });
    });
};
export const listTransactions = (options, path = "/paystack/list-transactions") => {
    const listQuerySchema = z.object({
        referenceId: z.string().optional(),
    });
    const subscriptionOptions = options.subscription;
    const useMiddlewares = subscriptionOptions?.enabled === true
        ? [sessionMiddleware, originCheck, referenceMiddleware(options, "list-transactions")]
        : [sessionMiddleware, originCheck];
    return createAuthEndpoint(path, {
        method: "GET",
        query: listQuerySchema,
        use: useMiddlewares,
    }, async (ctx) => {
        const session = await getSessionFromCtx(ctx);
        if (!session)
            throw new APIError("UNAUTHORIZED");
        const referenceId = ctx.context.referenceId ??
            (ctx.query?.referenceId) ??
            session.user.id;
        const res = await ctx.context.adapter.findMany({
            model: "paystackTransaction",
            where: [{ field: "referenceId", value: referenceId }],
        });
        // Sort by createdAt desc locally if adapter doesn't support it well,
        // but Better Auth adapters usually return in insertion order.
        // Let's sort to be sure.
        const sorted = res.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return ctx.json({ transactions: sorted });
    });
};
const enableDisableBodySchema = z.object({
    referenceId: z.string().optional(),
    subscriptionCode: z.string(),
    emailToken: z.string().optional(),
    atPeriodEnd: z.boolean().optional(),
});
function decodeBase64UrlToString(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "===".slice((normalized.length + 3) % 4);
    if (typeof globalThis.atob === "function") {
        return (globalThis.atob)(padded);
    }
    // eslint-disable-next-line no-restricted-globals
    return Buffer.from(padded, "base64").toString("utf8");
}
function tryGetEmailTokenFromSubscriptionManageLink(link) {
    try {
        const url = new URL(link);
        const subscriptionToken = url.searchParams.get("subscription_token");
        if (subscriptionToken === undefined || subscriptionToken === null || subscriptionToken === "")
            return undefined;
        const parts = subscriptionToken.split(".");
        if (parts.length < 2)
            return undefined;
        const payloadJson = decodeBase64UrlToString(parts[1]);
        const payload = JSON.parse(payloadJson);
        return typeof payload?.email_token === "string" ? payload.email_token : undefined;
    }
    catch {
        return undefined;
    }
}
export const disablePaystackSubscription = (options, path = "/paystack/disable-subscription") => {
    const subscriptionOptions = options.subscription;
    const useMiddlewares = subscriptionOptions?.enabled === true
        ? [sessionMiddleware, originCheck, referenceMiddleware(options, "disable-subscription")]
        : [sessionMiddleware, originCheck];
    return createAuthEndpoint(path, { method: "POST", body: enableDisableBodySchema, use: useMiddlewares }, async (ctx) => {
        const { subscriptionCode, atPeriodEnd } = ctx.body;
        const paystack = getPaystackOps(options.paystackClient);
        try {
            if (subscriptionCode.startsWith("LOC_")) {
                const sub = await ctx.context.adapter.findOne({
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
            let nextPaymentDate;
            // Always fetch subscription to get next_payment_date even if we have emailToken (unless passed? no, next_payment_date comes from paystack)
            // We need next_payment_date for cancelAtPeriodEnd logic
            try {
                const raw = await paystack.subscriptionFetch(subscriptionCode);
                const fetchRes = unwrapSdkResult(raw);
                const data = fetchRes?.data ?? fetchRes;
                if (emailToken === undefined || emailToken === null || emailToken === "") {
                    emailToken = data?.email_token;
                }
                nextPaymentDate = data?.next_payment_date;
            }
            catch {
                // ignore fetch failure? If we can't fetch, we might miss next_payment_date.
            }
            if (emailToken === undefined || emailToken === null || emailToken === "") {
                try {
                    const raw = await paystack.subscriptionManageLink(subscriptionCode);
                    const linkRes = unwrapSdkResult(raw);
                    const data = linkRes?.data ?? linkRes;
                    const link = typeof data === "string" ? data : data.link;
                    if (typeof link === "string" && link !== "") {
                        emailToken = tryGetEmailTokenFromSubscriptionManageLink(link);
                    }
                }
                catch {
                    // ignore
                }
            }
            if (emailToken === undefined || emailToken === null || emailToken === "") {
                throw new Error("Could not retrieve email_token for subscription disable.");
            }
            await paystack.subscriptionDisable({ code: subscriptionCode, token: emailToken });
            // Implement Cancel at Period End logic
            // Paystack "disable" stops future charges.
            // We keep status as "active" but set cancelAtPeriodEnd = true
            const periodEnd = (nextPaymentDate !== undefined && nextPaymentDate !== null && nextPaymentDate !== "") ? new Date(nextPaymentDate) : undefined;
            const sub = await ctx.context.adapter.findOne({
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
            }
            else {
                // This is unexpected if we are disabling a subscription that should exist
                ctx.context.logger.warn(`Could not find subscription with code ${subscriptionCode} to disable`);
            }
            return ctx.json({ status: "success" });
        }
        catch (error) {
            ctx.context.logger.error("Failed to disable subscription", error);
            throw new APIError("BAD_REQUEST", {
                code: "FAILED_TO_DISABLE_SUBSCRIPTION",
                message: error?.message ?? PAYSTACK_ERROR_CODES.FAILED_TO_DISABLE_SUBSCRIPTION.message,
            });
        }
    });
};
export const enablePaystackSubscription = (options, path = "/paystack/enable-subscription") => {
    const subscriptionOptions = options.subscription;
    const useMiddlewares = subscriptionOptions?.enabled === true
        ? [sessionMiddleware, originCheck, referenceMiddleware(options, "enable-subscription")]
        : [sessionMiddleware, originCheck];
    return createAuthEndpoint(path, { method: "POST", body: enableDisableBodySchema, use: useMiddlewares }, async (ctx) => {
        const { subscriptionCode } = ctx.body;
        const paystack = getPaystackOps(options.paystackClient);
        try {
            let emailToken = ctx.body.emailToken;
            if (emailToken === undefined || emailToken === null || emailToken === "") {
                try {
                    const raw = await paystack.subscriptionFetch(subscriptionCode);
                    const fetchRes = unwrapSdkResult(raw);
                    const data = fetchRes?.data ?? fetchRes;
                    emailToken = data?.email_token;
                }
                catch {
                    // ignore; try manage-link fallback below
                }
            }
            if (emailToken === undefined || emailToken === null || emailToken === "") {
                try {
                    const raw = await paystack.subscriptionManageLink(subscriptionCode);
                    const linkRes = unwrapSdkResult(raw);
                    const data = linkRes?.data ?? linkRes;
                    const link = typeof data === "string" ? data : data.link;
                    if (typeof link === "string" && link !== "") {
                        emailToken = tryGetEmailTokenFromSubscriptionManageLink(link);
                    }
                }
                catch {
                    // ignore
                }
            }
            if (emailToken === undefined || emailToken === null || emailToken === "") {
                throw new APIError("BAD_REQUEST", { message: "Could not retrieve email_token for subscription enable." });
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
        }
        catch (error) {
            ctx.context.logger.error("Failed to enable subscription", error);
            throw new APIError("BAD_REQUEST", {
                code: "FAILED_TO_ENABLE_SUBSCRIPTION",
                message: error?.message ?? PAYSTACK_ERROR_CODES.FAILED_TO_ENABLE_SUBSCRIPTION.message,
            });
        }
    });
};
export const getSubscriptionManageLink = (options, path = "/paystack/get-subscription-manage-link") => {
    const manageLinkQuerySchema = z.object({
        subscriptionCode: z.string(),
    });
    const subscriptionOptions = options.subscription;
    const useMiddlewares = subscriptionOptions?.enabled === true
        ? [sessionMiddleware, originCheck, referenceMiddleware(options, "get-subscription-manage-link")]
        : [sessionMiddleware, originCheck];
    const handler = async (ctx) => {
        const { subscriptionCode } = ctx.query;
        // If it's a local mock subscription, return null link instead of error
        if (subscriptionCode.startsWith("LOC_") || subscriptionCode.startsWith("sub_local_")) {
            return ctx.json({ link: null, message: "Local subscriptions cannot be managed on Paystack" });
        }
        const paystack = getPaystackOps(options.paystackClient);
        try {
            const raw = await paystack.subscriptionManageLink(subscriptionCode);
            const res = unwrapSdkResult(raw);
            const data = res?.data ?? res;
            const link = typeof data === "string" ? data : data.link;
            return ctx.json({ link: typeof link === "string" ? link : null });
        }
        catch (error) {
            ctx.context.logger.error("Failed to get subscription manage link", error);
            throw new APIError("BAD_REQUEST", {
                message: error?.message ?? "Failed to get subscription manage link",
            });
        }
    };
    return createAuthEndpoint(path, {
        method: "GET",
        query: manageLinkQuerySchema,
        use: useMiddlewares,
    }, handler);
};
export const syncProducts = (options) => {
    return createAuthEndpoint("/paystack/sync-products", {
        method: "POST",
        metadata: {
            ...HIDE_METADATA,
        },
        disableBody: true,
        use: [sessionMiddleware],
    }, async (ctx) => {
        const paystack = getPaystackOps(options.paystackClient);
        try {
            const raw = await paystack.productList();
            const dataRaw = unwrapSdkResult(raw);
            // Standardise access to avoid any warnings
            const productsDataRaw = dataRaw?.data ?? dataRaw;
            if (!Array.isArray(productsDataRaw)) {
                return ctx.json({ products: [] });
            }
            const productsData = productsDataRaw;
            for (const productRaw of productsData) {
                const product = productRaw;
                const paystackId = String(product.id);
                const existing = await ctx.context.adapter.findOne({
                    model: "paystackProduct",
                    where: [{ field: "paystackId", value: paystackId }],
                });
                const productFields = {
                    name: typeof product.name === "string" ? product.name : "",
                    description: typeof product.description === "string" ? product.description : "",
                    price: typeof product.price === "number" ? product.price : 0,
                    currency: typeof product.currency === "string" ? product.currency : "",
                    quantity: typeof product.quantity === "number" ? product.quantity : 0,
                    unlimited: product.unlimited === true,
                    paystackId,
                    slug: (typeof product.slug === "string" && product.slug !== "") ? product.slug : (typeof product.name === "string" ? product.name.toLowerCase().replace(/\s+/g, "-") : ""),
                    metadata: (product.metadata !== undefined && product.metadata !== null) ? JSON.stringify(product.metadata) : undefined,
                    updatedAt: new Date(),
                };
                if (existing !== null && existing !== undefined) {
                    await ctx.context.adapter.update({
                        model: "paystackProduct",
                        update: productFields,
                        where: [{ field: "id", value: existing.id }],
                    });
                }
                else {
                    await ctx.context.adapter.create({
                        model: "paystackProduct",
                        data: {
                            ...productFields,
                            createdAt: new Date(),
                        },
                    });
                }
            }
            return ctx.json({ status: "success", count: productsData.length });
        }
        catch (error) {
            ctx.context.logger.error("Failed to sync products", error);
            throw new APIError("BAD_REQUEST", {
                message: error?.message ?? "Failed to sync products",
            });
        }
    });
};
export const listProducts = (_options) => {
    return createAuthEndpoint("/paystack/list-products", {
        method: "GET",
        metadata: {
            openapi: {
                operationId: "listPaystackProducts",
            },
        },
    }, async (ctx) => {
        const res = await ctx.context.adapter.findMany({
            model: "paystackProduct",
        });
        const sorted = res.sort((a, b) => a.name.localeCompare(b.name));
        return ctx.json({ products: sorted });
    });
};
export const syncPlans = (options) => {
    return createAuthEndpoint("/paystack/sync-plans", {
        method: "POST",
        metadata: {
            ...HIDE_METADATA,
        },
        disableBody: true,
        use: [sessionMiddleware],
    }, async (ctx) => {
        const paystack = getPaystackOps(options.paystackClient);
        try {
            const raw = await paystack.planList();
            const res = unwrapSdkResult(raw);
            const plansData = res?.data ?? res;
            if (!Array.isArray(plansData)) {
                return ctx.json({ status: "success", count: 0 });
            }
            for (const plan of plansData) {
                const paystackId = String(plan.id);
                const existing = await ctx.context.adapter.findOne({
                    model: "paystackPlan",
                    where: [{ field: "paystackId", value: paystackId }],
                });
                const planData = {
                    name: plan.name,
                    description: plan.description,
                    amount: plan.amount,
                    currency: plan.currency,
                    interval: plan.interval,
                    planCode: plan.plan_code,
                    paystackId,
                    metadata: (plan.metadata !== undefined && plan.metadata !== null) ? JSON.stringify(plan.metadata) : undefined,
                    updatedAt: new Date(),
                };
                if (existing !== undefined && existing !== null) {
                    await ctx.context.adapter.update({
                        model: "paystackPlan",
                        update: planData,
                        where: [{ field: "id", value: existing.id }],
                    });
                }
                else {
                    await ctx.context.adapter.create({
                        model: "paystackPlan",
                        data: {
                            ...planData,
                            createdAt: new Date(),
                        },
                    });
                }
            }
            return ctx.json({ status: "success", count: plansData.length });
        }
        catch (error) {
            ctx.context.logger.error("Failed to sync plans", error);
            throw new APIError("BAD_REQUEST", {
                message: error?.message ?? "Failed to sync plans",
            });
        }
    });
};
export const listPlans = (_options) => {
    return createAuthEndpoint("/paystack/list-plans", {
        method: "GET",
        metadata: {
            ...HIDE_METADATA,
        },
        use: [sessionMiddleware],
    }, async (ctx) => {
        try {
            const plans = await ctx.context.adapter.findMany({
                model: "paystackPlan",
            });
            return ctx.json({ plans });
        }
        catch (error) {
            ctx.context.logger.error("Failed to list plans", error);
            throw new APIError("BAD_REQUEST", {
                message: error?.message ?? "Failed to list plans",
            });
        }
    });
};
export const getConfig = (options) => {
    return createAuthEndpoint("/paystack/get-config", {
        method: "GET",
        metadata: {
            openapi: {
                operationId: "getPaystackConfig",
            },
        },
    }, async (ctx) => {
        const plans = options.subscription?.enabled === true
            ? await getPlans(options.subscription)
            : [];
        const products = await getProducts(options.products);
        return ctx.json({
            plans,
            products,
        });
    });
};
export { PAYSTACK_ERROR_CODES };
export const chargeRecurringSubscription = (options) => {
    return createAuthEndpoint("/paystack/charge-recurring", {
        method: "POST",
        body: z.object({
            subscriptionId: z.string(),
            amount: z.number().optional(),
        }),
    }, async (ctx) => {
        const { subscriptionId, amount: bodyAmount } = ctx.body;
        const subscription = await ctx.context.adapter.findOne({
            model: "subscription",
            where: [{ field: "id", value: subscriptionId }],
        });
        if (subscription === undefined || subscription === null) {
            throw new APIError("NOT_FOUND", { message: "Subscription not found" });
        }
        if (subscription.paystackAuthorizationCode === undefined || subscription.paystackAuthorizationCode === null || subscription.paystackAuthorizationCode === "") {
            throw new APIError("BAD_REQUEST", { message: "No authorization code found for this subscription" });
        }
        const plans = await getPlans(options.subscription);
        const plan = plans.find((p) => p.name.toLowerCase() === subscription.plan.toLowerCase());
        if (!plan) {
            throw new APIError("NOT_FOUND", { message: "Plan not found" });
        }
        const amount = bodyAmount ?? plan.amount;
        if (amount === undefined || amount === null) {
            throw new APIError("BAD_REQUEST", { message: "Plan amount is not defined" });
        }
        let email;
        if (subscription.referenceId !== undefined && subscription.referenceId !== null && subscription.referenceId !== "") {
            // Try to find user or org
            const user = await ctx.context.adapter.findOne({
                model: "user",
                where: [{ field: "id", value: subscription.referenceId }],
            });
            if (user !== undefined && user !== null) {
                email = user.email;
            }
            else if (options.organization?.enabled === true) {
                // Check org owner email if referenceId is organizationId
                const ownerMember = await ctx.context.adapter.findOne({
                    model: "member",
                    where: [
                        { field: "organizationId", value: subscription.referenceId },
                        { field: "role", value: "owner" },
                    ],
                });
                if (ownerMember !== undefined && ownerMember !== null) {
                    const ownerUser = await ctx.context.adapter.findOne({
                        model: "user",
                        where: [{ field: "id", value: ownerMember.userId }],
                    });
                    email = ownerUser?.email;
                }
            }
        }
        // No fallback needed since referenceId is required and handled above
        if (email === undefined || email === null || email === "") {
            throw new APIError("NOT_FOUND", { message: "User email not found" });
        }
        const finalCurrency = plan.currency ?? "NGN";
        if (!validateMinAmount(amount, finalCurrency)) {
            throw new APIError("BAD_REQUEST", {
                message: `Amount ${amount} is less than the minimum required for ${finalCurrency}.`,
                status: 400
            });
        }
        const paystack = getPaystackOps(options.paystackClient);
        const chargeResRaw = await paystack.transactionChargeAuthorization({
            email,
            amount,
            authorization_code: subscription.paystackAuthorizationCode,
            currency: plan.currency,
            metadata: {
                subscriptionId,
                referenceId: subscription.referenceId,
                plan: plan.name,
            },
        });
        const dataRaw = unwrapSdkResult(chargeResRaw);
        const chargeData = dataRaw?.data ?? dataRaw;
        if (chargeData?.status === "success" || dataRaw?.status === "success") {
            const now = new Date();
            const nextPeriodEnd = getNextPeriodEnd(now, plan.interval ?? "monthly");
            await ctx.context.adapter.update({
                model: "subscription",
                update: {
                    periodStart: now,
                    periodEnd: nextPeriodEnd,
                    updatedAt: now,
                    // Record the last transaction reference if available
                    paystackTransactionReference: chargeData?.reference ?? dataRaw?.reference,
                },
                where: [{ field: "id", value: subscription.id }],
            });
            return ctx.json({ status: "success", data: chargeData });
        }
        return ctx.json({ status: "failed", data: chargeData }, { status: 400 });
    });
};
