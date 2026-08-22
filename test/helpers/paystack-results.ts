import { expect } from "vite-plus/test";

import type { PaystackInitializeResult } from "../../src";

export type CheckoutInitializeResult = Extract<PaystackInitializeResult, { kind: "checkout" }>;
export type ScheduledInitializeResult = Extract<PaystackInitializeResult, { kind: "scheduled" }>;
export type ProratedInitializeResult = Extract<PaystackInitializeResult, { kind: "prorated" }>;

export function expectCheckoutResult(value: unknown): asserts value is CheckoutInitializeResult {
  expect(value).toMatchObject({
    kind: "checkout",
    redirect: true,
  });
}

export function expectScheduledResult(value: unknown): asserts value is ScheduledInitializeResult {
  expect(value).toMatchObject({
    kind: "scheduled",
    status: "success",
    scheduled: true,
  });
}

export function expectProratedResult(value: unknown): asserts value is ProratedInitializeResult {
  expect(value).toMatchObject({
    kind: "prorated",
    status: "success",
    prorated: true,
  });
}
