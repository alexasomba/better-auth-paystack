/** Provider-owned Better Auth model names. Keep these centralized so a provider
 * model cannot accidentally fall back to Better Auth's generic billing tables. */
export const PAYSTACK_MODELS = {
  customer: "paystackCustomer",
  paymentCredential: "paystackPaymentCredential",
  subscription: "paystackSubscription",
  transaction: "paystackTransaction",
  product: "paystackProduct",
  plan: "paystackPlan",
  webhookEvent: "paystackWebhookEvent",
} as const;

export const LEGACY_PAYSTACK_MODELS = {
  subscription: "subscription",
} as const;
