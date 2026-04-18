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
});
