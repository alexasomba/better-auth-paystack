import { APIError } from "better-auth/api";
import {
  PaystackError,
  PaystackResponse,
  type CustomerCreatePayload,
  type CustomerUpdatePayload,
} from "@alexasomba/paystack-node";
import type { components } from "@alexasomba/paystack-node";
import type { PaystackClientLike } from "./types";

/**
 * Interface for checking if a result is a PaystackResponse from the SDK v1.9.1+
 */
function IsPaystackResponse(value: unknown): value is PaystackResponse<unknown> {
  return value instanceof PaystackResponse;
}

/**
 * Unwraps a Paystack SDK result, extracting the data or throwing an APIError if the request failed.
 * Leverages the native .unwrap() method in SDK v1.9.1+ if available.
 */
export function unwrapSdkResult<T = unknown>(result: unknown): T {
  if (IsPaystackResponse(result)) {
    try {
      return result.unwrap() as T;
    } catch (e: unknown) {
      if (e instanceof PaystackError) {
        throw new APIError("BAD_REQUEST", {
          message: e.message,
          status: e.status,
        });
      }

      throw new APIError("BAD_REQUEST", {
        message: (e as Error)?.message ?? "Paystack API error",
      });
    }
  }

  // Fallback for custom or legacy structures (e.g. from mocks in tests)
  let current = result;

  // Handle nested { data: { data: ... } } or { status: true, data: ... }
  while (current !== null && current !== undefined && typeof current === "object") {
    const body = current as Record<string, unknown>;

    // Check for Paystack Error shape
    if (body.status === false) {
      throw new APIError("BAD_REQUEST", {
        message: (body.message as string | undefined) ?? "Paystack API error",
      });
    }

    // Stop if we have found the actual transaction/subscription payload properties
    if ("authorization_url" in body || "reference" in body || "customer_code" in body) {
      break;
    }

    // If there's a data property, unwrap it and continue checking
    if (
      "data" in body &&
      body.data !== undefined &&
      body.data !== null &&
      typeof body.data === "object"
    ) {
      current = body.data;
      continue;
    }
    break;
  }

  return current as T;
}

/**
 * Returns the operations object from a Paystack client.
 * For v1.9.1+, the client itself uses the grouped structure.
 */
export function getPaystackOps(client?: PaystackClientLike): PaystackClientLike | undefined {
  return client;
}

interface ChargeAuthorizationPayload {
  email: string;
  amount: number;
  authorization_code: string;
  reference: string;
  metadata?: string;
}

interface CreateSubscriptionPayload {
  customer: string;
  plan: string;
  authorization?: string;
  start_date?: string;
}

export interface PaystackAdapter {
  initializeTransaction(
    body: components["schemas"]["TransactionInitialize"],
  ): Promise<components["schemas"]["TransactionInitializeResponse"]["data"]>;
  verifyTransaction(reference: string): Promise<unknown>;
  chargeAuthorization(body: ChargeAuthorizationPayload): Promise<unknown>;
  createCustomer(body: CustomerCreatePayload): Promise<unknown>;
  fetchCustomer(emailOrCode: string): Promise<unknown>;
  updateCustomer(
    emailOrCode: string,
    body: CustomerUpdatePayload & { email?: string },
  ): Promise<unknown>;
  listProducts(): Promise<components["schemas"]["ProductListsResponseArray"][]>;
  fetchProduct(productId: number): Promise<unknown>;
  listPlans(): Promise<components["schemas"]["PlanListResponseArray"][]>;
  createSubscription(body: CreateSubscriptionPayload): Promise<unknown>;
  fetchSubscription(subscriptionCode: string): Promise<unknown>;
  disableSubscription(body: { code: string; token: string }): Promise<unknown>;
  enableSubscription(body: { code: string; token: string }): Promise<unknown>;
  manageSubscriptionLink(subscriptionCode: string): Promise<{ link: string }>;
}

export function createPaystackAdapter(client?: PaystackClientLike): PaystackAdapter {
  const requireClient = (): PaystackClientLike => {
    if (client === undefined || client === null) {
      throw new APIError("BAD_REQUEST", { message: "Paystack client is not configured" });
    }
    return client;
  };

  return {
    async initializeTransaction(
      body: components["schemas"]["TransactionInitialize"],
    ): Promise<components["schemas"]["TransactionInitializeResponse"]["data"]> {
      const raw = await requireClient().transaction?.initialize({ body });
      return unwrapSdkResult<components["schemas"]["TransactionInitializeResponse"]["data"]>(raw);
    },
    async verifyTransaction(reference: string): Promise<unknown> {
      const raw = await requireClient().transaction?.verify(reference);
      return unwrapSdkResult(raw);
    },
    async chargeAuthorization(body: ChargeAuthorizationPayload): Promise<unknown> {
      const raw = await requireClient().transaction?.chargeAuthorization({ body });
      return unwrapSdkResult(raw);
    },
    async createCustomer(body: CustomerCreatePayload): Promise<unknown> {
      const raw = await requireClient().customer?.create({ body });
      return unwrapSdkResult(raw);
    },
    async fetchCustomer(emailOrCode: string): Promise<unknown> {
      const raw = await requireClient().customer?.fetch(emailOrCode);
      return unwrapSdkResult(raw);
    },
    async updateCustomer(
      emailOrCode: string,
      body: CustomerUpdatePayload & { email?: string },
    ): Promise<unknown> {
      const raw = await requireClient().customer?.update(emailOrCode, {
        body: body,
      });
      return unwrapSdkResult(raw);
    },
    async listProducts(): Promise<components["schemas"]["ProductListsResponseArray"][]> {
      const raw = await requireClient().product?.list({});
      return unwrapSdkResult<components["schemas"]["ProductListsResponseArray"][]>(raw);
    },
    async fetchProduct(productId: number): Promise<unknown> {
      const raw = await requireClient().product?.fetch(productId);
      return unwrapSdkResult(raw);
    },
    async listPlans(): Promise<components["schemas"]["PlanListResponseArray"][]> {
      const raw = await requireClient().plan?.list();
      return unwrapSdkResult<components["schemas"]["PlanListResponseArray"][]>(raw);
    },
    async createSubscription(body: CreateSubscriptionPayload): Promise<unknown> {
      const raw = await requireClient().subscription?.create({ body });
      return unwrapSdkResult(raw);
    },
    async fetchSubscription(subscriptionCode: string): Promise<unknown> {
      const raw = await requireClient().subscription?.fetch(subscriptionCode);
      return unwrapSdkResult(raw);
    },
    async disableSubscription(body: { code: string; token: string }): Promise<unknown> {
      const raw = await requireClient().subscription?.disable({ body });
      return unwrapSdkResult(raw);
    },
    async enableSubscription(body: { code: string; token: string }): Promise<unknown> {
      const raw = await requireClient().subscription?.enable({ body });
      return unwrapSdkResult(raw);
    },
    async manageSubscriptionLink(subscriptionCode: string): Promise<{ link: string }> {
      const raw = await requireClient().subscription?.manageLink(subscriptionCode);
      return unwrapSdkResult<{ link: string }>(raw);
    },
  };
}
