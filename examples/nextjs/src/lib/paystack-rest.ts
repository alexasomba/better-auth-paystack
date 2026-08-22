import { createPaystack, type Paystack } from "@alexasomba/paystack-node";

export type PaystackRestClient = Paystack;

export function createPaystackRestClient(secretKey: string): PaystackRestClient {
  return createPaystack({
    secretKey,
    timeoutMs: 30_000,
    retry: {
      retries: 3,
      minDelayMs: 500,
      maxDelayMs: 5_000,
      retryOnStatuses: [408, 429, 500, 502, 503, 504],
    },
    idempotencyKey: "auto",
  });
}
