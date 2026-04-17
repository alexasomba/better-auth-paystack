import { APIError } from "better-auth/api";
import { PaystackResponse } from "@alexasomba/paystack-node";
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
