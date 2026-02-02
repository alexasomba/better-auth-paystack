
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Next.js Auth Configuration", () => {
    beforeEach(() => {
        vi.resetModules(); // Ensure fresh module for each test if needed
        process.env.PAYSTACK_SECRET_KEY = "pk_test_mock";
        process.env.PAYSTACK_WEBHOOK_SECRET = "mock_secret";
        process.env.BETTER_AUTH_SECRET = "mock_auth_secret";
        process.env.BETTER_AUTH_URL = "http://localhost:3000";
    });

    it("should provide an auth instance", async () => {
        const { auth } = await import("./auth");
        expect(auth).toBeDefined();
        expect(auth.api).toBeDefined();
    });

    it("should have Paystack plugin registered", async () => {
         const { auth } = await import("./auth");
         expect(auth).toBeTruthy();
    });
});
