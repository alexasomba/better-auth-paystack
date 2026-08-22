import type { GenericEndpointContext } from "better-auth";

import { PAYSTACK_MODELS } from "./models";
import type {
  Member,
  PaystackCustomer,
  PaystackOrganization,
  PaystackPlan,
  PaystackProduct,
  PaystackTransaction,
  PaystackWebhookEventRecord,
  Subscription,
  User,
} from "./types";

type Adapter = GenericEndpointContext["context"]["adapter"];
type WhereValue = string | number | boolean | null;
type WhereClause = { field: string; value: WhereValue }[];

export interface BillingStore {
  findSubscriptionById(id: string): Promise<Subscription | null>;
  findSubscriptionByCode(subscriptionCode: string): Promise<Subscription | null>;
  findSubscriptionsByReference(referenceId: string): Promise<Subscription[]>;
  findCurrentSubscription(
    referenceId: string,
    groupId?: string | null,
  ): Promise<Subscription | null>;
  retireCompetingSubscriptions(
    referenceId: string,
    groupId: string | null,
    exceptId: string,
  ): Promise<void>;
  findSubscriptionsByTransactionReference(reference: string): Promise<Subscription[]>;
  createSubscription(data: Partial<Subscription> & Record<string, unknown>): Promise<Subscription>;
  updateSubscription(
    id: string,
    update: Partial<Subscription> & Record<string, unknown>,
  ): Promise<Subscription | null>;
  updateSubscriptionByCode(
    subscriptionCode: string,
    update: Partial<Subscription> & Record<string, unknown>,
  ): Promise<Subscription | null>;
  findCustomerByReference(
    referenceType: "user" | "organization",
    referenceId: string,
  ): Promise<PaystackCustomer | null>;
  findCustomerByCode(customerCode: string): Promise<PaystackCustomer | null>;
  saveCustomer(
    referenceType: "user" | "organization",
    referenceId: string,
    customerCode: string,
    email?: string | null,
  ): Promise<PaystackCustomer>;
  createTransaction(
    data: Partial<PaystackTransaction> & Record<string, unknown>,
  ): Promise<PaystackTransaction>;
  findTransactionByReference(reference: string): Promise<PaystackTransaction | null>;
  updateTransactionByReference(
    reference: string,
    update: Partial<PaystackTransaction> & Record<string, unknown>,
  ): Promise<PaystackTransaction | null>;
  createWebhookEvent(
    data: Partial<PaystackWebhookEventRecord> & Record<string, unknown>,
  ): Promise<PaystackWebhookEventRecord>;
  findWebhookEvent(eventId: string): Promise<PaystackWebhookEventRecord | null>;
  updateWebhookEvent(
    eventId: string,
    update: Partial<PaystackWebhookEventRecord> & Record<string, unknown>,
  ): Promise<PaystackWebhookEventRecord | null>;
  listTransactions(referenceId: string): Promise<PaystackTransaction[]>;
  listProducts(): Promise<PaystackProduct[]>;
  findProductByName(name: string): Promise<PaystackProduct | null>;
  findProductBySlug(slug: string): Promise<PaystackProduct | null>;
  updateProduct(
    id: string,
    update: Partial<PaystackProduct> & Record<string, unknown>,
  ): Promise<void>;
  upsertProductByPaystackId(
    paystackId: string,
    data: Partial<PaystackProduct> & Record<string, unknown>,
  ): Promise<void>;
  listPlans(): Promise<PaystackPlan[]>;
  findPlanByName(name: string): Promise<PaystackPlan | null>;
  findPlanByCode(planCode: string): Promise<PaystackPlan | null>;
  upsertPlanByPaystackId(
    paystackId: string,
    data: Partial<PaystackPlan> & Record<string, unknown>,
  ): Promise<void>;
  findUser(id: string): Promise<User | null>;
  findOrganization(id: string): Promise<PaystackOrganization | null>;
  findOrganizationOwner(organizationId: string): Promise<Member | null>;
  listMembers(organizationId: string): Promise<Member[]>;
  listTeams(organizationId: string): Promise<unknown[]>;
  saveCustomerCode(
    referenceId: string,
    customerCode: string,
    isOrganization: boolean,
    email?: string | null,
  ): Promise<void>;
}

function sortSubscriptionsForCurrent(subscriptions: Subscription[]): Subscription[] {
  const statusRank = new Map([
    ["active", 0],
    ["trialing", 1],
    ["incomplete", 2],
    ["past_due", 3],
    ["canceled", 4],
  ]);

  return [...subscriptions].sort((a, b) => {
    const rankA = statusRank.get(a.status) ?? 99;
    const rankB = statusRank.get(b.status) ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function createBillingStore(ctx: GenericEndpointContext): BillingStore {
  return createBillingStoreFromAdapter(ctx.context.adapter);
}

export function createBillingStoreFromAdapter(adapter: Adapter): BillingStore {
  const findOne = async <T>(model: string, where: WhereClause): Promise<T | null> => {
    try {
      return (await adapter.findOne<T>({ model, where })) ?? null;
    } catch {
      // Adapters such as the in-memory adapter create provider tables lazily.
      return null;
    }
  };

  const findMany = async <T>(model: string, where?: WhereClause): Promise<T[]> => {
    try {
      return (await adapter.findMany<T>({ model, ...(where ? { where } : {}) })) ?? [];
    } catch {
      return [];
    }
  };

  return {
    findSubscriptionById: (id) =>
      findOne<Subscription>(PAYSTACK_MODELS.subscription, [{ field: "id", value: id }]),
    findSubscriptionByCode: (subscriptionCode) =>
      findOne<Subscription>(PAYSTACK_MODELS.subscription, [
        { field: "subscriptionCode", value: subscriptionCode },
      ]),
    findSubscriptionsByReference: (referenceId) =>
      findMany<Subscription>(PAYSTACK_MODELS.subscription, [
        { field: "referenceId", value: referenceId },
      ]),
    async findCurrentSubscription(referenceId, groupId) {
      const subscriptions = await this.findSubscriptionsByReference(referenceId);
      const scoped =
        groupId === undefined
          ? subscriptions
          : subscriptions.filter((subscription) =>
              groupId === null
                ? subscription.groupId === undefined ||
                  subscription.groupId === null ||
                  subscription.groupId === ""
                : subscription.groupId === groupId,
            );
      return sortSubscriptionsForCurrent(scoped)[0] ?? null;
    },
    async retireCompetingSubscriptions(referenceId, groupId, exceptId) {
      const subscriptions = await this.findSubscriptionsByReference(referenceId);
      const competitors = subscriptions.filter(
        (subscription) =>
          subscription.id !== exceptId &&
          (subscription.status === "active" || subscription.status === "trialing") &&
          (groupId === null
            ? subscription.groupId === undefined ||
              subscription.groupId === null ||
              subscription.groupId === ""
            : subscription.groupId === groupId),
      );
      const now = new Date();
      for (const subscription of competitors) {
        await this.updateSubscription(subscription.id, {
          status: "canceled",
          cancelAtPeriodEnd: false,
          canceledAt: now,
          endedAt: now,
          updatedAt: now,
        });
      }
    },
    findSubscriptionsByTransactionReference: (reference) =>
      findMany<Subscription>(PAYSTACK_MODELS.subscription, [
        { field: "transactionReference", value: reference },
      ]),
    createSubscription: async (data) =>
      await adapter.create({
        model: PAYSTACK_MODELS.subscription,
        data: data as Omit<Subscription, "id">,
      }),
    updateSubscription: (id, update) =>
      adapter.update<Subscription>({
        model: PAYSTACK_MODELS.subscription,
        update,
        where: [{ field: "id", value: id }],
      }),
    updateSubscriptionByCode: (subscriptionCode, update) =>
      adapter.update<Subscription>({
        model: PAYSTACK_MODELS.subscription,
        update,
        where: [{ field: "subscriptionCode", value: subscriptionCode }],
      }),
    createTransaction: async (data) =>
      await adapter.create({
        model: PAYSTACK_MODELS.transaction,
        data: data as Omit<PaystackTransaction, "id">,
      }),
    findTransactionByReference: (reference) =>
      findOne<PaystackTransaction>(PAYSTACK_MODELS.transaction, [
        { field: "reference", value: reference },
      ]),
    updateTransactionByReference: (reference, update) =>
      adapter.update<PaystackTransaction>({
        model: PAYSTACK_MODELS.transaction,
        update,
        where: [{ field: "reference", value: reference }],
      }),
    createWebhookEvent: (data) =>
      adapter.create({
        model: PAYSTACK_MODELS.webhookEvent,
        data,
      }),
    findWebhookEvent: (eventId) =>
      findOne<PaystackWebhookEventRecord>(PAYSTACK_MODELS.webhookEvent, [
        { field: "eventId", value: eventId },
      ]),
    updateWebhookEvent: (eventId, update) =>
      adapter.update<PaystackWebhookEventRecord>({
        model: PAYSTACK_MODELS.webhookEvent,
        update,
        where: [{ field: "eventId", value: eventId }],
      }),
    async listTransactions(referenceId) {
      const transactions = await findMany<PaystackTransaction>(PAYSTACK_MODELS.transaction, [
        { field: "referenceId", value: referenceId },
      ]);
      return transactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async listProducts() {
      const products = await findMany<PaystackProduct>(PAYSTACK_MODELS.product);
      return products.sort((a, b) => a.name.localeCompare(b.name));
    },
    findProductByName: (name) =>
      findOne<PaystackProduct>(PAYSTACK_MODELS.product, [{ field: "name", value: name }]),
    findProductBySlug: (slug) =>
      findOne<PaystackProduct>(PAYSTACK_MODELS.product, [{ field: "slug", value: slug }]),
    async updateProduct(id, update) {
      await adapter.update({
        model: PAYSTACK_MODELS.product,
        update,
        where: [{ field: "id", value: id }],
      });
    },
    async upsertProductByPaystackId(paystackId, data) {
      const existing = await findOne<PaystackProduct>(PAYSTACK_MODELS.product, [
        { field: "paystackId", value: paystackId },
      ]);
      if (existing?.id !== undefined) {
        const { createdAt: _createdAt, ...update } = data;
        await adapter.update({
          model: PAYSTACK_MODELS.product,
          update,
          where: [{ field: "id", value: String(existing.id) }],
        });
        return;
      }
      await adapter.create({ model: PAYSTACK_MODELS.product, data });
    },
    listPlans: () => findMany<PaystackPlan>(PAYSTACK_MODELS.plan),
    findPlanByName: (name) =>
      findOne<PaystackPlan>(PAYSTACK_MODELS.plan, [{ field: "name", value: name }]),
    findPlanByCode: (planCode) =>
      findOne<PaystackPlan>(PAYSTACK_MODELS.plan, [{ field: "planCode", value: planCode }]),
    async upsertPlanByPaystackId(paystackId, data) {
      const existing = await findOne<PaystackPlan>(PAYSTACK_MODELS.plan, [
        { field: "paystackId", value: paystackId },
      ]);
      if (existing?.id !== undefined) {
        const { createdAt: _createdAt, ...update } = data;
        await adapter.update({
          model: PAYSTACK_MODELS.plan,
          update,
          where: [{ field: "id", value: existing.id }],
        });
        return;
      }
      await adapter.create({ model: PAYSTACK_MODELS.plan, data });
    },
    findUser: (id) => findOne<User>("user", [{ field: "id", value: id }]),
    findOrganization: (id) =>
      findOne<PaystackOrganization>("organization", [{ field: "id", value: id }]),
    findOrganizationOwner: (organizationId) =>
      findOne<Member>("member", [
        { field: "organizationId", value: organizationId },
        { field: "role", value: "owner" },
      ]),
    listMembers: (organizationId) =>
      findMany<Member>("member", [{ field: "organizationId", value: organizationId }]),
    listTeams: (organizationId) =>
      findMany("team", [{ field: "organizationId", value: organizationId }]),
    findCustomerByReference: (referenceType, referenceId) =>
      findOne<PaystackCustomer>(PAYSTACK_MODELS.customer, [
        { field: "referenceKey", value: `${referenceType}:${referenceId}` },
      ]),
    findCustomerByCode: (customerCode) =>
      findOne<PaystackCustomer>(PAYSTACK_MODELS.customer, [
        { field: "customerCode", value: customerCode },
      ]),
    async saveCustomer(referenceType, referenceId, customerCode, email) {
      const referenceKey = `${referenceType}:${referenceId}`;
      const existing = await findOne<PaystackCustomer>(PAYSTACK_MODELS.customer, [
        { field: "referenceKey", value: referenceKey },
      ]);
      const now = new Date();
      const hasEmail = email !== undefined && email !== null && email !== "";
      if (existing) {
        const updated = await adapter.update<PaystackCustomer>({
          model: PAYSTACK_MODELS.customer,
          update: { customerCode, ...(hasEmail ? { email } : {}), updatedAt: now },
          where: [{ field: "id", value: existing.id }],
        });
        return (
          updated ?? { ...existing, customerCode, email: email ?? existing.email, updatedAt: now }
        );
      }
      return adapter.create({
        model: PAYSTACK_MODELS.customer,
        data: {
          referenceType,
          referenceId,
          referenceKey,
          customerCode,
          ...(hasEmail ? { email } : {}),
          createdAt: now,
          updatedAt: now,
        },
      });
    },
    async saveCustomerCode(referenceId, customerCode, isOrganization, email) {
      await this.saveCustomer(
        isOrganization ? "organization" : "user",
        referenceId,
        customerCode,
        email,
      );
    },
  };
}
