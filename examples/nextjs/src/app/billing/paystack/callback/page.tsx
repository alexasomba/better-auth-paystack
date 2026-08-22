"use client";

import { useEffect, useMemo, useState } from "react";

type VerificationState = "verifying" | "success" | "error";

export default function PaystackCallbackPage() {
  const reference = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("reference") ?? params.get("trxref") ?? "";
  }, []);
  const [state, setState] = useState<VerificationState>("verifying");
  const [message, setMessage] = useState("Please wait while we confirm your transaction.");

  useEffect(() => {
    if (reference === "") {
      setState("error");
      setMessage("No Paystack reference was provided.");
      return;
    }

    const verify = async () => {
      try {
        const response = await fetch("/api/billing", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "verify", reference }),
        });
        const result = (await response.json()) as {
          data?: { status?: string; metadata?: unknown };
          error?: string;
        };
        if (!response.ok || result.data?.status !== "success") {
          throw new Error(result.error ?? "Payment verification did not complete successfully.");
        }
        setState("success");
        setMessage("Payment verified successfully. You can return to the dashboard.");
      } catch (error: unknown) {
        setState("error");
        setMessage(error instanceof Error ? error.message : "Payment verification failed.");
      }
    };

    void verify();
  }, [reference]);

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <section className="grid w-full max-w-md gap-4 rounded border p-6 text-center">
        <h1 className="text-xl font-semibold">
          {state === "verifying" && "Verifying payment..."}
          {state === "success" && "Payment successful"}
          {state === "error" && "Verification failed"}
        </h1>
        <p>{message}</p>
        {reference !== "" && <code className="text-sm break-all">{reference}</code>}
        <a className="rounded border px-3 py-2" href="/">
          Return to demo
        </a>
      </section>
    </main>
  );
}
