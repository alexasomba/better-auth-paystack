import type { GenericEndpointContext } from "better-auth";
import {
  chargeSubscriptionRenewal,
  syncPaystackPlans,
  syncPaystackProducts,
} from "better-auth-paystack";

import { auth, paystackOptions } from "../../../lib/auth";

type BillingRequest =
  | { action: "verify"; reference: string }
  | { action: "sync-products" }
  | { action: "sync-plans" }
  | { action: "charge-renewal"; subscriptionId: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRequest(value: unknown): BillingRequest {
  if (!isRecord(value) || typeof value.action !== "string") {
    throw new Error("Invalid billing action");
  }

  if (value.action === "verify" && typeof value.reference === "string" && value.reference !== "") {
    return { action: "verify", reference: value.reference };
  }
  if (value.action === "sync-products") return { action: value.action };
  if (value.action === "sync-plans") return { action: value.action };
  if (
    value.action === "charge-renewal" &&
    typeof value.subscriptionId === "string" &&
    value.subscriptionId !== ""
  ) {
    return { action: value.action, subscriptionId: value.subscriptionId };
  }

  throw new Error("Invalid billing action payload");
}

async function requireContext(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user === undefined) {
    throw new Error("You must be signed in to run this billing operation.");
  }

  const ctx = { context: auth.$context } as unknown as GenericEndpointContext;
  return { ctx, session };
}

export async function POST(request: Request) {
  try {
    const input = parseRequest(await request.json().catch(() => null));

    if (input.action === "verify") {
      return Response.json(
        await auth.api.verifyTransaction({
          body: { reference: input.reference },
          headers: request.headers,
        }),
      );
    }

    const { ctx, session } = await requireContext(request);

    if (input.action === "sync-products") {
      return Response.json(await syncPaystackProducts(ctx, paystackOptions));
    }
    if (input.action === "sync-plans") {
      return Response.json(await syncPaystackPlans(ctx, paystackOptions));
    }

    const subscription = await ctx.context.adapter.findOne<{
      id: string;
      referenceId: string;
    }>({
      model: "paystackSubscription",
      where: [{ field: "id", value: input.subscriptionId }],
    });
    if (subscription === null) {
      throw new Error("Subscription not found.");
    }

    if (subscription.referenceId !== session.user.id) {
      const member = await ctx.context.adapter.findOne<{ role?: unknown }>({
        model: "member",
        where: [
          { field: "organizationId", value: subscription.referenceId },
          { field: "userId", value: session.user.id },
        ],
      });
      if (member === null || !["owner", "admin"].includes(String(member.role))) {
        throw new Error("Only organization owners and admins can manage billing.");
      }
    }

    return Response.json(
      await chargeSubscriptionRenewal(ctx, paystackOptions, {
        subscriptionId: input.subscriptionId,
      }),
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Billing operation failed.";
    const status = message.includes("signed in") ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
