import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/billing/paystack/callback")({
  component: CallbackPage,
});

function CallbackPage() {
  const router = useRouter();
  const searchParams = Route.useSearch();
  const reference = (searchParams as any).reference as string | undefined;
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [error, setError] = useState("");
  const processedRef = useRef(false);

  useEffect(() => {
    if (!reference || processedRef.current) return;
    processedRef.current = true;

    const verify = async () => {
      try {
        await authClient.paystack.transaction.verify({ reference });
        setStatus("success");
        setTimeout(() => {
          router.navigate({ to: "/dashboard" });
        }, 2000);
      } catch (e: unknown) {
        console.error(e);
        setStatus("error");
        if (e instanceof Error) {
           setError(e.message || "Verification failed");
        }
      }
    };

    verify();
  }, [reference, router]);

  if (!reference) {
      return (
          <div className="flex min-h-[50vh] items-center justify-center">
             <Card>
                 <CardContent className="p-6">
                     No reference provided.
                 </CardContent>
             </Card>
          </div>
      )
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
             {status === "verifying" && "Verifying Payment..."}
             {status === "success" && "Payment Successful!"}
             {status === "error" && "Verification Failed"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground">
          {status === "verifying" && (
            <p>Please wait while we confirm your transaction.</p>
          )}
          {status === "success" && (
            <p>Redirecting you to dashboard...</p>
          )}
          {status === "error" && (
            <p className="text-red-500">{error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
