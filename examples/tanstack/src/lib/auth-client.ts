import { createAuthClient } from "better-auth/react";
import { anonymousClient } from "better-auth/client/plugins";
import { paystackClient } from "@alexasomba/better-auth-paystack/client";
import type { auth } from "./auth";

export const authClient = createAuthClient({
    baseURL: process.env.BETTER_AUTH_BASE_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    plugins: [
        anonymousClient(),
        paystackClient({ subscription: true }),
    ],
});
