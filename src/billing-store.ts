import type { GenericEndpointContext } from "better-auth";

import type {
  Member,
  PaystackOrganization,
  PaystackPlan,
  PaystackProduct,
  PaystackTransaction,
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
  createTransaction(
    data: Partial<PaystackTransaction> & Record<string, unknown>,
  ): Promise<PaystackTransaction>;
  findTransactionByReference(reference: string): Promise<PaystackTransaction | null>;
  updateTransactionByReference(
    reference: string,
    update: Partial<PaystackTransaction> & Record<string, unknown>,
  ): Promise<PaystackTransaction | null>;
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
  const findOne = async <T>(model: string, where: WhereClause): Promise<T | null> =>
    ((await adapter.findOne<T>({ model, where })) ?? null) as T | null;

  const findMany = async <T>(model: string, where?: WhereClause): Promise<T[]> =>
    (await adapter.findMany<T>({ model, ...(where ? { where } : {}) })) ?? [];

  return {
    findSubscriptionById: (id) =>
      findOne<Subscription>("subscription", [{ field: "id", value: id }]),
    findSubscriptionByCode: (subscriptionCode) =>
      findOne<Subscription>("subscription", [
        { field: "paystackSubscriptionCode", value: subscriptionCode },
      ]),
    findSubscriptionsByReference: (referenceId) =>
      findMany<Subscription>("subscription", [{ field: "referenceId", value: referenceId }]),
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
      findMany<Subscription>("subscription", [
        { field: "paystackTransactionReference", value: reference },
      ]),
    createSubscription: async (data) =>
      await adapter.create({
        model: "subscription",
        data: data as Omit<Subscription, "id">,
      }),
    updateSubscription: (id, update) =>
      adapter.update<Subscription>({
        model: "subscription",
        update,
        where: [{ field: "id", value: id }],
      }),
    updateSubscriptionByCode: (subscriptionCode, update) =>
      adapter.update<Subscription>({
        model: "subscription",
        update,
        where: [{ field: "paystackSubscriptionCode", value: subscriptionCode }],
      }),
    createTransaction: async (data) =>
      await adapter.create({
        model: "paystackTransaction",
        data: data as Omit<PaystackTransaction, "id">,
      }),
    findTransactionByReference: (reference) =>
      findOne<PaystackTransaction>("paystackTransaction", [
        { field: "reference", value: reference },
      ]),
    updateTransactionByReference: (reference, update) =>
      adapter.update<PaystackTransaction>({
        model: "paystackTransaction",
        update,
        where: [{ field: "reference", value: reference }],
      }),
    async listTransactions(referenceId) {
      const transactions = await findMany<PaystackTransaction>("paystackTransaction", [
        { field: "referenceId", value: referenceId },
      ]);
      return transactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async listProducts() {
      const products = await findMany<PaystackProduct>("paystackProduct");
      return products.sort((a, b) => a.name.localeCompare(b.name));
    },
    findProductByName: (name) =>
      findOne<PaystackProduct>("paystackProduct", [{ field: "name", value: name }]),
    findProductBySlug: (slug) =>
      findOne<PaystackProduct>("paystackProduct", [{ field: "slug", value: slug }]),
    async updateProduct(id, update) {
      await adapter.update({
        model: "paystackProduct",
        update,
        where: [{ field: "id", value: id }],
      });
    },
    async upsertProductByPaystackId(paystackId, data) {
      const existing = await findOne<PaystackProduct>("paystackProduct", [
        { field: "paystackId", value: paystackId },
      ]);
      if (existing?.id !== undefined) {
        const { createdAt: _createdAt, ...update } = data;
        await adapter.update({
          model: "paystackProduct",
          update,
          where: [{ field: "id", value: String(existing.id) }],
        });
        return;
      }
      await adapter.create({ model: "paystackProduct", data });
    },
    listPlans: () => findMany<PaystackPlan>("paystackPlan"),
    findPlanByName: (name) =>
      findOne<PaystackPlan>("paystackPlan", [{ field: "name", value: name }]),
    findPlanByCode: (planCode) =>
      findOne<PaystackPlan>("paystackPlan", [{ field: "planCode", value: planCode }]),
    async upsertPlanByPaystackId(paystackId, data) {
      const existing = await findOne<PaystackPlan>("paystackPlan", [
        { field: "paystackId", value: paystackId },
      ]);
      if (existing?.id !== undefined) {
        const { createdAt: _createdAt, ...update } = data;
        await adapter.update({
          model: "paystackPlan",
          update,
          where: [{ field: "id", value: existing.id }],
        });
        return;
      }
      await adapter.create({ model: "paystackPlan", data });
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
    async saveCustomerCode(referenceId, customerCode, isOrganization) {
      await adapter.update({
        model: isOrganization ? "organization" : "user",
        update: { paystackCustomerCode: customerCode },
        where: [{ field: "id", value: referenceId }],
      });
    },
  };
}
