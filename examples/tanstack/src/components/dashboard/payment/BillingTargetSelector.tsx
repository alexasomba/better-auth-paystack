import { Buildings, User } from "@phosphor-icons/react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface BillingOrganization {
  id: string;
  name: string;
  slug: string;
}

interface BillingTargetSelectorProps {
  organizations: BillingOrganization[];
  selectedBillingTarget: string;
  quantity: number;
  onBillingTargetChange: (value: string) => void;
  onQuantityChange: (value: number) => void;
}

export function BillingTargetSelector({
  organizations,
  selectedBillingTarget,
  quantity,
  onBillingTargetChange,
  onQuantityChange,
}: BillingTargetSelectorProps) {
  if (organizations.length === 0) return null;

  return (
    <div className="p-4 bg-muted/30 border border-dashed rounded-lg">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Buildings weight="duotone" size={20} className="text-primary" />
        </div>
        <div>
          <p className="font-medium text-sm">Bill To</p>
          <p className="text-xs text-muted-foreground">
            Choose who will be charged for this subscription
          </p>
        </div>
      </div>
      <Select
        data-testid="billing-target-select"
        value={selectedBillingTarget}
        onValueChange={(value) => value !== null && value !== "" && onBillingTargetChange(value)}
      >
        <SelectTrigger className="w-full max-w-xs">
          <SelectValue placeholder="Select billing target" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="personal">
            <div className="flex items-center gap-2">
              <User size={16} />
              <span>Personal Account</span>
            </div>
          </SelectItem>
          {organizations.map((org) => (
            <SelectItem key={org.id} value={org.id}>
              <div className="flex items-center gap-2">
                <Buildings size={16} />
                <span>{org.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedBillingTarget !== "personal" && (
        <div className="mt-4 pt-4 border-t border-dashed">
          <Label htmlFor="seats" className="text-xs font-medium mb-1.5 block">
            Number of Seats
          </Label>
          <div className="flex items-center gap-3">
            <Input
              id="seats"
              type="number"
              min={1}
              max={100}
              value={quantity}
              onChange={(event) => onQuantityChange(Math.max(1, parseInt(event.target.value) || 1))}
              className="w-24 h-9"
            />
            <p className="text-[10px] text-muted-foreground italic">
              Pricing scales linearly based on seat count.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
