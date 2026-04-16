import { APIError } from "better-auth/api";
import type { PaystackClientLike } from "./types";

/**
 * Interface for checking if a result is a PaystackResponse from the SDK v1.9.1+
 */
interface PaystackResponseLike {
  unwrap: () => unknown;
  status: boolean;
  message: string;
  raw?: Record<string, unknown>;
  error?: Record<string, unknown>;
}

function IsPaystackResponse(value: unknown): value is PaystackResponseLike {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === "object" &&
    "unwrap" in value &&
    typeof (value as Record<string, unknown>).unwrap === "function"
  );
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

  // Fallback for older SDK versions or custom data
  if (result !== null && result !== undefined && typeof result === "object") {
    const body = result as Record<string, unknown>;
    if ("data" in body && body.data !== undefined) {
      return body.data as T;
    }
    if (body.status === false) {
      throw new APIError("BAD_REQUEST", {
        message: (body.message as string | undefined) ?? "Paystack API error",
      });
    }
  }

  return result as T;
}

/**
 * Returns the operations object from a Paystack client.
 * For v1.9.1+, the client itself uses the grouped structure.
 */
export function getPaystackOps(client?: PaystackClientLike): PaystackClientLike | undefined {
  return client;
}
