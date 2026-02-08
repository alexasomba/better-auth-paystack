import { betterAuth } from "better-auth";
import { drizzle } from "drizzle-orm/d1";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { paystack } from "@alexasomba/better-auth-paystack";
import { createPaystack } from "@alexasomba/paystack-node";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "@/db/schema";

const baseURL = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000";

const secretKey = process.env.PAYSTACK_SECRET_KEY;
const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;

if (!secretKey) {
    throw new Error("Missing PAYSTACK_SECRET_KEY");
}
if (!webhookSecret) {
    throw new Error("Missing PAYSTACK_WEBHOOK_SECRET");
}

const paystackClient = createPaystack({
    secretKey,
});

/**
 * Create auth instance with D1 database from Cloudflare context.
 * This is called lazily to ensure we have access to the D1 binding.
 */
export async function getAuth() {
    const { env } = await getCloudflareContext();
    const db = drizzle(env.DB, { schema });
    
    return betterAuth({
        baseURL,
        database: drizzleAdapter(db, {
            provider: "sqlite",
            // Pass schema tables by the model name Better Auth expects
            schema: {
                user: schema.user,
                session: schema.session,
                account: schema.account,
                verification: schema.verification,
            },
        }),
        emailAndPassword: { enabled: true },
        secret: process.env.BETTER_AUTH_SECRET,
        logger: {
            level: "debug",
        },
        advanced: {
            ipAddress: {
                ipAddressHeaders: ["cf-connecting-ip"], // Cloudflare specific header
                ipv6Subnet: 64, // Rate limit by /64 subnet for IPv6
            },
            crossSubDomainCookies: {
                enabled: true,
            },
        },
        trustedOrigins: [
            baseURL, 
            "http://localhost:8787", "http://127.0.0.1:8787",
            "http://localhost:8788", "http://127.0.0.1:8788"
        ],
        rateLimit: {
            enabled: true,
            window: 60, // 60 seconds
            max: 50, // 50 requests per minute (stricter for demo)
            customRules: {
                // Strict limits for anonymous sign-in to prevent bot abuse
                "/sign-in/anonymous": {
                    window: 60,
                    max: 5, // Only 5 anonymous logins per minute per IP
                },
                // Strict limits for email sign-in
                "/sign-in/email": {
                    window: 10,
                    max: 3,
                },
                // Allow more frequent session checks
                "/get-session": {
                    window: 60,
                    max: 100,
                },
                // Paystack payment initialization - prevent abuse
                "/paystack/initialize-transaction": {
                    window: 60,
                    max: 6, // Max 10 payment initializations per minute
                },
                // Paystack subscription management
                "/paystack/list-local-subscriptions": {
                    window: 60,
                    max: 20,
                },
                "/paystack/disable-subscription": {
                    window: 60,
                    max: 5,
                },
                "/paystack/enable-subscription": {
                    window: 60,
                    max: 5,
                },
            },
        },
        plugins: [
            anonymous(),
            paystack({
                paystackClient,
                paystackWebhookSecret: webhookSecret,
                subscription: {
                    enabled: true,
                    plans: [
                        {
                            name: "starter",
                            amount: 500000, // 5,000 NGN
                            currency: "NGN",
                            interval: "monthly",
                        },
                        {
                            name: "pro",
                            amount: 1200000, // 12,000 NGN
                            currency: "NGN",
                            interval: "monthly",
                        },
                        {
                            name: "enterprise",
                            amount: 10000000, // 100,000 NGN
                            currency: "NGN",
                            interval: "annually",
                        },
                    ],
                },
                products: {
                    products: [
                        {
                            name: "50 Credits Pack",
                            amount: 250000, // 2,500 NGN
                            currency: "NGN",
                            metadata: { type: "credits", quantity: 50 },
                        },
                        {
                            name: "150 Credits Pack",
                            amount: 600000, // 6,000 NGN
                            currency: "NGN",
                            metadata: { type: "credits", quantity: 150 },
                        },
                    ],
                },
            }),
            nextCookies(), // make sure this is the last plugin in the array
        ],
    });
}

// For backwards compatibility, export a lazy proxy that calls getAuth()
// This allows existing code using `auth.api.getSession()` to continue working
export const auth = {
    api: {
        async getSession(options: { headers: Headers }) {
            const authInstance = await getAuth();
            return authInstance.api.getSession(options);
        }
    },
    async handler(request: Request) {
        const authInstance = await getAuth();
        return authInstance.handler(request);
    }
};
