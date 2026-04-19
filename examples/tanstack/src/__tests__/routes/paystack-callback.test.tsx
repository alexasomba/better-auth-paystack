import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { act, render, screen, waitFor } from "@testing-library/react";
import { CallbackPage } from "@/routes/billing/paystack/callback";

const { mockNavigate, mockUseSearch } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseSearch: vi.fn(() => ({ reference: "ref_123" })),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    paystack: {
      verifyTransaction: vi.fn(),
    },
  },
}));

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
    vi.useRealTimers();
    vi.clearAllMocks();
    mockUseSearch.mockReturnValue({ reference: "ref_123" });
  });

  it("shows an error when verifyTransaction returns a Better Auth error payload", async () => {
    const { authClient } = await import("@/lib/auth-client");

    vi.mocked((authClient as any).paystack.verifyTransaction).mockResolvedValue({
      data: null,
      error: {
        message: "Verification failed on the server",
      },
    } as any);

    render(<CallbackPage />);

    await waitFor(() => {
      expect(screen.getByText("Verification Failed")).toBeInTheDocument();
      expect(screen.getByText("Verification failed on the server")).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("retries transient reference-not-found verification failures and accepts trxref", async () => {
    vi.useFakeTimers();
    mockUseSearch.mockReturnValue({ trxref: "trx_123" } as any);

    const { authClient } = await import("@/lib/auth-client");

    let verifyCount = 0;
    vi.mocked((authClient as any).paystack.verifyTransaction).mockImplementation(() => {
      verifyCount++;
      if (verifyCount === 1) {
        return Promise.resolve({
          data: null,
          error: {
            message: "Transaction reference not found.",
          },
        } as any);
      }
      return Promise.resolve({
        data: {
          status: "success",
        },
        error: null,
      } as any);
    });

    render(<CallbackPage />);

    // Flush the initial effect and first verification promise.
    await act(async () => {
      await Promise.resolve();
    });

    // Trigger the retry delay and flush the second verification promise.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
    });

    expect((authClient as any).paystack.verifyTransaction).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Payment Successful!")).toBeInTheDocument();
  }, 20000);

  it("shows a trial-specific success state when the verified transaction metadata indicates a trial", async () => {
    const { authClient } = await import("@/lib/auth-client");

    vi.mocked((authClient as any).paystack.verifyTransaction).mockResolvedValue({
      data: {
        status: "success",
        metadata: JSON.stringify({
          isTrial: true,
          plan: "business",
        }),
      },
      error: null,
    } as any);

    render(<CallbackPage />);

    await waitFor(() => {
      expect(screen.getByText("Trial Started!")).toBeInTheDocument();
      expect(
        screen.getByText("business is now in trial mode. Redirecting you to dashboard..."),
      ).toBeInTheDocument();
    });
  });

  it("shows a one-time purchase success state when product metadata is present", async () => {
    const { authClient } = await import("@/lib/auth-client");

    vi.mocked((authClient as any).paystack.verifyTransaction).mockResolvedValue({
      data: {
        status: "success",
        metadata: JSON.stringify({
          product: "50 credits pack",
        }),
      },
      error: null,
    } as any);

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
    const { authClient } = await import("@/lib/auth-client");

    vi.mocked((authClient as any).paystack.verifyTransaction).mockResolvedValue({
      data: {
        status: "success",
        metadata: JSON.stringify({
          type: "proration",
        }),
      },
      error: null,
    } as any);

    render(<CallbackPage />);

    await waitFor(() => {
      expect(screen.getByText("Upgrade Successful!")).toBeInTheDocument();
      expect(
        screen.getByText("Your prorated upgrade payment has been confirmed."),
      ).toBeInTheDocument();
    });
  });

  it("shows a friendly paid-activation message when a requested trial was already used", async () => {
    const { authClient } = await import("@/lib/auth-client");

    vi.mocked((authClient as any).paystack.verifyTransaction).mockResolvedValue({
      data: {
        status: "success",
        metadata: JSON.stringify({
          plan: "starter",
          trialRequested: true,
          trialGranted: false,
          trialDeniedReason: "already_used",
        }),
      },
      error: null,
    } as any);

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
