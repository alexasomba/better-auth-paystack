import { createAuthClient } from "better-auth/react";
import { anonymousClient } from "better-auth/client/plugins";
import { paystackClient } from "@alexasomba/better-auth-paystack/client";

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000",
    plugins: [
        anonymousClient(),
        paystackClient({ subscription: true })
    ],
});

