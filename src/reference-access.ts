import type { GenericEndpointContext } from "better-auth";
import { APIError } from "better-auth/api";

import type { AnyPaystackOptions, Session, User } from "./types";

export type BillingReferenceAction =
  | "initialize-transaction"
  | "verify-transaction"
  | "list-subscriptions"
  | "list-transactions"
  | "disable-subscription"
  | "enable-subscription"
  | "get-subscription-manage-link";

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

export function resolveBillingReferenceId(input: {
  body?: unknown;
  query?: unknown;
  requestUrl?: string;
  fallbackUserId: string;
}): string {
  const body = (input.body ?? {}) as Record<string, unknown>;
  const query = (input.query ?? {}) as Record<string, unknown>;
  const requestQueryReferenceId =
    typeof input.requestUrl === "string"
      ? (new URL(input.requestUrl).searchParams.get("referenceId") ?? undefined)
      : undefined;

  return (
    (body.referenceId as string | undefined) ??
    (query.referenceId as string | undefined) ??
    requestQueryReferenceId ??
    input.fallbackUserId
  );
}

export async function authorizeBillingReference(
  ctx: GenericEndpointContext,
  options: AnyPaystackOptions,
  data: {
    user: User;
    session: Session;
    referenceId: string;
    action: BillingReferenceAction;
  },
): Promise<void> {
  if (data.referenceId === data.user.id) return;

  if (
    options.subscription?.enabled === true &&
    typeof options.subscription.authorizeReference === "function"
  ) {
    const authorized = await options.subscription.authorizeReference(
      {
        user: data.user,
        session: data.session,
        referenceId: data.referenceId,
        action: data.action,
      },
      ctx,
    );
    if (authorized === true) return;
    throw new APIError("UNAUTHORIZED");
  }

  if (options.organization?.enabled === true) {
    const member = await ctx.context.adapter.findOne({
      model: "member",
      where: [
        { field: "userId", value: data.user.id },
        { field: "organizationId", value: data.referenceId },
      ],
    });

    if (
      member !== null &&
      member !== undefined &&
      hasBillingRole((member as { role?: unknown }).role)
    ) {
      return;
    }
  }

  throw new APIError("UNAUTHORIZED");
}
