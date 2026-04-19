import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PaymentManager from "@/components/dashboard/PaymentManager";
import { authClient } from "@/lib/auth-client";

const {
  syncProductsMock,
  syncPlansMock,
  chargeRenewalMock,
  syncProductsServerFnMock,
  syncPlansServerFnMock,
  chargeRenewalServerFnMock,
} = vi.hoisted(() => ({
  syncProductsMock: vi.fn(),
  syncPlansMock: vi.fn(),
  chargeRenewalMock: vi.fn(),
  syncProductsServerFnMock: { __serverFn: "syncProducts" },
  syncPlansServerFnMock: { __serverFn: "syncPlans" },
  chargeRenewalServerFnMock: { __serverFn: "chargeRenewal" },
}));

// Mock authClient
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    paystack: {
      config: vi.fn(),
      listProducts: vi.fn(),
      listPlans: vi.fn(),
      getSubscriptionManageLink: vi.fn(),
      initializeTransaction: vi.fn(),
    },
    organization: {
      list: vi.fn(),
    },
    subscription: {
      list: vi.fn(),
      billingPortal: vi.fn(),
      cancel: vi.fn(),
      restore: vi.fn(),
    },
  },
}));

vi.mock("@/lib/paystack-admin", () => ({
  syncProductsServerFn: syncProductsServerFnMock,
  syncPlansServerFn: syncPlansServerFnMock,
  chargeRenewalServerFn: chargeRenewalServerFnMock,
}));

vi.mock("@tanstack/react-start", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@tanstack/react-start");

  return {
    ...actual,
    useServerFn: (serverFn: { __serverFn?: string }) => {
      if (serverFn.__serverFn === "syncProducts") return syncProductsMock;
      if (serverFn.__serverFn === "syncPlans") return syncPlansMock;
      if (serverFn.__serverFn === "chargeRenewal") return chargeRenewalMock;
      return vi.fn();
    },
  };
});

// Mock icons
vi.mock("@phosphor-icons/react", () => ({
  Buildings: () => <div data-testid="icon-buildings" />,
  Clock: () => <div data-testid="icon-clock" />,
  CheckCircle: () => <div data-testid="icon-check" />,
  Sparkle: () => <div data-testid="icon-sparkle" />,
  CreditCard: () => <div data-testid="icon-credit-card" />,
  ShieldCheck: () => <div data-testid="icon-shield" />,
  ArrowRight: () => <div data-testid="icon-arrow-right" />,
  Coins: () => <div data-testid="icon-coins" />,
  Package: () => <div data-testid="icon-package" />,
  User: () => <div data-testid="icon-user" />,
}));

// Mock UI components that might be complex
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
    "data-testid": testId,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (v: string) => void;
    "data-testid"?: string;
  }) => (
    <select data-testid={testId} value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({
    children,
    placeholder,
  }: {
    children?: React.ReactNode;
    placeholder?: string;
  }) => <>{children ?? placeholder}</>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}));

describe("PaymentManager component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {
      /* noop */
    });

    // Default mock returns
    vi.mocked((authClient as any).paystack.config).mockResolvedValue({
      data: { plans: [], products: [] },
    } as any);
    vi.mocked((authClient as any).subscription.list).mockResolvedValue({
      data: { subscriptions: [] },
    } as any);
    vi.mocked((authClient as any).paystack.listProducts).mockResolvedValue({
      data: { products: [] },
    } as any);
    vi.mocked((authClient as any).organization.list).mockResolvedValue({ data: [] } as any);
    syncProductsMock.mockResolvedValue({ status: "success", count: 2 });
    syncPlansMock.mockResolvedValue({ status: "success", count: 3 });
    chargeRenewalMock.mockResolvedValue({
      status: "success",
      reference: "rec_123",
    });

    // Silence console errors in tests
    vi.spyOn(console, "error").mockImplementation(() => {
      /* noop */
    });
  });

  it("uses the stable Paystack client methods during the initial subscriptions load", async () => {
    render(<PaymentManager activeTab="subscriptions" />);

    await waitFor(() => {
      expect((authClient as any).paystack.config).toHaveBeenCalledTimes(1);
      expect((authClient as any).subscription.list).toHaveBeenCalledWith({
        query: { referenceId: undefined },
      });
      expect((authClient as any).paystack.listPlans).toHaveBeenCalledTimes(1);
    });

    expect((authClient as any).paystack).not.toHaveProperty("getConfig");
    expect((authClient as any).paystack).not.toHaveProperty("transaction");
    expect((authClient as any).paystack).not.toHaveProperty("subscription");
    expect((authClient as any).subscription).not.toHaveProperty("listLocal");
  });

  it("should render the native products section", async () => {
    render(<PaymentManager activeTab="one-time" />);

    await waitFor(() => {
      expect(screen.getByText("Paystack->DB Synced Products")).toBeInTheDocument();
    });
  });

  it("should list native products correctly", async () => {
    const mockProducts = [
      {
        id: "1",
        name: "Product A",
        amount: 1000,
        price: 1000,
        currency: "NGN",
        description: "Desc A",
      },
      {
        id: "2",
        name: "Product B",
        amount: 2000,
        price: 2000,
        currency: "NGN",
        description: "Desc B",
      },
    ];
    vi.mocked((authClient as any).paystack.listProducts).mockResolvedValue({
      data: { products: mockProducts },
    } as any);

    render(<PaymentManager activeTab="one-time" />);

    await waitFor(() => {
      expect(screen.getByText("Product A")).toBeInTheDocument();
      expect(screen.getByText("Product B")).toBeInTheDocument();
    });
  });

  it("should handle product purchase", async () => {
    const mockProducts = [
      {
        id: "1",
        name: "Product A",
        amount: 1000,
        price: 1000,
        currency: "NGN",
        description: "Desc A",
      },
    ];
    vi.mocked((authClient as any).paystack.listProducts).mockResolvedValue({
      data: { products: mockProducts },
    } as any);
    vi.mocked((authClient as any).paystack.initializeTransaction).mockResolvedValue({
      data: { url: "https://paystack.com/pay/mock" },
    } as any);

    // Mock window.location.href
    vi.stubGlobal("location", { href: "" });

    render(<PaymentManager activeTab="one-time" />);

    await waitFor(() => {
      const buyButton = screen.getByText("Purchase");
      fireEvent.click(buyButton);
    });

    await waitFor(() => {
      expect((authClient as any).paystack.initializeTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          product: "Product A",
          amount: 1000,
        }),
      );
      expect(window.location.href).toBe("https://paystack.com/pay/mock");
    });

    vi.unstubAllGlobals();
  });

  it("should render the native plans section", async () => {
    render(<PaymentManager activeTab="subscriptions" />);

    await waitFor(() => {
      expect(screen.getByText("Paystack->DB Synced Plans")).toBeInTheDocument();
    });
  });

  it("should list native plans correctly", async () => {
    const mockPlans = [
      { paystackId: "1", name: "Plan A", amount: 500000, currency: "NGN", interval: "annually" },
      { planCode: "PLN_2", name: "Plan B", amount: 5000, currency: "NGN", interval: "monthly" },
    ];
    vi.mocked((authClient as any).paystack.listPlans).mockResolvedValue({
      data: { plans: mockPlans },
    } as any);

    render(<PaymentManager activeTab="subscriptions" />);

    await waitFor(() => {
      expect(screen.getByText("Plan A")).toBeInTheDocument();
      expect(screen.getByText("Plan B")).toBeInTheDocument();
      // Amount / 100 for NGN with default Intl (en-NG)
      expect(screen.getByText("₦5,000.00")).toBeInTheDocument();
      expect(screen.getByText("₦50.00")).toBeInTheDocument();
    });
  });

  it("should pass quantity when subscribing for an organization", async () => {
    const mockOrgs = [{ id: "org_123", name: "Test Org", slug: "test-org" }];
    vi.mocked((authClient as any).organization.list).mockResolvedValue({ data: mockOrgs } as any);
    vi.mocked((authClient as any).paystack.config).mockResolvedValue({
      data: { plans: [{ name: "Starter", amount: 1000, currency: "NGN" }], products: [] },
    } as any);
    vi.mocked((authClient as any).paystack.initializeTransaction).mockResolvedValue({
      data: { url: "https://paystack.com/pay/mock" },
    } as any);

    render(<PaymentManager activeTab="subscriptions" />);

    // Wait for orgs to load
    await waitFor(() => {
      expect(screen.getByText("Test Org")).toBeInTheDocument();
    });

    // Select organization - using the mock select
    const select = screen.getByTestId("billing-target-select");
    fireEvent.change(select, { target: { value: "org_123" } });

    // Set quantity/seats - wait for it to appear
    let seatInput: HTMLElement | undefined;
    await waitFor(() => {
      seatInput = screen.getByLabelText("Number of Seats");
      expect(seatInput).toBeInTheDocument();
    });

    if (seatInput) {
      fireEvent.change(seatInput, { target: { value: "5" } });
    }

    // Click subscribe
    const subscribeButton = screen.getAllByText("Subscribe Now")[0];
    fireEvent.click(subscribeButton);

    await waitFor(() => {
      expect((authClient as any).paystack.initializeTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: "Starter",
          referenceId: "org_123",
          quantity: 5,
        }),
      );
    });
  });

  it("should update displayed price when quantity changes", async () => {
    const mockOrgs = [{ id: "org_123", name: "Test Org", slug: "test-org" }];
    vi.mocked((authClient as any).organization.list).mockResolvedValue({ data: mockOrgs } as any);
    vi.mocked((authClient as any).paystack.config).mockResolvedValue({
      data: { plans: [{ name: "Starter", amount: 1000, currency: "NGN" }], products: [] },
    } as any);

    render(<PaymentManager activeTab="subscriptions" />);

    // Switch to organization billing
    await waitFor(() => {
      fireEvent.change(screen.getByTestId("billing-target-select"), {
        target: { value: "org_123" },
      });
    });

    // Check initial price for 1 seat (₦10.00 since 1000 kobo = 10 NGN)
    await waitFor(() => {
      expect(screen.getByText("₦10.00")).toBeInTheDocument();
    });

    // Change seats to 10
    const seatInput = screen.getByLabelText("Number of Seats");
    fireEvent.change(seatInput, { target: { value: "10" } });

    // Price should update to ₦100.00 (10 * 10)
    await waitFor(() => {
      expect(screen.getByText("₦100.00")).toBeInTheDocument();
      expect(screen.getByText(/for 10 seats/)).toBeInTheDocument();
    });
  });

  it("surfaces trial messaging for eligible plans and active trial subscriptions", async () => {
    vi.mocked((authClient as any).paystack.config).mockResolvedValue({
      data: {
        plans: [
          {
            name: "Starter",
            amount: 1000,
            currency: "NGN",
            freeTrial: { days: 7 },
          },
        ],
        products: [],
      },
    } as any);
    vi.mocked((authClient as any).subscription.list).mockResolvedValue({
      data: {
        subscriptions: [
          {
            plan: "Starter",
            status: "trialing",
            paystackSubscriptionCode: "LOC_trial_123",
            trialEnd: "2026-04-26T00:00:00.000Z",
            cancelAtPeriodEnd: false,
          },
        ],
      },
    } as any);

    render(<PaymentManager activeTab="subscriptions" />);

    await waitFor(() => {
      expect(screen.getByText("Trial Used")).toBeInTheDocument();
      expect(screen.getByText(/Trial active until 26 Apr 2026/)).toBeInTheDocument();
      expect(screen.getByText(/paid billing starts after the trial ends/i)).toBeInTheDocument();
      expect(screen.queryByText("Manage Billing")).not.toBeInTheDocument();
      expect(screen.getByText(/This plan is managed in-app/i)).toBeInTheDocument();
    });
  });

  it("uses a trial-specific subscribe CTA for trial-enabled plans", async () => {
    vi.mocked((authClient as any).paystack.config).mockResolvedValue({
      data: {
        plans: [
          {
            name: "Starter",
            amount: 1000,
            currency: "NGN",
            freeTrial: { days: 7 },
          },
        ],
        products: [],
      },
    } as any);

    render(<PaymentManager activeTab="subscriptions" />);

    await waitFor(() => {
      expect(screen.getByText("Start 7-Day Trial")).toBeInTheDocument();
      expect(
        screen.getByText(/authorizes your payment method with Paystack's minimum amount first/i),
      ).toBeInTheDocument();
    });
  });

  it("shows a paid CTA when the current billing profile has already used its trial", async () => {
    vi.mocked((authClient as any).paystack.config).mockResolvedValue({
      data: {
        plans: [
          {
            name: "Starter",
            amount: 1000,
            currency: "NGN",
            freeTrial: { days: 7 },
          },
        ],
        products: [],
      },
    } as any);
    vi.mocked((authClient as any).subscription.list).mockResolvedValue({
      data: {
        subscriptions: [
          {
            plan: "Old Trial",
            status: "canceled",
            trialStart: "2026-04-01T00:00:00.000Z",
            trialEnd: "2026-04-08T00:00:00.000Z",
          },
        ],
      },
    } as any);

    render(<PaymentManager activeTab="subscriptions" />);

    await waitFor(() => {
      expect(screen.getByText("Trial Used")).toBeInTheDocument();
      expect(screen.getAllByText("Subscribe Now").length).toBeGreaterThan(0);
      expect(
        screen.getByText(/this billing profile has already used its trial/i),
      ).toBeInTheDocument();
    });
  });

  it("can trigger trusted server operations from the dashboard", async () => {
    vi.mocked((authClient as any).paystack.config).mockResolvedValue({
      data: {
        plans: [{ name: "Starter", amount: 1000, currency: "NGN" }],
        products: [],
      },
    } as any);
    vi.mocked((authClient as any).subscription.list).mockResolvedValue({
      data: {
        subscriptions: [
          {
            id: "sub_local_123",
            plan: "Team",
            status: "active",
            referenceId: "user_123",
            paystackSubscriptionCode: "LOC_sub_local_123",
            cancelAtPeriodEnd: false,
          },
        ],
      },
    } as any);

    render(<PaymentManager activeTab="subscriptions" />);

    await waitFor(() => {
      expect(screen.getByText("Trusted Server Operations")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Sync Products"));
    await waitFor(() => {
      expect(syncProductsMock).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText("Synced 2 products from Paystack into local storage."),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Charge Renewal"));
    await waitFor(() => {
      expect(chargeRenewalMock).toHaveBeenCalledWith({
        data: { subscriptionId: "sub_local_123" },
      });
      expect(
        screen.getByText("Renewal charged successfully for reference rec_123."),
      ).toBeInTheDocument();
    });
  });

  it("reloads subscriptions with the selected organization reference", async () => {
    const mockOrgs = [{ id: "org_123", name: "Test Org", slug: "test-org" }];
    vi.mocked((authClient as any).organization.list).mockResolvedValue({ data: mockOrgs } as any);
    vi.mocked((authClient as any).paystack.config).mockResolvedValue({
      data: { plans: [{ name: "Starter", amount: 1000, currency: "NGN" }], products: [] },
    } as any);

    render(<PaymentManager activeTab="subscriptions" />);

    await waitFor(() => {
      expect(screen.getByText("Test Org")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("billing-target-select"), {
      target: { value: "org_123" },
    });

    await waitFor(() => {
      expect((authClient as any).subscription.list).toHaveBeenLastCalledWith({
        query: { referenceId: "org_123" },
      });
    });
  });

  it("should schedule cancellation for the active subscription", async () => {
    vi.mocked((authClient as any).paystack.config).mockResolvedValue({
      data: {
        plans: [{ name: "Starter", amount: 1000, currency: "NGN" }],
        products: [],
      },
    } as any);
    vi.mocked((authClient as any).subscription.list).mockResolvedValue({
      data: {
        subscriptions: [
          {
            plan: "Starter",
            status: "active",
            paystackSubscriptionCode: "SUB_active_123",
            cancelAtPeriodEnd: false,
          },
        ],
      },
    } as any);

    render(<PaymentManager activeTab="subscriptions" />);

    await waitFor(() => {
      expect(screen.getByText("Cancel At Period End")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Cancel At Period End"));

    await waitFor(() => {
      expect((authClient as any).subscription.cancel).toHaveBeenCalledWith({
        subscriptionCode: "SUB_active_123",
        atPeriodEnd: true,
      });
      expect(screen.getByText("Restore Renewal")).toBeInTheDocument();
    });
  });

  it("should restore a subscription already marked for cancellation", async () => {
    vi.mocked((authClient as any).paystack.config).mockResolvedValue({
      data: {
        plans: [{ name: "Starter", amount: 1000, currency: "NGN" }],
        products: [],
      },
    } as any);
    vi.mocked((authClient as any).subscription.list).mockResolvedValue({
      data: {
        subscriptions: [
          {
            plan: "Starter",
            status: "active",
            paystackSubscriptionCode: "SUB_restore_123",
            cancelAtPeriodEnd: true,
          },
        ],
      },
    } as any);

    render(<PaymentManager activeTab="subscriptions" />);

    await waitFor(() => {
      expect(screen.getByText("Restore Renewal")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Restore Renewal"));

    await waitFor(() => {
      expect((authClient as any).subscription.restore).toHaveBeenCalledWith({
        subscriptionCode: "SUB_restore_123",
      });
      expect(screen.getByText("Cancel At Period End")).toBeInTheDocument();
    });
  });

  it("should schedule a plan change when another plan is selected", async () => {
    vi.mocked((authClient as any).paystack.config).mockResolvedValue({
      data: {
        plans: [
          { name: "Starter", amount: 1000, currency: "NGN" },
          { name: "Pro", amount: 2000, currency: "NGN" },
        ],
        products: [],
      },
    } as any);
    vi.mocked((authClient as any).subscription.list).mockResolvedValue({
      data: {
        subscriptions: [
          {
            plan: "Starter",
            status: "active",
            paystackSubscriptionCode: "SUB_schedule_123",
            cancelAtPeriodEnd: false,
          },
        ],
      },
    } as any);

    render(<PaymentManager activeTab="subscriptions" />);

    await waitFor(() => {
      expect(screen.getAllByText("Schedule Change").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText("Schedule Change")[0]);

    await waitFor(() => {
      expect((authClient as any).paystack.initializeTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: "Pro",
          scheduleAtPeriodEnd: true,
        }),
      );
      expect(window.alert).toHaveBeenCalledWith(
        "Plan change scheduled for the end of the current billing period.",
      );
    });
  });

  it("should prorate an immediate upgrade for a custom plan", async () => {
    vi.mocked((authClient as any).paystack.config).mockResolvedValue({
      data: {
        plans: [
          { name: "Starter", amount: 1000, currency: "NGN", planCode: "PLN_starter" },
          { name: "Team", amount: 3000, currency: "NGN" },
        ],
        products: [],
      },
    } as any);
    vi.mocked((authClient as any).subscription.list).mockResolvedValue({
      data: {
        subscriptions: [
          {
            plan: "Starter",
            status: "active",
            paystackSubscriptionCode: "SUB_upgrade_123",
            cancelAtPeriodEnd: false,
          },
        ],
      },
    } as any);
    vi.mocked((authClient as any).paystack.initializeTransaction).mockResolvedValue({
      data: {
        prorated: true,
        message: "Subscription successfully upgraded with prorated charge.",
      },
    } as any);

    render(<PaymentManager activeTab="subscriptions" />);

    await waitFor(() => {
      expect(screen.getByText("Upgrade Now")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Upgrade Now"));

    await waitFor(() => {
      expect((authClient as any).paystack.initializeTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: "Team",
          prorateAndCharge: true,
        }),
      );
      expect(window.alert).toHaveBeenCalledWith(
        "Subscription successfully upgraded with prorated charge.",
      );
    });
  });
});
