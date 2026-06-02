import { describe, expect, it } from "vitest";

import {
  createCheckoutMetadata,
  createProrationMetadata,
  getMetadataBoolean,
  getMetadataNumber,
  getMetadataString,
  parsePaystackMetadata,
  stringifyPaystackMetadata,
} from "../src";

describe("Paystack metadata helpers", () => {
  it("round-trips checkout metadata without losing caller metadata", () => {
    const trialEnd = new Date("2026-01-15T00:00:00.000Z");
    const metadata = createCheckoutMetadata({
      referenceId: "org_123",
      userId: "user_123",
      plan: "pro",
      extra: { source: "test" },
      trial: {
        isTrial: true,
        requested: true,
        granted: true,
        endsAt: trialEnd,
      },
    });

    const parsed = parsePaystackMetadata(stringifyPaystackMetadata(metadata));

    expect(getMetadataString(parsed, "referenceId")).toBe("org_123");
    expect(getMetadataString(parsed, "source")).toBe("test");
    expect(getMetadataBoolean(parsed, "isTrial")).toBe(true);
    expect(getMetadataString(parsed, "trialEnd")).toBe(trialEnd.toISOString());
  });

  it("normalizes invalid metadata to an empty object", () => {
    expect(parsePaystackMetadata("{bad json")).toEqual({});
    expect(parsePaystackMetadata(["not", "metadata"])).toEqual({});
    expect(stringifyPaystackMetadata(undefined)).toBeUndefined();
  });

  it("exposes typed proration metadata accessors", () => {
    const metadata = createProrationMetadata({
      subscriptionId: "sub_123",
      referenceId: "user_123",
      newPlan: "team",
      oldPlan: "pro",
      newSeatCount: 4,
      remainingDays: 12,
    });

    expect(getMetadataString(metadata, "type")).toBe("proration");
    expect(getMetadataString(metadata, "newPlan")).toBe("team");
    expect(getMetadataNumber(metadata, "newSeatCount")).toBe(4);
  });
});
