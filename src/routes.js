import { createAuthEndpoint } from "@better-auth/core/api";
import { defineErrorCodes } from "@better-auth/core/utils";
import { HIDE_METADATA } from "better-auth";
import { APIError, getSessionFromCtx, originCheck, sessionMiddleware, } from "better-auth/api";
import * as z from "zod/v4";
import { getPlanByName } from "./utils";
import { referenceMiddleware } from "./middleware";
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
    return createAuthEndpoint("/paystack/transaction/initialize", {
        method: "POST",
        body: initializeTransactionBodySchema,
        use: [sessionMiddleware, originCheck],
    }, async (ctx) => {
        const subscriptionOptions = options.subscription;
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
        if (!plan.amount) {
            throw new APIError("BAD_REQUEST", {
                message: "Paystack transaction initialization requires plan.amount (smallest unit).",
            });
        }
        let url;
        let reference;
        let accessCode;
        try {
            const initRes = await options.paystackClient?.transaction?.initialize?.({
                email: user.email,
                amount: plan.amount,
                currency: plan.currency,
                callback_url: ctx.body.callbackURL,
                metadata: {
                    referenceId,
                    userId: user.id,
                    plan: plan.name.toLowerCase(),
                },
            });
            const data = initRes?.data?.data ?? initRes?.data ?? initRes;
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
    return createAuthEndpoint("/paystack/transaction/verify", {
        method: "GET",
        query: verifyQuerySchema,
        use: [sessionMiddleware, originCheck],
    }, async (ctx) => {
        let verifyRes;
        try {
            verifyRes = await options.paystackClient?.transaction?.verify?.(ctx.query.reference);
        }
        catch (error) {
            ctx.context.logger.error("Failed to verify Paystack transaction", error);
            throw new APIError("BAD_REQUEST", {
                code: PAYSTACK_ERROR_CODES.FAILED_TO_VERIFY_TRANSACTION,
                message: error?.message || PAYSTACK_ERROR_CODES.FAILED_TO_VERIFY_TRANSACTION,
            });
        }
        const data = verifyRes?.data?.data ?? verifyRes?.data ?? verifyRes;
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
    return createAuthEndpoint("/paystack/subscription/list", {
        method: "GET",
        use: [sessionMiddleware, originCheck],
    }, async (ctx) => {
        const subscriptionOptions = options.subscription;
        if (!subscriptionOptions?.enabled) {
            throw new APIError("BAD_REQUEST", {
                message: "Subscriptions are not enabled in the Paystack options.",
            });
        }
        const session = await getSessionFromCtx(ctx);
        if (!session)
            throw new APIError("UNAUTHORIZED");
        const referenceId = session.user.id;
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
    return createAuthEndpoint("/paystack/subscription/disable", { method: "POST", body: enableDisableBodySchema, use: [sessionMiddleware, originCheck] }, async (ctx) => {
        const { subscriptionCode, emailToken } = ctx.body;
        try {
            try {
                const res = await options.paystackClient?.subscription?.disable?.({
                    code: subscriptionCode,
                    token: emailToken,
                });
                return ctx.json({ result: res });
            }
            catch {
                const res = await options.paystackClient?.subscription?.disable?.({
                    subscription_code: subscriptionCode,
                    email_token: emailToken,
                });
                return ctx.json({ result: res });
            }
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
    return createAuthEndpoint("/paystack/subscription/enable", { method: "POST", body: enableDisableBodySchema, use: [sessionMiddleware, originCheck] }, async (ctx) => {
        const { subscriptionCode, emailToken } = ctx.body;
        try {
            try {
                const res = await options.paystackClient?.subscription?.enable?.({
                    code: subscriptionCode,
                    token: emailToken,
                });
                return ctx.json({ result: res });
            }
            catch {
                const res = await options.paystackClient?.subscription?.enable?.({
                    subscription_code: subscriptionCode,
                    email_token: emailToken,
                });
                return ctx.json({ result: res });
            }
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
