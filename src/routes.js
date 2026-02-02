import { createAuthEndpoint } from "@better-auth/core/api";
import { defineErrorCodes } from "@better-auth/core/utils";
import { HIDE_METADATA } from "better-auth";
import { APIError, getSessionFromCtx, originCheck, sessionMiddleware, } from "better-auth/api";
import * as z from "zod/v4";
import { getPlanByName, getPlans, getProductByName, getProducts } from "./utils";
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
    plan: z.string().optional(),
    product: z.string().optional(),
    amount: z.number().optional(), // Amount in smallest currency unit (e.g., kobo)
    currency: z.string().optional(),
    email: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    referenceId: z.string().optional(),
    callbackURL: z.string().optional(),
});
export const initializeTransaction = (options) => {
    const subscriptionOptions = options.subscription;
    // If subscriptions are enabled, use full middleware stack; otherwise just basics.
    // However, for one-time payments, we might not strictly need subscription middleware
    // checking for existing subs, but let's keep it consistent for now.
    const useMiddlewares = subscriptionOptions?.enabled
        ? [sessionMiddleware, originCheck, referenceMiddleware(subscriptionOptions, "initialize-transaction")]
        : [sessionMiddleware, originCheck];
    return createAuthEndpoint("/paystack/transaction/initialize", {
        method: "POST",
        body: initializeTransactionBodySchema,
        use: useMiddlewares,
    }, async (ctx) => {
        const paystack = getPaystackOps(options.paystackClient);
        const { plan: planName, product: productName, amount: bodyAmount, currency, email, metadata: extraMetadata, callbackURL } = ctx.body;
        // 1. Validate Callback URL validation (same as before)
        if (callbackURL) {
            const checkTrusted = () => {
                try {
                    if (!callbackURL)
                        return false;
                    if (callbackURL.startsWith("/"))
                        return true;
                    const baseUrl = ctx.context?.baseURL ??
                        ctx.request?.url ??
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
            if (!checkTrusted()) {
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
        if (subscriptionOptions?.enabled && subscriptionOptions.requireEmailVerification && !user.emailVerified) {
            throw new APIError("BAD_REQUEST", {
                code: "EMAIL_VERIFICATION_REQUIRED",
                message: PAYSTACK_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED,
            });
        }
        // 4. Determine Payment Mode: Subscription (Plan) vs Product vs One-Time (Amount)
        let plan;
        let product;
        if (planName) {
            if (!subscriptionOptions?.enabled) {
                throw new APIError("BAD_REQUEST", { message: "Subscriptions are not enabled." });
            }
            plan = await getPlanByName(options, planName);
            if (!plan) {
                throw new APIError("BAD_REQUEST", {
                    code: "SUBSCRIPTION_PLAN_NOT_FOUND",
                    message: PAYSTACK_ERROR_CODES.SUBSCRIPTION_PLAN_NOT_FOUND,
                });
            }
        }
        else if (productName) {
            product = await getProductByName(options, productName);
            if (!product) {
                throw new APIError("BAD_REQUEST", {
                    message: `Product '${productName}' not found.`,
                });
            }
        }
        else if (!bodyAmount) {
            throw new APIError("BAD_REQUEST", {
                message: "Either 'plan', 'product', or 'amount' is required to initialize a transaction.",
            });
        }
        const amount = bodyAmount || product?.amount;
        const finalCurrency = currency || product?.currency || plan?.currency || "NGN";
        // 5. Prepare Payload
        const referenceIdFromCtx = ctx.context.referenceId;
        const referenceId = ctx.body.referenceId || referenceIdFromCtx || session.user.id;
        let url;
        let reference;
        let accessCode;
        try {
            // Construct Metadata
            const metadata = JSON.stringify({
                referenceId,
                userId: user.id,
                plan: plan?.name.toLowerCase(), // Undefined for one-time
                product: product?.name.toLowerCase(),
                ...extraMetadata,
            });
            const initBody = {
                email: email || user.email,
                callback_url: callbackURL,
                metadata,
                // If plan/product exists, use its currency; otherwise fallback to provided or default
                currency: finalCurrency,
            };
            if (plan) {
                // Subscription Flow
                initBody.plan = plan.planCode;
                initBody.invoice_limit = plan.invoiceLimit;
                // If plan has no code but has amount (e.g. local plans?), Paystack usually needs amount
                if (!plan.planCode && plan.amount) {
                    initBody.amount = String(plan.amount);
                }
            }
            else {
                // One-Time Payment Flow
                if (!amount)
                    throw new Error("Amount is required for one-time payments");
                initBody.amount = String(amount);
            }
            const initRaw = await paystack.transactionInitialize(initBody);
            const initRes = unwrapSdkResult(initRaw);
            let data = initRes && typeof initRes === "object" && "status" in initRes && "data" in initRes
                ? initRes.data
                : initRes?.data ?? initRes;
            if (data && typeof data === "object" && "status" in data && "data" in data) {
                data = data.data;
            }
            url = data?.authorization_url;
            reference = data?.reference;
            accessCode = data?.access_code;
        }
        catch (error) {
            ctx.context.logger.error("Failed to initialize Paystack transaction", error);
            throw new APIError("BAD_REQUEST", {
                code: "FAILED_TO_INITIALIZE_TRANSACTION",
                message: error?.message || PAYSTACK_ERROR_CODES.FAILED_TO_INITIALIZE_TRANSACTION,
            });
        }
        // 6. Record Transaction & Subscription
        const paystackCustomerCode = user.paystackCustomerCode;
        await ctx.context.adapter.create({
            model: "paystackTransaction",
            data: {
                reference: reference,
                referenceId,
                userId: user.id,
                amount: plan?.amount || amount,
                currency: plan?.currency || currency || "NGN",
                status: "pending",
                plan: plan?.name.toLowerCase(),
                metadata: extraMetadata ? JSON.stringify(extraMetadata) : undefined,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
        if (plan) {
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
        }
        return ctx.json({
            url,
            reference,
            accessCode,
            redirect: true,
        });
    });
};
export const verifyTransaction = (options) => {
    const verifyBodySchema = z.object({
        reference: z.string(),
    });
    const subscriptionOptions = options.subscription;
    const useMiddlewares = subscriptionOptions?.enabled
        ? [sessionMiddleware, originCheck, referenceMiddleware(subscriptionOptions, "verify-transaction")]
        : [sessionMiddleware, originCheck];
    return createAuthEndpoint("/paystack/transaction/verify", {
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
                message: error?.message || PAYSTACK_ERROR_CODES.FAILED_TO_VERIFY_TRANSACTION,
            });
        }
        let data = verifyRes && typeof verifyRes === "object" && "status" in verifyRes && "data" in verifyRes
            ? verifyRes.data
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
                const referenceIdFromCtx = ctx.context.referenceId;
                const referenceId = referenceIdFromCtx ?? session?.user?.id;
                await ctx.context.adapter.update({
                    model: "paystackTransaction",
                    update: {
                        status: "success",
                        paystackId,
                        updatedAt: new Date(),
                    },
                    where: [{ field: "reference", value: reference }],
                });
                await ctx.context.adapter.update({
                    model: "subscription",
                    update: {
                        status: "active",
                        periodStart: new Date(),
                        updatedAt: new Date(),
                    },
                    where: [
                        { field: "paystackTransactionReference", value: reference },
                        ...(referenceId ? [{ field: "referenceId", value: referenceId }] : []),
                    ],
                });
            }
            catch (e) {
                ctx.context.logger.error("Failed to update transaction/subscription after verification", e);
            }
        }
        else if (status === "failed" || status === "abandoned") {
            try {
                await ctx.context.adapter.update({
                    model: "paystackTransaction",
                    update: {
                        status,
                        updatedAt: new Date(),
                    },
                    where: [{ field: "reference", value: reference }],
                });
            }
            catch (e) {
                ctx.context.logger.error("Failed to update transaction status", e);
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
export const listTransactions = (options) => {
    const listQuerySchema = z.object({
        referenceId: z.string().optional(),
    });
    const subscriptionOptions = options.subscription;
    const useMiddlewares = subscriptionOptions?.enabled
        ? [sessionMiddleware, originCheck, referenceMiddleware(subscriptionOptions, "list-transactions")]
        : [sessionMiddleware, originCheck];
    return createAuthEndpoint("/paystack/transaction/list", {
        method: "GET",
        query: listQuerySchema,
        use: useMiddlewares,
    }, async (ctx) => {
        const session = await getSessionFromCtx(ctx);
        if (!session)
            throw new APIError("UNAUTHORIZED");
        const referenceId = ctx.context.referenceId ??
            ctx.query?.referenceId ??
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
});
function decodeBase64UrlToString(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "===".slice((normalized.length + 3) % 4);
    if (typeof globalThis.atob === "function") {
        return globalThis.atob(padded);
    }
    // Node fallback
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return Buffer.from(padded, "base64").toString("utf8");
}
function tryGetEmailTokenFromSubscriptionManageLink(link) {
    try {
        const url = new URL(link);
        const subscriptionToken = url.searchParams.get("subscription_token");
        if (!subscriptionToken)
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
export const disablePaystackSubscription = (options) => {
    const subscriptionOptions = options.subscription;
    const useMiddlewares = subscriptionOptions?.enabled
        ? [sessionMiddleware, originCheck, referenceMiddleware(subscriptionOptions, "disable-subscription")]
        : [sessionMiddleware, originCheck];
    return createAuthEndpoint("/paystack/subscription/disable", { method: "POST", body: enableDisableBodySchema, use: useMiddlewares }, async (ctx) => {
        const { subscriptionCode } = ctx.body;
        const paystack = getPaystackOps(options.paystackClient);
        try {
            let emailToken = ctx.body.emailToken;
            if (!emailToken) {
                try {
                    const raw = await paystack.subscriptionFetch(subscriptionCode);
                    const fetchRes = unwrapSdkResult(raw);
                    const data = fetchRes && typeof fetchRes === "object" && "status" in fetchRes && "data" in fetchRes
                        ? fetchRes.data
                        : fetchRes?.data ?? fetchRes;
                    emailToken = data?.email_token;
                }
                catch {
                    // ignore; try manage-link fallback below
                }
            }
            if (!emailToken) {
                try {
                    const raw = await paystack.subscriptionManageLink(subscriptionCode);
                    const linkRes = unwrapSdkResult(raw);
                    const data = linkRes && typeof linkRes === "object" && "status" in linkRes && "data" in linkRes
                        ? linkRes.data
                        : linkRes?.data ?? linkRes;
                    const link = data?.link;
                    if (typeof link === "string") {
                        emailToken = tryGetEmailTokenFromSubscriptionManageLink(link);
                    }
                }
                catch {
                    // ignore
                }
            }
            if (!emailToken) {
                throw new APIError("BAD_REQUEST", {
                    message: "Missing emailToken. Provide it explicitly or ensure your server can fetch it from Paystack using the subscription code.",
                });
            }
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
                code: "FAILED_TO_DISABLE_SUBSCRIPTION",
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
        const { subscriptionCode } = ctx.body;
        const paystack = getPaystackOps(options.paystackClient);
        try {
            let emailToken = ctx.body.emailToken;
            if (!emailToken) {
                try {
                    const raw = await paystack.subscriptionFetch(subscriptionCode);
                    const fetchRes = unwrapSdkResult(raw);
                    const data = fetchRes && typeof fetchRes === "object" && "status" in fetchRes && "data" in fetchRes
                        ? fetchRes.data
                        : fetchRes?.data ?? fetchRes;
                    emailToken = data?.email_token;
                }
                catch {
                    // ignore; try manage-link fallback below
                }
            }
            if (!emailToken) {
                try {
                    const raw = await paystack.subscriptionManageLink(subscriptionCode);
                    const linkRes = unwrapSdkResult(raw);
                    const data = linkRes && typeof linkRes === "object" && "status" in linkRes && "data" in linkRes
                        ? linkRes.data
                        : linkRes?.data ?? linkRes;
                    const link = data?.link;
                    if (typeof link === "string") {
                        emailToken = tryGetEmailTokenFromSubscriptionManageLink(link);
                    }
                }
                catch {
                    // ignore
                }
            }
            if (!emailToken) {
                throw new APIError("BAD_REQUEST", {
                    message: "Missing emailToken. Provide it explicitly or ensure your server can fetch it from Paystack using the subscription code.",
                });
            }
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
                code: "FAILED_TO_ENABLE_SUBSCRIPTION",
                message: error?.message || PAYSTACK_ERROR_CODES.FAILED_TO_ENABLE_SUBSCRIPTION,
            });
        }
    });
};
const subscriptionCodeSchema = z.object({
    subscriptionCode: z.string(),
});
export const getSubscriptionManageLink = (options) => {
    const subscriptionOptions = options.subscription;
    const useMiddlewares = subscriptionOptions?.enabled
        ? [sessionMiddleware, originCheck, referenceMiddleware(subscriptionOptions, "get-subscription-manage-link")]
        : [sessionMiddleware, originCheck];
    return createAuthEndpoint("/paystack/subscription/manage-link", {
        method: "GET",
        query: subscriptionCodeSchema,
        use: useMiddlewares
    }, async (ctx) => {
        const { subscriptionCode } = ctx.query;
        const paystack = getPaystackOps(options.paystackClient);
        try {
            const raw = await paystack.subscriptionManageLink(subscriptionCode);
            const linkRes = unwrapSdkResult(raw);
            const data = linkRes && typeof linkRes === "object" && "status" in linkRes && "data" in linkRes
                ? linkRes.data
                : linkRes?.data ?? linkRes;
            return ctx.json({ link: data?.link });
        }
        catch (error) {
            ctx.context.logger.error("Failed to get Paystack subscription manage link", error);
            throw new APIError("BAD_REQUEST", {
                message: error?.message || "Failed to fetch subscription management link",
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
        const [plans, products] = await Promise.all([
            options.subscription?.enabled ? getPlans(options.subscription) : Promise.resolve([]),
            getProducts(options.products),
        ]);
        return ctx.json({ plans, products });
    });
};
export { PAYSTACK_ERROR_CODES };
