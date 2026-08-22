import { paystackClient } from "better-auth-paystack/client";
import { anonymousClient, adminClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export function createClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [
      anonymousClient(),
      organizationClient(),
      adminClient(),
      paystackClient({ subscription: true }),
    ] as const,
    fetchOptions: {
      credentials: "include",
    },
  });
}
