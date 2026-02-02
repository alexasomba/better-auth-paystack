import { createAuthMiddleware } from "@better-auth/core/api";
import { logger } from "better-auth";
import { APIError } from "better-auth/api";
import type { SubscriptionOptions } from "./types";

export const referenceMiddleware = (
    subscriptionOptions: SubscriptionOptions,
    action:
        | "initialize-transaction"
        | "verify-transaction"
        | "list-subscriptions"
        | "list-transactions"
        | "disable-subscription"
        | "enable-subscription"
        | "get-subscription-manage-link",
) =>
    createAuthMiddleware(async (ctx) => {
        const session = ctx.context.session as any;
        if (!session) {
            throw new APIError("UNAUTHORIZED");
        }
        const referenceId =
            ctx.body?.referenceId || ctx.query?.referenceId || session.user.id;

        if (referenceId !== session.user.id && !subscriptionOptions.authorizeReference) {
            logger.error(
                `Passing referenceId into a subscription action isn't allowed if subscription.authorizeReference isn't defined in your paystack plugin config.`,
            );
            throw new APIError("BAD_REQUEST", {
                message:
                    "Passing referenceId isn't allowed without subscription.authorizeReference.",
            });
        }

        if (referenceId !== session.user.id && subscriptionOptions.authorizeReference) {
            const authorized = await subscriptionOptions.authorizeReference(
                {
                    user: session.user,
                    session,
                    referenceId,
                    action,
                },
                ctx,
            );
            if (!authorized) {
                throw new APIError("UNAUTHORIZED");
            }
        }

        return {
            context: {
                referenceId,
            },
        };
    });
