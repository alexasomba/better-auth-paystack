import { defineErrorCodes } from "better-auth";
import type { RawError } from "better-auth";

import type { AnyPaystackOptions, PaystackCheckoutChannel } from "../types";

export const PAYSTACK_ERROR_CODES: {
  SUBSCRIPTION_NOT_FOUND: RawError<"SUBSCRIPTION_NOT_FOUND">;
  SUBSCRIPTION_PLAN_NOT_FOUND: RawError<"SUBSCRIPTION_PLAN_NOT_FOUND">;
  UNABLE_TO_CREATE_CUSTOMER: RawError<"UNABLE_TO_CREATE_CUSTOMER">;
  FAILED_TO_INITIALIZE_TRANSACTION: RawError<"FAILED_TO_INITIALIZE_TRANSACTION">;
  FAILED_TO_VERIFY_TRANSACTION: RawError<"FAILED_TO_VERIFY_TRANSACTION">;
  FAILED_TO_DISABLE_SUBSCRIPTION: RawError<"FAILED_TO_DISABLE_SUBSCRIPTION">;
  FAILED_TO_ENABLE_SUBSCRIPTION: RawError<"FAILED_TO_ENABLE_SUBSCRIPTION">;
  EMAIL_VERIFICATION_REQUIRED: RawError<"EMAIL_VERIFICATION_REQUIRED">;
  SUBSCRIPTION_PAYMENT_CHANNEL_NOT_ALLOWED: RawError<"SUBSCRIPTION_PAYMENT_CHANNEL_NOT_ALLOWED">;
} = defineErrorCodes({
  SUBSCRIPTION_NOT_FOUND: "Subscription not found",
  SUBSCRIPTION_PLAN_NOT_FOUND: "Subscription plan not found",
  UNABLE_TO_CREATE_CUSTOMER: "Unable to create customer",
  FAILED_TO_INITIALIZE_TRANSACTION: "Failed to initialize transaction",
  FAILED_TO_VERIFY_TRANSACTION: "Failed to verify transaction",
  FAILED_TO_DISABLE_SUBSCRIPTION: "Failed to disable subscription",
  FAILED_TO_ENABLE_SUBSCRIPTION: "Failed to enable subscription",
  EMAIL_VERIFICATION_REQUIRED: "Email verification is required before you can subscribe to a plan",
  SUBSCRIPTION_PAYMENT_CHANNEL_NOT_ALLOWED:
    "This subscription only supports specific payment channels",
});

export function getAllowedSubscriptionChannels(
  options: AnyPaystackOptions,
): PaystackCheckoutChannel[] | undefined {
  const channels = options.subscription?.allowedPaymentChannels;
  return Array.isArray(channels) && channels.length > 0 ? channels : undefined;
}

export async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(message);

  const crypto = globalThis.crypto;
  if (crypto !== undefined && crypto !== null && "subtle" in crypto) {
    const subtle = crypto.subtle;
    const key = await subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-512" }, false, [
      "sign",
    ]);
    const signature = await subtle.sign("HMAC", key, msgData);
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  const { createHmac } = await import("node:crypto");
  return createHmac("sha512", secret).update(message).digest("hex");
}
