import { APIError, createAuthMiddleware, type AuthMiddleware } from "better-auth/api";

import type { PaystackOptions, Session, User } from "./types";
import {
  authorizeBillingReference,
  type BillingReferenceAction,
  resolveBillingReferenceId,
} from "./reference-access";

export { hasBillingRole } from "./reference-access";

export const referenceMiddleware = (
  options: PaystackOptions,
  action: BillingReferenceAction,
): AuthMiddleware =>
  createAuthMiddleware(async (ctx) => {
    const session = ctx.context.session as {
      user: User;
      session: Session;
    } | null;

    if (session === null || session === undefined) {
      throw new APIError("UNAUTHORIZED");
    }
    const referenceId = resolveBillingReferenceId({
      body: ctx.body,
      query: ctx.query,
      requestUrl: ctx.request?.url,
      fallbackUserId: session.user.id,
    });

    await authorizeBillingReference(ctx, options, {
      user: session.user,
      session: session.session,
      referenceId,
      action,
    });

    return {
      context: {
        ...ctx.context,
        referenceId,
      },
    };
  });
