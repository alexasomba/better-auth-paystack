import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PaymentManager from "@/components/dashboard/PaymentManager";
import { authClient } from "@/lib/auth-client";

// Mock authClient
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    paystack: {
      subscription: {
        listLocal: vi.fn(),
      },
      getConfig: vi.fn(),
      listProducts: vi.fn(),
      syncProducts: vi.fn(),
      listPlans: vi.fn(),
      syncPlans: vi.fn(),
      transaction: {
        initialize: vi.fn(),
      },
      manageLink: vi.fn(),
      restore: vi.fn(),
      disable: vi.fn(),
    },
    organization: {
      list: vi.fn(),
    },
  },
}));

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
  Select: ({ children, value, onValueChange, "data-testid": testId }: any) => (
    <select data-testid={testId} value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: ({ children, placeholder }: any) => <>{children || placeholder}</>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}));

describe("PaymentManager component", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock returns
    vi.mocked(authClient.paystack.getConfig).mockResolvedValue({
      data: { plans: [], products: [] },
    } as any);
    vi.mocked(authClient.paystack.subscription.listLocal).mockResolvedValue({
      data: { subscriptions: [] },
    } as any);
    vi.mocked(authClient.paystack.listProducts).mockResolvedValue({
      data: { products: [] },
    } as any);
    vi.mocked(authClient.organization.list).mockResolvedValue({ data: [] } as any);

    // Silence console errors in tests
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should render the native products section", async () => {
    render(<PaymentManager activeTab="one-time" />);

    await waitFor(() => {
      expect(screen.getByText("Paystack->DB Synced Products")).toBeInTheDocument();
      expect(screen.getByText("Sync Now")).toBeInTheDocument();
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
    vi.mocked(authClient.paystack.listProducts).mockResolvedValue({
      data: { products: mockProducts },
    } as any);

    render(<PaymentManager activeTab="one-time" />);

    await waitFor(() => {
      expect(screen.getByText("Product A")).toBeInTheDocument();
      expect(screen.getByText("Product B")).toBeInTheDocument();
    });
  });

  it("should call syncProducts when Sync Now is clicked", async () => {
    vi.mocked(authClient.paystack.syncProducts).mockResolvedValue({
      data: { status: "success", count: 5 },
    } as any);
    vi.mocked(authClient.paystack.listProducts).mockResolvedValue({
      data: { products: [] },
    } as any);
    window.alert = vi.fn();

    render(<PaymentManager activeTab="one-time" />);

    await waitFor(() => {
      const syncButton = screen.getByText("Sync Now");
      fireEvent.click(syncButton);
    });

    await waitFor(() => {
      expect(authClient.paystack.syncProducts).toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalledWith("Successfully synced 5 products from Paystack.");
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
    vi.mocked(authClient.paystack.listProducts).mockResolvedValue({
      data: { products: mockProducts },
    } as any);
    vi.mocked(authClient.paystack.transaction.initialize).mockResolvedValue({
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
      expect(authClient.paystack.transaction.initialize).toHaveBeenCalledWith(
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
      expect(screen.getByText("Sync Native Plans")).toBeInTheDocument();
    });
  });

  it("should list native plans correctly", async () => {
    const mockPlans = [
      { paystackId: "1", name: "Plan A", amount: 500000, currency: "NGN", interval: "annually" },
      { planCode: "PLN_2", name: "Plan B", amount: 5000, currency: "NGN", interval: "monthly" },
    ];
    vi.mocked(authClient.paystack.listPlans).mockResolvedValue({
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

  it("should call syncPlans when Sync Native Plans is clicked", async () => {
    vi.mocked(authClient.paystack.syncPlans).mockResolvedValue({
      data: { status: "success", count: 3 },
    } as any);
    vi.mocked(authClient.paystack.listPlans).mockResolvedValue({ data: { plans: [] } } as any);
    window.alert = vi.fn();

    render(<PaymentManager activeTab="subscriptions" />);

    await waitFor(() => {
      const syncButton = screen.getByText("Sync Native Plans");
      fireEvent.click(syncButton);
    });

    await waitFor(() => {
      expect(authClient.paystack.syncPlans).toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalledWith("Successfully synced 3 plans from Paystack.");
    });
  });

  it("should pass quantity when subscribing for an organization", async () => {
    const mockOrgs = [{ id: "org_123", name: "Test Org", slug: "test-org" }];
    vi.mocked(authClient.organization.list).mockResolvedValue({ data: mockOrgs } as any);
    vi.mocked(authClient.paystack.getConfig).mockResolvedValue({
      data: { plans: [{ name: "Starter", amount: 1000, currency: "NGN" }], products: [] },
    } as any);
    vi.mocked(authClient.paystack.transaction.initialize).mockResolvedValue({
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
    const subscribeButton = screen.getByText("Subscribe Now");
    fireEvent.click(subscribeButton);

    await waitFor(() => {
      expect(authClient.paystack.transaction.initialize).toHaveBeenCalledWith(
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
    vi.mocked(authClient.organization.list).mockResolvedValue({ data: mockOrgs } as any);
    vi.mocked(authClient.paystack.getConfig).mockResolvedValue({
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
});
