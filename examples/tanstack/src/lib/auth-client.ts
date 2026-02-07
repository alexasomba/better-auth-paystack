import { createAuthClient } from "better-auth/react";
import { anonymousClient } from "better-auth/client/plugins";
import { paystackClient } from "@alexasomba/better-auth-paystack/client";


export const authClient = createAuthClient({
    baseURL: typeof window !== "undefined" ? window.location.origin : (process.env.VITE_BETTER_AUTH_URL ?? "http://localhost:4173"),
    plugins: [
        anonymousClient(),
        paystackClient({ subscription: true }),
    ],
});
