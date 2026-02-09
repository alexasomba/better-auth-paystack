import { createAuthMiddleware } from "@better-auth/core/api";
import { logger } from "better-auth";
import { APIError } from "better-auth/api";
export const referenceMiddleware = (options, action) => createAuthMiddleware(async (ctx) => {
    const session = ctx.context.session;
    if (!session) {
        throw new APIError("UNAUTHORIZED");
    }
    const referenceId = ctx.body?.referenceId || ctx.query?.referenceId || session.user.id;
    const subscriptionOptions = options.subscription;
    if (referenceId === session.user.id) {
        return {
            referenceId,
        };
    }
    // 1. Try custom authorization first if provided
    if (subscriptionOptions?.enabled && 'authorizeReference' in subscriptionOptions && subscriptionOptions.authorizeReference) {
        const authorized = await subscriptionOptions.authorizeReference({
            user: session.user,
            session,
            referenceId,
            action,
        }, ctx);
        if (authorized) {
            return {
                referenceId,
            };
        }
        // If explicit authorizeReference returns false, do we fail immediately?
        // Usually yes, but maybe we fallback to org check?
        // Let's assume authorizeReference overrides everything.
        throw new APIError("UNAUTHORIZED");
    }
    // 2. Fallback: Organization Check
    if (options.organization?.enabled) {
        // Check if referenceId indicates an organization the user is a member of
        const member = await ctx.context.adapter.findOne({
            model: "member",
            where: [
                { field: "userId", value: session.user.id },
                { field: "organizationId", value: referenceId }
            ]
        });
        if (member) {
            console.log("DEBUG MIDDLEWARE MEMBER FOUND:", member);
            // User is a member of the organization.
            // We could check roles here, but for now allow any member.
            return {
                referenceId,
            };
        }
    }
    logger.error(`Passing referenceId into a subscription action isn't allowed if subscription.authorizeReference isn't defined in your paystack plugin config and matches no organization membership.`);
    throw new APIError("BAD_REQUEST", {
        message: "Passing referenceId isn't allowed without subscription.authorizeReference or valid organization membership.",
    });
});
