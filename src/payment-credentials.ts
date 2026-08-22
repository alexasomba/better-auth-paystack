import type { createBillingStoreFromAdapter } from "./billing-store";
import {
  decryptPaystackCredential,
  encryptPaystackCredential,
  resolveCredentialEncryptionKey,
} from "./credential-crypto";
import { PAYSTACK_MODELS } from "./models";
import type { PaystackOptions } from "./types";

type Adapter = Parameters<typeof createBillingStoreFromAdapter>[0];

interface StoredPaymentCredential {
  id: string;
  subscriptionId: string;
  authorizationCodeEncrypted?: string | null;
  emailTokenEncrypted?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaystackPaymentCredentialValues {
  authorizationCode?: string | null;
  emailToken?: string | null;
}

export async function readPaystackPaymentCredentials(
  adapter: Adapter,
  options: PaystackOptions,
  subscriptionId: string,
): Promise<PaystackPaymentCredentialValues | null> {
  let row: StoredPaymentCredential | null;
  try {
    row = await adapter.findOne<StoredPaymentCredential>({
      model: PAYSTACK_MODELS.paymentCredential,
      where: [{ field: "subscriptionId", value: subscriptionId }],
    });
  } catch {
    return null;
  }
  if (!row) return null;
  const key = resolveCredentialEncryptionKey(options);
  const authorizationCodeEncrypted = row.authorizationCodeEncrypted;
  const emailTokenEncrypted = row.emailTokenEncrypted;
  return {
    authorizationCode:
      typeof authorizationCodeEncrypted === "string" && authorizationCodeEncrypted !== ""
        ? decryptPaystackCredential(authorizationCodeEncrypted, key)
        : undefined,
    emailToken:
      typeof emailTokenEncrypted === "string" && emailTokenEncrypted !== ""
        ? decryptPaystackCredential(emailTokenEncrypted, key)
        : undefined,
  };
}

export async function savePaystackPaymentCredentials(
  adapter: Adapter,
  options: PaystackOptions,
  subscriptionId: string,
  values: PaystackPaymentCredentialValues,
): Promise<void> {
  const authorizationCode = values.authorizationCode ?? undefined;
  const emailToken = values.emailToken ?? undefined;
  if (authorizationCode === undefined && emailToken === undefined) return;
  const key = resolveCredentialEncryptionKey(options);
  const now = new Date();
  let existing: StoredPaymentCredential | null = null;
  try {
    existing = await adapter.findOne<StoredPaymentCredential>({
      model: PAYSTACK_MODELS.paymentCredential,
      where: [{ field: "subscriptionId", value: subscriptionId }],
    });
  } catch {
    // Some adapters create provider tables lazily on first write.
  }
  const update = {
    ...(authorizationCode !== undefined
      ? { authorizationCodeEncrypted: encryptPaystackCredential(authorizationCode, key) }
      : {}),
    ...(emailToken !== undefined
      ? { emailTokenEncrypted: encryptPaystackCredential(emailToken, key) }
      : {}),
    updatedAt: now,
  };
  if (existing !== null) {
    await adapter.update({
      model: PAYSTACK_MODELS.paymentCredential,
      update,
      where: [{ field: "id", value: existing.id }],
    });
    return;
  }
  await adapter.create({
    model: PAYSTACK_MODELS.paymentCredential,
    data: {
      subscriptionId,
      ...update,
      createdAt: now,
    },
  });
}

export async function findStoredPaystackPaymentCredential(
  adapter: Adapter,
  subscriptionId: string,
): Promise<StoredPaymentCredential | null> {
  try {
    return (
      (await adapter.findOne<StoredPaymentCredential>({
        model: PAYSTACK_MODELS.paymentCredential,
        where: [{ field: "subscriptionId", value: subscriptionId }],
      })) ?? null
    );
  } catch {
    return null;
  }
}
