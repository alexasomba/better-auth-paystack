import { createAuthClient } from "better-auth/client";
import { paystackClient } from "@alexasomba/better-auth-paystack/client";

export function createClient(baseURL: string) {
    return createAuthClient({
        baseURL,
        plugins: [paystackClient({ subscription: true })],
    });
}
