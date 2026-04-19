import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/billing/paystack/callback")({
  component: CallbackPage,
});

export function CallbackPage() {
  const router = useRouter();
  const searchParams = Route.useSearch();
  const reference =
    ((searchParams as any).reference as string | undefined) ??
    ((searchParams as any).trxref as string | undefined);
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [error, setError] = useState("");
  const [successTitle, setSuccessTitle] = useState("Payment Successful!");
  const [successMessage, setSuccessMessage] = useState("Redirecting you to dashboard...");
  const processedRef = useRef(false);

  useEffect(() => {
    if (reference === undefined || reference === "" || processedRef.current) return;
    processedRef.current = true;

    const verify = async () => {
      try {
        let result:
          | {
              data?: { status?: string | null } | null;
              error?: { message?: string | null } | null;
            }
          | undefined;

        for (let attempt = 0; attempt < 4; attempt++) {
          result = await (authClient as any).paystack.verifyTransaction({ reference });

          const message = result?.error?.message ?? "";
          const shouldRetry = message.includes("Transaction reference not found") && attempt < 3;

          if (shouldRetry) {
            await new Promise((resolve) => {
              setTimeout(resolve, 750);
            });
            continue;
          }

          break;
        }

        if (result?.error !== null && result?.error !== undefined) {
          throw new Error(result.error.message ?? "Verification failed");
        }

        if (result?.data?.status !== "success") {
          throw new Error("Verification did not complete successfully");
        }

        const metadataRaw = (result.data as { metadata?: unknown }).metadata;
        const metadata = (() => {
          if (typeof metadataRaw === "string") {
            try {
              return JSON.parse(metadataRaw) as Record<string, unknown>;
            } catch {
              return {};
            }
          }
          return (metadataRaw as Record<string, unknown> | null | undefined) ?? {};
        })();

        const isTrial = metadata.isTrial === true || metadata.isTrial === "true";
        const trialRequested =
          metadata.trialRequested === true || metadata.trialRequested === "true";
        const trialGranted = metadata.trialGranted === true || metadata.trialGranted === "true";
        const trialPlan =
          typeof metadata.plan === "string" && metadata.plan !== "" ? metadata.plan : null;
        const productName =
          typeof metadata.product === "string" && metadata.product !== "" ? metadata.product : null;
        const isProration = metadata.type === "proration";

        if (isTrial) {
          setSuccessTitle("Trial Started!");
          setSuccessMessage(
            trialPlan !== null
              ? `${trialPlan} is now in trial mode. Redirecting you to dashboard...`
              : "Your trial is active. Redirecting you to dashboard...",
          );
        } else if (isProration) {
          setSuccessTitle("Upgrade Successful!");
          setSuccessMessage("Your prorated upgrade payment has been confirmed.");
        } else if (trialRequested && trialGranted === false) {
          setSuccessTitle("Subscription Activated");
          setSuccessMessage(
            trialPlan !== null
              ? `Your ${trialPlan} trial was already used, so this checkout started paid billing immediately.`
              : "Your previous trial was already used, so this checkout started paid billing immediately.",
          );
        } else if (trialPlan !== null) {
          setSuccessTitle("Subscription Active!");
          setSuccessMessage(
            `Your ${trialPlan} subscription payment has been confirmed. Redirecting you to dashboard...`,
          );
        } else if (productName !== null) {
          setSuccessTitle("Purchase Successful!");
          setSuccessMessage(
            `${productName} has been paid for successfully. Redirecting you to dashboard...`,
          );
        } else {
          setSuccessTitle("Payment Successful!");
          setSuccessMessage("Redirecting you to dashboard...");
        }

        setStatus("success");
        setTimeout(() => {
          void router.navigate({ to: "/dashboard" });
        }, 2000);
      } catch (e: unknown) {
        // Verification failed
        setStatus("error");
        if (e instanceof Error) {
          setError(e.message || "Verification failed");
        }
      }
    };

    void verify();
  }, [reference, router]);

  if (reference === undefined || reference === "") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Card>
          <CardContent className="p-6">No reference provided.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {status === "verifying" && "Verifying Payment..."}
            {status === "success" && successTitle}
            {status === "error" && "Verification Failed"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground">
          {status === "verifying" && <p>Please wait while we confirm your transaction.</p>}
          {status === "success" && <p>{successMessage}</p>}
          {status === "error" && <p className="text-red-500">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
