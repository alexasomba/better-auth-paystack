/* oxlint-disable no-restricted-imports */
import { z } from "zod";

export const enableDisableBodySchema: z.ZodObject<{
  referenceId: z.ZodOptional<z.ZodString>;
  subscriptionCode: z.ZodString;
  emailToken: z.ZodOptional<z.ZodString>;
  atPeriodEnd: z.ZodOptional<z.ZodBoolean>;
}> = z.object({
  referenceId: z.string().optional(),
  subscriptionCode: z.string(),
  emailToken: z.string().optional(),
  atPeriodEnd: z.boolean().optional(),
});

export function decodeBase64UrlToString(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  const binaryString = atob(padded);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function tryGetEmailTokenFromSubscriptionManageLink(link: string): string | undefined {
  try {
    const url = new URL(link);
    const subscriptionToken = url.searchParams.get("subscription_token");
    if (subscriptionToken === undefined || subscriptionToken === null || subscriptionToken === "")
      return undefined;
    const parts = subscriptionToken.split(".");
    if (parts.length < 2) return undefined;
    const payloadJson = decodeBase64UrlToString(parts[1] ?? "");
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    return typeof payload.email_token === "string" ? payload.email_token : undefined;
  } catch {
    return undefined;
  }
}
