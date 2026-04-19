import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import {
  chargeSubscriptionRenewal,
  syncPaystackPlans,
  syncPaystackProducts,
} from "@alexasomba/better-auth-paystack";
import { auth, paystackOptions } from "@/lib/auth";

function requirePaystackOptions(): NonNullable<typeof paystackOptions> {
  if (paystackOptions === null) {
    throw new Error("Paystack is not configured for this example.");
  }

  return paystackOptions;
}

async function getAuthenticatedContext() {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });

  if (session?.user === undefined || session.user === null) {
    throw new Error("You must be signed in to run trusted billing operations.");
  }

  const ctx = { context: await auth.$context } as any;

  return { ctx, session };
}

export const syncProductsServerFn = createServerFn({ method: "POST" })
  .inputValidator(() => undefined)
  .handler(async () => {
    const { ctx } = await getAuthenticatedContext();
    return syncPaystackProducts(ctx, requirePaystackOptions());
  });

export const syncPlansServerFn = createServerFn({ method: "POST" })
  .inputValidator(() => undefined)
  .handler(async () => {
    const { ctx } = await getAuthenticatedContext();
    return syncPaystackPlans(ctx, requirePaystackOptions());
  });

export const chargeRenewalServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { subscriptionId: string }) => data)
  .handler(async (serverCtx) => {
    const input = serverCtx.data;
    const { ctx, session } = await getAuthenticatedContext();

    const subscription = await ctx.context.adapter.findOne({
      model: "subscription",
      where: [{ field: "id", value: input.subscriptionId }],
    });

    if (subscription === undefined || subscription === null) {
      throw new Error("Subscription not found.");
    }

    if (subscription.referenceId !== session.user.id) {
      const member = await ctx.context.adapter.findOne({
        model: "member",
        where: [
          { field: "organizationId", value: subscription.referenceId },
          { field: "userId", value: session.user.id },
        ],
      });

      if (member === undefined || member === null) {
        throw new Error("You are not allowed to manage this billing profile.");
      }
    }

    const result = await chargeSubscriptionRenewal(ctx, requirePaystackOptions(), {
      subscriptionId: input.subscriptionId,
    });

    return {
      status: result.status,
      reference: result.data.reference ?? null,
    };
  });
