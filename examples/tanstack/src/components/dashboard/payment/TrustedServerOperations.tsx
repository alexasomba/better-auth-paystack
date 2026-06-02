import type { PaystackPlan, PaystackProduct, Subscription } from "@alexasomba/better-auth-paystack";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TrustedServerOperationsProps {
  nativeProducts: PaystackProduct[];
  nativePlans: PaystackPlan[];
  localRenewalCandidates: Subscription[];
  selectedRenewalSubscriptionId: string;
  serverOpsLoading: null | "plans" | "products" | "renewal";
  serverOpsMessage: string | null;
  onRenewalSubscriptionChange: (value: string) => void;
  onSyncProducts: () => void;
  onSyncPlans: () => void;
  onChargeRenewal: () => void;
}

export function TrustedServerOperations({
  nativeProducts,
  nativePlans,
  localRenewalCandidates,
  selectedRenewalSubscriptionId,
  serverOpsLoading,
  serverOpsMessage,
  onRenewalSubscriptionChange,
  onSyncProducts,
  onSyncPlans,
  onChargeRenewal,
}: TrustedServerOperationsProps) {
  return (
    <div className="rounded-2xl border border-dashed p-5 space-y-4 bg-muted/20">
      <div>
        <h3 className="text-lg font-semibold">Trusted Server Operations</h3>
        <p className="text-xs text-muted-foreground">
          These actions stay server-owned in the real plugin. This example exposes a small
          authenticated dashboard for inspection and manual triggering.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-background p-4 space-y-3">
          <p className="text-sm font-medium">Catalog Sync</p>
          <p className="text-xs text-muted-foreground">
            Local cache: {nativeProducts.length} synced products, {nativePlans.length} synced plans.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onSyncProducts}
              disabled={serverOpsLoading !== null}
              className="h-9"
            >
              {serverOpsLoading === "products" ? "Syncing Products..." : "Sync Products"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onSyncPlans}
              disabled={serverOpsLoading !== null}
              className="h-9"
            >
              {serverOpsLoading === "plans" ? "Syncing Plans..." : "Sync Plans"}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-background p-4 space-y-3">
          <p className="text-sm font-medium">Manual Renewal Charge</p>
          <p className="text-xs text-muted-foreground">
            Demonstrates the trusted renewal helper for locally managed subscriptions with a saved
            authorization code.
          </p>
          <Select
            value={selectedRenewalSubscriptionId}
            onValueChange={(value) => value !== null && onRenewalSubscriptionChange(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a local subscription" />
            </SelectTrigger>
            <SelectContent>
              {localRenewalCandidates.map((subscription) => (
                <SelectItem key={subscription.id} value={subscription.id}>
                  {subscription.plan} · {subscription.referenceId}
                </SelectItem>
              ))}
              {localRenewalCandidates.length === 0 && (
                <SelectItem value="none" disabled>
                  No local renewal candidates
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <Button
            type="button"
            onClick={onChargeRenewal}
            disabled={
              serverOpsLoading !== null ||
              selectedRenewalSubscriptionId === "" ||
              localRenewalCandidates.length === 0
            }
            className="h-9"
          >
            {serverOpsLoading === "renewal" ? "Charging Renewal..." : "Charge Renewal"}
          </Button>
        </div>
      </div>

      {serverOpsMessage !== null && serverOpsMessage !== "" && (
        <p className="text-xs text-muted-foreground">{serverOpsMessage}</p>
      )}
    </div>
  );
}
