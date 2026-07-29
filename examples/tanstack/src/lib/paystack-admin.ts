import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import * as z from "zod/v4";
import type { GenericEndpointContext } from "better-auth";
import {
  chargeSubscriptionRenewal,
  syncPaystackPlans,
  syncPaystackProducts,
  type Subscription,
} from "better-auth-paystack";
import { auth, paystackOptions } from "@/lib/auth";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const renewalInputSchema = z.object({
  subscriptionId: z.string().min(1),
});

const verifyCallbackInputSchema = z.object({
  reference: z.string().min(1),
});

export interface VerifyCallbackResult {
  status: string;
  reference: string;
  data: {
    status: string;
    metadata?: JsonValue;
  };
}

interface RawVerifyTransactionResult {
  status: string;
  reference: string;
  data: {
    status: string;
    metadata?: unknown;
  };
}

function toJsonValue(value: unknown): JsonValue | undefined {
  if (value === undefined) return undefined;

  try {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  } catch {
    return undefined;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    error !== null &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Paystack operation failed.";
}

function hasBillingRole(role: unknown): boolean {
  const roles = Array.isArray(role) ? role : typeof role === "string" ? role.split(",") : [];
  return roles.some((value) => value === "owner" || value === "admin");
}

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

  const ctx = { context: auth.$context } as unknown as GenericEndpointContext;

  return { ctx, session };
}

export const syncProductsServerFn = createServerFn({ method: "POST" })
  .inputValidator(z.void())
  .handler(async () => {
    const { ctx } = await getAuthenticatedContext();
    return syncPaystackProducts(ctx, requirePaystackOptions());
  });

export const syncPlansServerFn = createServerFn({ method: "POST" })
  .inputValidator(z.void())
  .handler(async () => {
    const { ctx } = await getAuthenticatedContext();
    return syncPaystackPlans(ctx, requirePaystackOptions());
  });

export const chargeRenewalServerFn = createServerFn({ method: "POST" })
  .inputValidator(renewalInputSchema)
  .handler(async (serverCtx) => {
    const input = serverCtx.data;
    const { ctx, session } = await getAuthenticatedContext();

    const subscription = await ctx.context.adapter.findOne<Subscription>({
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

      if (!hasBillingRole((member as { role?: unknown }).role)) {
        throw new Error("Only organization owners and admins can manage billing.");
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

export const verifyPaystackCallbackServerFn = createServerFn({ method: "POST" })
  .inputValidator(verifyCallbackInputSchema)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    let lastError: unknown;

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const result = (await auth.api.verifyTransaction({
          body: { reference: data.reference },
          headers,
        })) as RawVerifyTransactionResult;

        return {
          status: result.status,
          reference: result.reference,
          data: {
            status: result.data.status,
            metadata: toJsonValue(result.data.metadata),
          },
        } satisfies VerifyCallbackResult;
      } catch (error: unknown) {
        lastError = error;
        const message = getErrorMessage(error);
        const shouldRetry = message.includes("Transaction reference not found") && attempt < 3;

        if (!shouldRetry) {
          throw new Error(message, { cause: error });
        }

        await new Promise((resolve) => {
          setTimeout(resolve, 750);
        });
      }
    }

    throw new Error(getErrorMessage(lastError));
  });
