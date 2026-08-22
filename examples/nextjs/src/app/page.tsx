"use client";

import type {
  PaystackInitializeResult,
  PaystackPlan,
  PaystackProduct,
  Subscription,
} from "better-auth-paystack";
import { useCallback, useEffect, useMemo, useState } from "react";

import { createClient } from "../lib/auth-client";

type JsonRecord = Record<string, unknown>;

function pretty(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function responseData<T>(value: unknown): T | null {
  if (typeof value === "object" && value !== null && "data" in value) {
    return (value as { data?: T }).data ?? null;
  }
  return value as T;
}

function checkoutResult(value: unknown): PaystackInitializeResult | null {
  const result = responseData<PaystackInitializeResult>(value);
  return result !== null && typeof result === "object" ? result : null;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function Home() {
  const baseURL = useMemo(() => {
    if (typeof window === "undefined") return "http://localhost:3000";
    return window.location.origin;
  }, []);
  const authClient = useMemo(() => createClient(baseURL), [baseURL]);

  const [log, setLog] = useState("");
  const [session, setSession] = useState<unknown>(null);
  const [organizations, setOrganizations] = useState<JsonRecord[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [transactions, setTransactions] = useState<JsonRecord[]>([]);
  const [plans, setPlans] = useState<PaystackPlan[]>([]);
  const [products, setProducts] = useState<PaystackProduct[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState("personal");

  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("password");
  const [name, setName] = useState("Demo User");
  const [organizationName, setOrganizationName] = useState("Demo Organization");
  const [organizationSlug, setOrganizationSlug] = useState("demo-organization");
  const [planName, setPlanName] = useState("starter");
  const [quantity, setQuantity] = useState(1);
  const [reference, setReference] = useState("");
  const [subscriptionCode, setSubscriptionCode] = useState("");
  const [emailToken, setEmailToken] = useState("");
  const [renewalSubscriptionId, setRenewalSubscriptionId] = useState("");
  const [loading, setLoading] = useState(false);

  const append = useCallback((title: string, value: unknown) => {
    const entry = `# ${title}\n${pretty(value)}\n`;
    setLog((previous) => (previous === "" ? entry : `${entry}\n${previous}`));
  }, []);

  const safeCall = useCallback(
    async (title: string, fn: () => Promise<unknown>) => {
      try {
        const result = await fn();
        append(title, result);
        return result;
      } catch (error: unknown) {
        append(`${title} (error)`, { error: getErrorMessage(error, "Request failed") });
        throw error;
      }
    },
    [append],
  );

  const loadDashboard = useCallback(async () => {
    const query = activeOrganizationId === "personal" ? {} : { referenceId: activeOrganizationId };
    const [sessionResult, organizationResult, configResult, subscriptionResult, transactionResult] =
      await Promise.all([
        authClient.getSession(),
        authClient.organization.list(),
        authClient.paystack.config(),
        authClient.paystack.subscription.list({ query }),
        authClient.paystack.transaction.list({ query }),
      ]);

    setSession(sessionResult);
    setOrganizations(Array.isArray(organizationResult.data) ? organizationResult.data : []);
    const config = responseData<{ plans?: PaystackPlan[]; products?: PaystackProduct[] }>(
      configResult,
    );
    setPlans(config?.plans ?? []);
    setProducts(config?.products ?? []);
    const subscriptionData = responseData<{ subscriptions?: Subscription[] }>(subscriptionResult);
    setSubscriptions(subscriptionData?.subscriptions ?? []);
    const transactionData = responseData<{ transactions?: JsonRecord[] }>(transactionResult);
    setTransactions(transactionData?.transactions ?? []);
  }, [activeOrganizationId, authClient]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReference(params.get("reference") ?? params.get("trxref") ?? "");
    void loadDashboard().catch((error: unknown) => append("load dashboard (error)", error));
  }, [append, loadDashboard]);

  const initializeCheckout = async (payload: JsonRecord, title: string) => {
    setLoading(true);
    try {
      const result = await safeCall(title, () =>
        authClient.paystack.transaction.initialize({
          ...payload,
          callbackURL: `${window.location.origin}/billing/paystack/callback`,
        }),
      );
      const checkout = checkoutResult(result);
      if (checkout?.kind === "checkout") {
        window.location.assign(checkout.url);
      }
      if (checkout?.kind === "scheduled" || checkout?.kind === "prorated") {
        await loadDashboard();
      }
    } finally {
      setLoading(false);
    }
  };

  const signInAnonymously = async () => {
    await safeCall("signIn.anonymous", () => authClient.signIn.anonymous());
    await loadDashboard();
  };

  const signUp = async () => {
    await safeCall("signUp.email", () => authClient.signUp.email({ email, password, name }));
    await loadDashboard();
  };

  const signIn = async () => {
    await safeCall("signIn.email", () => authClient.signIn.email({ email, password }));
    await loadDashboard();
  };

  const createOrganization = async () => {
    const result = await safeCall("organization.create", () =>
      authClient.organization.create({ name: organizationName, slug: organizationSlug }),
    );
    const created = responseData<{ id?: string }>(result);
    if (created?.id !== undefined) setActiveOrganizationId(created.id);
    await loadDashboard();
  };

  const syncCatalog = async (action: "sync-products" | "sync-plans") => {
    const result = await fetch("/api/billing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await result.json();
    append(action, data);
    if (!result.ok) throw new Error(data.error ?? "Catalog sync failed");
    await loadDashboard();
  };

  const verify = async () => {
    if (reference === "") throw new Error("Missing transaction reference");
    await safeCall("paystack.transaction.verify", () =>
      authClient.paystack.transaction.verify({ reference }),
    );
    await loadDashboard();
  };

  const subscription = subscriptions.find(
    (item) =>
      item.subscriptionCode === subscriptionCode ||
      item.paystackSubscriptionCode === subscriptionCode,
  );
  const localRenewalCandidates = subscriptions.filter((item) => {
    const code = item.subscriptionCode ?? item.paystackSubscriptionCode ?? "";
    return code.startsWith("LOC_") || code.startsWith("sub_local_");
  });

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <header>
          <h1 className="text-2xl font-semibold">Better Auth + Paystack billing workbench</h1>
          <p className="mt-2 text-sm text-gray-600">
            Next.js parity example: anonymous auth, organizations, checkout, subscriptions,
            products, transactions, callbacks, and trusted server operations.
          </p>
        </header>

        <section className="grid gap-3 rounded border p-4">
          <h2 className="text-lg font-semibold">Authentication</h2>
          <div className="flex flex-wrap gap-2">
            <button className="rounded border px-3 py-2" onClick={() => void signInAnonymously()}>
              Sign in anonymously
            </button>
            <button className="rounded border px-3 py-2" onClick={() => void signUp()}>
              Sign up with email
            </button>
            <button className="rounded border px-3 py-2" onClick={() => void signIn()}>
              Sign in with email
            </button>
            <button
              className="rounded border px-3 py-2"
              onClick={() =>
                void safeCall("signOut", () => authClient.signOut()).then(loadDashboard)
              }
            >
              Sign out
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              className="rounded border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="rounded border px-3 py-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              className="rounded border px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <pre className="max-h-48 overflow-auto rounded bg-gray-50 p-3 text-xs">
            {pretty(session)}
          </pre>
        </section>

        <section className="grid gap-3 rounded border p-4">
          <h2 className="text-lg font-semibold">Organizations</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              className="rounded border px-3 py-2"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
            />
            <input
              className="rounded border px-3 py-2"
              value={organizationSlug}
              onChange={(e) => setOrganizationSlug(e.target.value)}
            />
            <button className="rounded border px-3 py-2" onClick={() => void createOrganization()}>
              Create organization
            </button>
          </div>
          <select
            className="rounded border px-3 py-2"
            value={activeOrganizationId}
            onChange={(e) => setActiveOrganizationId(e.target.value)}
          >
            <option value="personal">Personal billing</option>
            {organizations.map((organization) => (
              <option key={String(organization.id)} value={String(organization.id)}>
                {String(organization.name ?? organization.slug ?? organization.id)}
              </option>
            ))}
          </select>
          <pre className="max-h-48 overflow-auto rounded bg-gray-50 p-3 text-xs">
            {pretty(organizations)}
          </pre>
        </section>

        <section className="grid gap-3 rounded border p-4">
          <h2 className="text-lg font-semibold">Subscriptions and checkout</h2>
          <div className="flex flex-wrap gap-2">
            {plans.map((item) => (
              <button
                key={item.name}
                className="rounded border px-3 py-2"
                disabled={loading}
                onClick={() =>
                  void initializeCheckout(
                    {
                      plan: item.name,
                      referenceId:
                        activeOrganizationId === "personal" ? undefined : activeOrganizationId,
                      quantity,
                    },
                    `checkout ${item.name}`,
                  )
                }
              >
                Buy {item.name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className="w-32 rounded border px-3 py-2"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="plan"
            />
            <input
              className="w-24 rounded border px-3 py-2"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value) || 1)}
            />
            <button
              className="rounded border px-3 py-2"
              disabled={loading}
              onClick={() =>
                void initializeCheckout(
                  {
                    plan: planName,
                    referenceId:
                      activeOrganizationId === "personal" ? undefined : activeOrganizationId,
                    scheduleAtPeriodEnd: true,
                  },
                  "schedule plan change",
                )
              }
            >
              Schedule change
            </button>
            <button
              className="rounded border px-3 py-2"
              disabled={loading}
              onClick={() =>
                void initializeCheckout(
                  {
                    plan: planName,
                    referenceId:
                      activeOrganizationId === "personal" ? undefined : activeOrganizationId,
                    prorateAndCharge: true,
                    quantity,
                  },
                  "prorated upgrade",
                )
              }
            >
              Upgrade now
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {subscriptions.map((item) => (
              <div key={item.id} className="grid gap-2 rounded border p-3 text-sm">
                <strong>
                  {item.plan} · {item.status}
                </strong>
                <span>
                  {item.subscriptionCode ?? item.paystackSubscriptionCode ?? "local subscription"}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded border px-2 py-1"
                    onClick={() =>
                      setSubscriptionCode(
                        item.subscriptionCode ?? item.paystackSubscriptionCode ?? "",
                      )
                    }
                  >
                    Select
                  </button>
                  {Boolean(item.subscriptionCode ?? item.paystackSubscriptionCode) && (
                    <button
                      className="rounded border px-2 py-1"
                      onClick={() =>
                        void safeCall("subscription.cancel", () =>
                          authClient.paystack.subscription
                            .cancel({
                              subscriptionCode:
                                item.subscriptionCode ?? item.paystackSubscriptionCode ?? "",
                              atPeriodEnd: true,
                            })
                            .then(loadDashboard),
                        )
                      }
                    >
                      Cancel at period end
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className="rounded border px-3 py-2"
              value={subscriptionCode}
              onChange={(e) => setSubscriptionCode(e.target.value)}
              placeholder="subscription code"
            />
            <input
              className="rounded border px-3 py-2"
              value={emailToken}
              onChange={(e) => setEmailToken(e.target.value)}
              placeholder="email token (optional)"
            />
            <button
              className="rounded border px-3 py-2"
              onClick={() =>
                void safeCall("subscription.restore", () =>
                  authClient.paystack.subscription
                    .restore({ subscriptionCode, emailToken: emailToken || undefined })
                    .then(loadDashboard),
                )
              }
            >
              Restore
            </button>
            <button
              className="rounded border px-3 py-2"
              onClick={() =>
                void safeCall("subscription.billingPortal", async () => {
                  const result = await authClient.paystack.subscription.billingPortal({
                    subscriptionCode,
                  });
                  const link = responseData<{ link?: string }>(result)?.link;
                  if (typeof link === "string" && link !== "") window.location.assign(link);
                  return result;
                })
              }
            >
              Billing portal
            </button>
          </div>
          <p className="text-xs text-gray-600">
            Selected subscription: {subscription?.id ?? "none"}
          </p>
        </section>

        <section className="grid gap-3 rounded border p-4">
          <h2 className="text-lg font-semibold">One-time products and catalog sync</h2>
          <div className="flex flex-wrap gap-2">
            {products.map((product) => (
              <button
                key={product.name}
                className="rounded border px-3 py-2"
                disabled={loading}
                onClick={() =>
                  void initializeCheckout(
                    {
                      product: product.name,
                      amount: product.price,
                      currency: product.currency,
                      metadata: product.metadata ?? undefined,
                    },
                    `buy ${product.name}`,
                  )
                }
              >
                Buy {product.name}
              </button>
            ))}
            <button
              className="rounded border px-3 py-2"
              onClick={() => void syncCatalog("sync-products")}
            >
              Sync products
            </button>
            <button
              className="rounded border px-3 py-2"
              onClick={() => void syncCatalog("sync-plans")}
            >
              Sync plans
            </button>
          </div>
          <pre className="max-h-48 overflow-auto rounded bg-gray-50 p-3 text-xs">
            {pretty({ plans, products })}
          </pre>
        </section>

        <section className="grid gap-3 rounded border p-4">
          <h2 className="text-lg font-semibold">Transactions and trusted renewal</h2>
          <div className="flex flex-wrap gap-2">
            <input
              className="rounded border px-3 py-2"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="transaction reference"
            />
            <button className="rounded border px-3 py-2" onClick={() => void verify()}>
              Verify transaction
            </button>
            <select
              className="rounded border px-3 py-2"
              value={renewalSubscriptionId}
              onChange={(e) => setRenewalSubscriptionId(e.target.value)}
            >
              <option value="">Select local renewal</option>
              {localRenewalCandidates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.plan} · {item.id}
                </option>
              ))}
            </select>
            <button
              className="rounded border px-3 py-2"
              onClick={() =>
                void safeCall("charge renewal", async () => {
                  const response = await fetch("/api/billing", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      action: "charge-renewal",
                      subscriptionId: renewalSubscriptionId,
                    }),
                  });
                  const data = await response.json();
                  if (!response.ok) throw new Error(data.error ?? "Renewal failed");
                  await loadDashboard();
                  return data;
                })
              }
            >
              Charge renewal
            </button>
          </div>
          <pre className="max-h-56 overflow-auto rounded bg-gray-50 p-3 text-xs">
            {pretty(transactions)}
          </pre>
        </section>

        <section className="grid gap-2 rounded border p-4">
          <div className="flex justify-between">
            <h2 className="text-lg font-semibold">Request log</h2>
            <button className="rounded border px-3 py-1" onClick={() => setLog("")}>
              Clear
            </button>
          </div>
          <pre className="max-h-72 overflow-auto rounded bg-gray-50 p-3 text-xs">
            {log || "(no actions yet)"}
          </pre>
        </section>
      </div>
    </main>
  );
}
