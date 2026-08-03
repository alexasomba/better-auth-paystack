import { createBillingStoreFromAdapter } from "./billing-store";
import { parsePaystackMetadata, stringifyPaystackMetadata } from "./metadata";
import type { PaystackClientLike, PaystackCustomerResponse } from "./types";
import { createPaystackAdapter } from "./paystack-sdk";

interface Logger {
  error(message: string, error?: unknown): void;
}
type Adapter = Parameters<typeof createBillingStoreFromAdapter>[0];

interface BillingReference {
  id: string;
  type: "user" | "organization";
  email: string;
  name?: string | null;
  emailVerified?: boolean;
  paystackCustomerCode?: string | null;
}

function isNotFound(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const candidate = error as Record<string, unknown>;
  return candidate.status === 404 || candidate.statusCode === 404;
}

function customerCode(customer: unknown): string | undefined {
  if (customer === null || typeof customer !== "object") return undefined;
  const code = (customer as Record<string, unknown>).customer_code;
  return typeof code === "string" && code !== "" ? code : undefined;
}

function ownsCustomer(customer: unknown, reference: BillingReference): boolean {
  if (customer === null || typeof customer !== "object") return false;
  const metadata = parsePaystackMetadata((customer as Record<string, unknown>).metadata);
  const expectedIdKey = reference.type === "user" ? "userId" : "organizationId";
  const otherIdKey = reference.type === "user" ? "organizationId" : "userId";
  return (
    metadata[expectedIdKey] === reference.id &&
    metadata[otherIdKey] === undefined &&
    (metadata.customerType === undefined || metadata.customerType === reference.type)
  );
}

function hasOwner(customer: unknown): boolean {
  if (customer === null || typeof customer !== "object") return false;
  const metadata = parsePaystackMetadata((customer as Record<string, unknown>).metadata);
  return (
    typeof metadata.userId === "string" ||
    typeof metadata.organizationId === "string" ||
    typeof metadata.customerType === "string"
  );
}

function ownershipMetadata(reference: BillingReference, existing?: unknown): string | undefined {
  return stringifyPaystackMetadata({
    ...parsePaystackMetadata(existing),
    customerType: reference.type,
    ...(reference.type === "user" ? { userId: reference.id } : { organizationId: reference.id }),
  });
}

export async function resolvePaystackCustomer(input: {
  adapter: Adapter;
  client: PaystackClientLike;
  logger: Logger;
  reference: BillingReference;
  createParams?: Record<string, unknown>;
}): Promise<{ customer: PaystackCustomerResponse; created: boolean } | null> {
  const { adapter, client, logger, reference } = input;
  const store = createBillingStoreFromAdapter(adapter);
  const persisted = await store.findCustomerByReference(reference.type, reference.id);
  let legacyCode: string | undefined;
  try {
    const legacy = await adapter.findOne<{ paystackCustomerCode?: string | null }>({
      model: reference.type,
      where: [{ field: "id", value: reference.id }],
      select: ["paystackCustomerCode"],
    });
    legacyCode = legacy?.paystackCustomerCode ?? undefined;
  } catch {
    // The legacy column is optional after the v4 schema migration.
  }
  const existingCode = reference.paystackCustomerCode ?? persisted?.customerCode ?? legacyCode;
  if (typeof existingCode === "string" && existingCode !== "") {
    if (persisted === null) {
      await store.saveCustomer(reference.type, reference.id, existingCode, reference.email);
    }
    return null;
  }

  const sdk = createPaystackAdapter(client);
  let existing: PaystackCustomerResponse | null = null;
  if (typeof client.customer?.fetch === "function") {
    try {
      existing =
        ((await sdk.fetchCustomer(reference.email)) as PaystackCustomerResponse | undefined) ??
        null;
    } catch (error: unknown) {
      if (!isNotFound(error)) {
        logger.error("Failed to look up Paystack customer; customer creation was skipped", error);
        return null;
      }
    }
  }

  if (existing !== null) {
    const code = customerCode(existing);
    if (code === undefined) {
      logger.error("Paystack customer lookup returned no customer code");
      return null;
    }

    const owned = ownsCustomer(existing, reference);
    const canClaimLegacy =
      reference.type === "user" && reference.emailVerified === true && !hasOwner(existing);
    if (!owned && !canClaimLegacy) {
      logger.error("Paystack customer belongs to another billing reference");
      return null;
    }

    const existingMetadata = (existing as unknown as Record<string, unknown>).metadata;
    if (canClaimLegacy || parsePaystackMetadata(existingMetadata).customerType !== reference.type) {
      await sdk.updateCustomer(code, {
        metadata: ownershipMetadata(reference, existingMetadata),
      });
    }
    await store.saveCustomer(reference.type, reference.id, code, reference.email);
    return { customer: existing, created: false };
  }

  const customer = (await sdk.createCustomer({
    ...input.createParams,
    email: reference.email,
    first_name: reference.name ?? undefined,
    metadata: ownershipMetadata(reference),
  })) as PaystackCustomerResponse;
  const code = customerCode(customer);
  if (code === undefined) return null;
  await store.saveCustomer(reference.type, reference.id, code, reference.email);
  return { customer, created: true };
}
