import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { render, screen, waitFor } from "@testing-library/react";
import { CallbackPage } from "@/routes/billing/paystack/callback";

const { mockNavigate, mockUseSearch, verifyCallbackMock, verifyCallbackServerFnMock } = vi.hoisted(
  () => ({
    mockNavigate: vi.fn(),
    mockUseSearch: vi.fn(() => ({ reference: "ref_123" })),
    verifyCallbackMock: vi.fn(),
    verifyCallbackServerFnMock: { __serverFn: "verifyPaystackCallback" },
  }),
);

vi.mock("@/lib/paystack-admin", () => ({
  verifyPaystackCallbackServerFn: verifyCallbackServerFnMock,
}));

vi.mock("@tanstack/react-start", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@tanstack/react-start");

  return {
    ...actual,
    useServerFn: (serverFn: { __serverFn?: string }) => {
      if (serverFn.__serverFn === "verifyPaystackCallback") return verifyCallbackMock;
      return vi.fn();
    },
  };
});

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@tanstack/react-router");

  return {
    ...actual,
    createFileRoute: () => () => ({
      useSearch: mockUseSearch,
    }),
    useRouter: () => ({
      navigate: mockNavigate,
    }),
  };
});

describe("Paystack callback route", () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockUseSearch.mockReturnValue({ reference: "ref_123" });
  });

  it("shows an error when server-side verification fails", async () => {
    verifyCallbackMock.mockRejectedValue(new Error("Verification failed on the server"));

    render(<CallbackPage />);

    await waitFor(() => {
      expect(screen.getByText("Verification Failed")).toBeInTheDocument();
      expect(screen.getByText("Verification failed on the server")).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("accepts trxref and verifies through the server function", async () => {
    mockUseSearch.mockReturnValue({ trxref: "trx_123" } as any);

    verifyCallbackMock.mockResolvedValue({
      data: {
        status: "success",
      },
    });

    render(<CallbackPage />);

    await waitFor(() => {
      expect(verifyCallbackMock).toHaveBeenCalledWith({ data: { reference: "trx_123" } });
      expect(screen.getByText("Payment Successful!")).toBeInTheDocument();
    });
  });

  it("shows a trial-specific success state when the verified transaction metadata indicates a trial", async () => {
    verifyCallbackMock.mockResolvedValue({
      data: {
        status: "success",
        metadata: JSON.stringify({
          isTrial: true,
          plan: "business",
        }),
      },
    });

    render(<CallbackPage />);

    await waitFor(() => {
      expect(screen.getByText("Trial Started!")).toBeInTheDocument();
      expect(
        screen.getByText("business is now in trial mode. Redirecting you to dashboard..."),
      ).toBeInTheDocument();
    });
  });

  it("shows a one-time purchase success state when product metadata is present", async () => {
    verifyCallbackMock.mockResolvedValue({
      data: {
        status: "success",
        metadata: JSON.stringify({
          product: "50 credits pack",
        }),
      },
    });

    render(<CallbackPage />);

    await waitFor(() => {
      expect(screen.getByText("Purchase Successful!")).toBeInTheDocument();
      expect(
        screen.getByText(
          "50 credits pack has been paid for successfully. Redirecting you to dashboard...",
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows an upgrade-specific success state for proration payments", async () => {
    verifyCallbackMock.mockResolvedValue({
      data: {
        status: "success",
        metadata: JSON.stringify({
          type: "proration",
        }),
      },
    });

    render(<CallbackPage />);

    await waitFor(() => {
      expect(screen.getByText("Upgrade Successful!")).toBeInTheDocument();
      expect(
        screen.getByText("Your prorated upgrade payment has been confirmed."),
      ).toBeInTheDocument();
    });
  });

  it("shows a friendly paid-activation message when a requested trial was already used", async () => {
    verifyCallbackMock.mockResolvedValue({
      data: {
        status: "success",
        metadata: JSON.stringify({
          plan: "starter",
          trialRequested: true,
          trialGranted: false,
          trialDeniedReason: "already_used",
        }),
      },
    });

    render(<CallbackPage />);

    await waitFor(() => {
      expect(screen.getByText("Subscription Activated")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Your starter trial was already used, so this checkout started paid billing immediately.",
        ),
      ).toBeInTheDocument();
    });
  });
});
