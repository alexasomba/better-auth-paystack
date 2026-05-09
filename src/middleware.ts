import { logger } from "better-auth";
import { APIError, createAuthMiddleware, type AuthMiddleware } from "better-auth/api";

import type { PaystackOptions, Session, User } from "./types";

const BILLING_ORG_ROLES = new Set(["owner", "admin"]);

export function hasBillingRole(role: unknown): boolean {
  if (Array.isArray(role)) {
    return role.some((value) => hasBillingRole(value));
  }
  if (typeof role !== "string") {
    return false;
  }
  return role
    .split(",")
    .map((value) => value.trim())
    .some((value) => BILLING_ORG_ROLES.has(value));
}

export const referenceMiddleware = (
  options: PaystackOptions,
  action:
    | "initialize-transaction"
    | "verify-transaction"
    | "list-subscriptions"
    | "list-transactions"
    | "disable-subscription"
    | "enable-subscription"
    | "get-subscription-manage-link",
): AuthMiddleware =>
  createAuthMiddleware(async (ctx) => {
    const session = ctx.context.session as {
      user: User;
      session: Session;
    } | null;

    if (session === null || session === undefined) {
      throw new APIError("UNAUTHORIZED");
    }
    const body = (ctx.body ?? {}) as Record<string, unknown>;
    const query = (ctx.query ?? {}) as Record<string, unknown>;
    const requestQueryReferenceId =
      typeof ctx.request?.url === "string"
        ? (new URL(ctx.request.url).searchParams.get("referenceId") ?? undefined)
        : undefined;
    const referenceId =
      (body.referenceId as string | undefined) ??
      (query.referenceId as string | undefined) ??
      requestQueryReferenceId ??
      session.user.id;

    const subscriptionOptions = options.subscription;

    if (referenceId === session.user.id) {
      return {
        context: {
          ...ctx.context,
          referenceId,
        },
      };
    }

    // 1. Try custom authorization first if provided
    if (
      subscriptionOptions?.enabled === true &&
      "authorizeReference" in subscriptionOptions &&
      typeof subscriptionOptions.authorizeReference === "function"
    ) {
      const authorized = await subscriptionOptions.authorizeReference(
        {
          user: session.user,
          session: session.session,
          referenceId,
          action,
        },
        ctx,
      );
      if (authorized === true) {
        return {
          context: {
            ...ctx.context,
            referenceId,
          },
        };
      }
      // Explicit authorization is authoritative when provided.
      throw new APIError("UNAUTHORIZED");
    }

    // 2. Fallback: Organization owner/admin check
    if (options.organization?.enabled === true) {
      const member = await ctx.context.adapter.findOne({
        model: "member",
        where: [
          { field: "userId", value: session.user.id },
          { field: "organizationId", value: referenceId },
        ],
      });

      if (
        member !== null &&
        member !== undefined &&
        hasBillingRole((member as { role?: unknown }).role)
      ) {
        return {
          context: {
            ...ctx.context,
            referenceId,
          },
        };
      }
    }

    logger.error(
      `Passing referenceId into a subscription action isn't allowed unless subscription.authorizeReference allows it or the session user is an organization owner/admin.`,
    );
    throw new APIError("BAD_REQUEST", {
      message:
        "Passing referenceId isn't allowed without subscription.authorizeReference or organization owner/admin membership.",
    });
  });
