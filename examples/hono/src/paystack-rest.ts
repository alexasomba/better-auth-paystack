import { createPaystack, type Paystack } from "@alexasomba/paystack-node";

export type PaystackRestClient = Paystack;

export function createPaystackRestClient(secretKey: string): PaystackRestClient {
  return createPaystack({ secretKey });
}
