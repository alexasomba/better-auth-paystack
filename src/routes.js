import { createAuthEndpoint } from "@better-auth/core/api";
import { defineErrorCodes } from "@better-auth/core/utils";
import { HIDE_METADATA } from "better-auth";
import { APIError, getSessionFromCtx, originCheck, sessionMiddleware, } from "better-auth/api";
import * as z from "zod/v4";
import { getPlanByName, getPlans } from "./utils";
import { referenceMiddleware } from "./middleware";
import { getPaystackOps, unwrapSdkResult } from "./paystack-sdk";
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
    const subtle = globalThis.crypto?.subtle;
    if (subtle) {
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
        const payload = await request.text();
        const headers = ctx.headers ?? ctx.request?.headers;
        const signature = headers?.get("x-paystack-signature");
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
        const event = JSON.parse(payload);
        // Best-effort local state sync for subscription lifecycle.
        if (options.subscription?.enabled) {
            const eventName = String(event?.event ?? "");
            const data = event?.data;
            try {
                if (eventName === "subscription.create") {
                    const subscriptionCode = data?.subscription_code ??
                        data?.subscription?.subscription_code ??
                        data?.code;
                    const customerCode = data?.customer?.customer_code ??
                        data?.customer_code ??
                        data?.customer?.code;
                    const planCode = data?.plan?.plan_code ?? data?.plan_code ?? data?.plan;
                    let metadata = data?.metadata;
                    if (typeof metadata === "string") {
                        try {
                            metadata = JSON.parse(metadata);
                        }
                        catch {
                            // ignore
                        }
                    }
                    const referenceIdFromMetadata = typeof metadata === "object" && metadata
                        ? metadata.referenceId
                        : undefined;
                    let planNameFromMetadata = typeof metadata === "object" && metadata
                        ? metadata.plan
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
                        const where = [];
                        if (referenceIdFromMetadata) {
                            where.push({ field: "referenceId", value: referenceIdFromMetadata });
                        }
                        else if (customerCode) {
                            where.push({ field: "paystackCustomerCode", value: customerCode });
                        }
                        if (planName) {
                            where.push({ field: "plan", value: planName });
                        }
                        if (where.length > 0) {
                            const matches = await ctx.context.adapter.findMany({
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
                                    await options.subscription.onSubscriptionComplete?.({ event, subscription: { ...subscription, paystackSubscriptionCode: subscriptionCode, status: "active" }, plan }, ctx);
                                }
                            }
                        }
                    }
                }
                if (eventName === "subscription.disable" || eventName === "subscription.not_renew") {
                    const subscriptionCode = data?.subscription_code ??
                        data?.subscription?.subscription_code ??
                        data?.code;
                    if (subscriptionCode) {
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
                    }
                }
            }
            catch (e) {
                ctx.context.logger.error("Failed to sync Paystack webhook event", e);
            }
        }
        await options.onEvent?.(event);
        return ctx.json({ received: true });
    });
};
const initializeTransactionBodySchema = z.object({
    plan: z.string(),
    referenceId: z.string().optional(),
    callbackURL: z.string().optional(),
});
export const initializeTransaction = (options) => {
    const subscriptionOptions = options.subscription;
    const useMiddlewares = subscriptionOptions?.enabled
        ? [sessionMiddleware, originCheck, referenceMiddleware(subscriptionOptions, "initialize-transaction")]
        : [sessionMiddleware, originCheck];
    return createAuthEndpoint("/paystack/transaction/initialize", {
        method: "POST",
        body: initializeTransactionBodySchema,
        use: useMiddlewares,
    }, async (ctx) => {
        const paystack = getPaystackOps(options.paystackClient);
        if (!subscriptionOptions?.enabled) {
            throw new APIError("BAD_REQUEST", {
                message: "Subscriptions are not enabled in the Paystack options.",
            });
        }
        const session = await getSessionFromCtx(ctx);
        if (!session)
            throw new APIError("UNAUTHORIZED");
        const user = session.user;
        const referenceIdFromCtx = ctx.context.referenceId;
        const referenceId = ctx.body.referenceId || referenceIdFromCtx || session.user.id;
        if (subscriptionOptions.requireEmailVerification && !user.emailVerified) {
            throw new APIError("BAD_REQUEST", {
                code: PAYSTACK_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED,
                message: PAYSTACK_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED,
            });
        }
        const plan = await getPlanByName(options, ctx.body.plan);
        if (!plan) {
            throw new APIError("BAD_REQUEST", {
                code: PAYSTACK_ERROR_CODES.SUBSCRIPTION_PLAN_NOT_FOUND,
                message: PAYSTACK_ERROR_CODES.SUBSCRIPTION_PLAN_NOT_FOUND,
            });
        }
        if (!plan.planCode && !plan.amount) {
            throw new APIError("BAD_REQUEST", {
                message: "Paystack transaction initialization requires either plan.planCode (Paystack plan code) or plan.amount (smallest unit).",
            });
        }
        let url;
        let reference;
        let accessCode;
        try {
            const metadata = JSON.stringify({
                referenceId,
                userId: user.id,
                plan: plan.name.toLowerCase(),
            });
            const initBody = {
                email: user.email,
                callback_url: ctx.body.callbackURL,
                currency: plan.currency,
                plan: plan.planCode,
                invoice_limit: plan.invoiceLimit,
                metadata,
            };
            // Paystack docs: when `plan` is provided, it invalidates `amount`.
            if (!plan.planCode && plan.amount) {
                initBody.amount = String(plan.amount);
            }
            const initRaw = await paystack.transactionInitialize(initBody);
            const initRes = unwrapSdkResult(initRaw);
            const data = initRes && typeof initRes === "object" && "status" in initRes && "data" in initRes
                ? initRes.data
                : initRes?.data ?? initRes;
            url = data?.authorization_url;
            reference = data?.reference;
            accessCode = data?.access_code;
        }
        catch (error) {
            ctx.context.logger.error("Failed to initialize Paystack transaction", error);
            throw new APIError("BAD_REQUEST", {
                code: PAYSTACK_ERROR_CODES.FAILED_TO_INITIALIZE_TRANSACTION,
                message: error?.message || PAYSTACK_ERROR_CODES.FAILED_TO_INITIALIZE_TRANSACTION,
            });
        }
        const paystackCustomerCode = user.paystackCustomerCode;
        await ctx.context.adapter.create({
            model: "subscription",
            data: {
                plan: plan.name.toLowerCase(),
                referenceId,
                paystackCustomerCode,
                paystackTransactionReference: reference,
                status: "incomplete",
            },
        });
        return ctx.json({
            url,
            reference,
            accessCode,
            redirect: true,
        });
    });
};
export const verifyTransaction = (options) => {
    const verifyQuerySchema = z.object({
        reference: z.string(),
    });
    const subscriptionOptions = options.subscription;
    const useMiddlewares = subscriptionOptions?.enabled
        ? [sessionMiddleware, originCheck, referenceMiddleware(subscriptionOptions, "verify-transaction")]
        : [sessionMiddleware, originCheck];
    return createAuthEndpoint("/paystack/transaction/verify", {
        method: "GET",
        query: verifyQuerySchema,
        use: useMiddlewares,
    }, async (ctx) => {
        const paystack = getPaystackOps(options.paystackClient);
        let verifyRes;
        try {
            const verifyRaw = await paystack.transactionVerify(ctx.query.reference);
            verifyRes = unwrapSdkResult(verifyRaw);
        }
        catch (error) {
            ctx.context.logger.error("Failed to verify Paystack transaction", error);
            throw new APIError("BAD_REQUEST", {
                code: PAYSTACK_ERROR_CODES.FAILED_TO_VERIFY_TRANSACTION,
                message: error?.message || PAYSTACK_ERROR_CODES.FAILED_TO_VERIFY_TRANSACTION,
            });
        }
        const data = verifyRes && typeof verifyRes === "object" && "status" in verifyRes && "data" in verifyRes
            ? verifyRes.data
            : verifyRes?.data ?? verifyRes;
        const status = data?.status;
        const reference = data?.reference ?? ctx.query.reference;
        if (status === "success") {
            try {
                await ctx.context.adapter.update({
                    model: "subscription",
                    update: {
                        status: "active",
                        periodStart: new Date(),
                        updatedAt: new Date(),
                    },
                    where: [
                        {
                            field: "paystackTransactionReference",
                            value: reference,
                        },
                    ],
                });
            }
            catch (e) {
                ctx.context.logger.error("Failed to update subscription after transaction verification", e);
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
    const useMiddlewares = subscriptionOptions?.enabled
        ? [sessionMiddleware, originCheck, referenceMiddleware(subscriptionOptions, "list-subscriptions")]
        : [sessionMiddleware, originCheck];
    return createAuthEndpoint("/paystack/subscription/list-local", {
        method: "GET",
        query: listQuerySchema,
        use: useMiddlewares,
    }, async (ctx) => {
        if (!subscriptionOptions?.enabled) {
            throw new APIError("BAD_REQUEST", {
                message: "Subscriptions are not enabled in the Paystack options.",
            });
        }
        const session = await getSessionFromCtx(ctx);
        if (!session)
            throw new APIError("UNAUTHORIZED");
        const referenceId = ctx.context.referenceId ??
            ctx.query?.referenceId ??
            session.user.id;
        const res = await ctx.context.adapter.findMany({
            model: "subscription",
            where: [{ field: "referenceId", value: referenceId }],
        });
        return ctx.json({ subscriptions: res });
    });
};
const enableDisableBodySchema = z.object({
    subscriptionCode: z.string(),
    emailToken: z.string(),
});
export const disablePaystackSubscription = (options) => {
    const subscriptionOptions = options.subscription;
    const useMiddlewares = subscriptionOptions?.enabled
        ? [sessionMiddleware, originCheck, referenceMiddleware(subscriptionOptions, "disable-subscription")]
        : [sessionMiddleware, originCheck];
    return createAuthEndpoint("/paystack/subscription/disable", { method: "POST", body: enableDisableBodySchema, use: useMiddlewares }, async (ctx) => {
        const { subscriptionCode, emailToken } = ctx.body;
        const paystack = getPaystackOps(options.paystackClient);
        try {
            const raw = await paystack.subscriptionDisable({
                code: subscriptionCode,
                token: emailToken,
            });
            const result = unwrapSdkResult(raw);
            return ctx.json({ result });
        }
        catch (error) {
            ctx.context.logger.error("Failed to disable Paystack subscription", error);
            throw new APIError("BAD_REQUEST", {
                code: PAYSTACK_ERROR_CODES.FAILED_TO_DISABLE_SUBSCRIPTION,
                message: error?.message || PAYSTACK_ERROR_CODES.FAILED_TO_DISABLE_SUBSCRIPTION,
            });
        }
    });
};
export const enablePaystackSubscription = (options) => {
    const subscriptionOptions = options.subscription;
    const useMiddlewares = subscriptionOptions?.enabled
        ? [sessionMiddleware, originCheck, referenceMiddleware(subscriptionOptions, "enable-subscription")]
        : [sessionMiddleware, originCheck];
    return createAuthEndpoint("/paystack/subscription/enable", { method: "POST", body: enableDisableBodySchema, use: useMiddlewares }, async (ctx) => {
        const { subscriptionCode, emailToken } = ctx.body;
        const paystack = getPaystackOps(options.paystackClient);
        try {
            const raw = await paystack.subscriptionEnable({
                code: subscriptionCode,
                token: emailToken,
            });
            const result = unwrapSdkResult(raw);
            return ctx.json({ result });
        }
        catch (error) {
            ctx.context.logger.error("Failed to enable Paystack subscription", error);
            throw new APIError("BAD_REQUEST", {
                code: PAYSTACK_ERROR_CODES.FAILED_TO_ENABLE_SUBSCRIPTION,
                message: error?.message || PAYSTACK_ERROR_CODES.FAILED_TO_ENABLE_SUBSCRIPTION,
            });
        }
    });
};
export { PAYSTACK_ERROR_CODES };
