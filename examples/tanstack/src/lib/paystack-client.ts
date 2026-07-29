import { authClient } from "@/lib/auth-client";
import type { PaystackClientActions } from "better-auth-paystack/client";

interface BetterAuthPaystackClient {
  paystack: PaystackClientActions;
  subscription: PaystackClientActions["subscription"];
}

const billingAuthClient = authClient as typeof authClient & BetterAuthPaystackClient;

export const paystackActions = billingAuthClient.paystack;
export const subscriptionActions = billingAuthClient.subscription;
