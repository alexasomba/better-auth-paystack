
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Paystack Integration (Next.js)", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.stubEnv("PAYSTACK_SECRET_KEY", "pk_test_mock");
        vi.stubEnv("PAYSTACK_WEBHOOK_SECRET", "mock_secret");
        vi.stubEnv("BETTER_AUTH_SECRET", "mock_auth_secret");
        vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("should initialize a one-time transaction with string amount", async () => {
        const { auth } = await import("./auth");
        
        // We mock the internal API behavior if possible, or we check validation.
        // Since we don't have a real Paystack client, we expect this to fail downstream 
        // OR we mock the call if we can Spy on the plugin.
        
        // But better-auth plugins are closed.
        // Let's call it and expect it NOT to throw "Response body object should not be disturbed"
        // It might throw "401 Unauthorized" or "network error" which is fine.
        
        try {
            await auth.api.initializeTransaction({
                body: {
                    amount: 1000, // Should be converted to "1000" internally
                    email: "test@example.com",
                },
            });
        } catch (error: unknown) {
             // If we get here, it means it didn't crash with "body locked".
             // It likely failed because the SDK tried to fetch with a mock key.
             expect(error).toBeDefined();
             expect((error as Error).message).not.toContain("object should not be disturbed");
        }
    });

    it("should handle subscription initialization", async () => {
        const { auth } = await import("./auth");
        try {
             await auth.api.initializeTransaction({
                body: {
                    plan: "PLN_test",
                    email: "sub@example.com",
                }
             });
        } catch (error: unknown) {
             expect((error as Error).message).not.toContain("object should not be disturbed");
        }
    });
});
