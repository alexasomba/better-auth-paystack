import { paystackClient } from "better-auth-paystack/client";
import { anonymousClient, organizationClient, adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.VITE_BETTER_AUTH_URL ?? "http://localhost:8787"),
  plugins: [
    anonymousClient(),
    organizationClient(),
    adminClient(),
    paystackClient({ subscription: true }),
  ],
});
