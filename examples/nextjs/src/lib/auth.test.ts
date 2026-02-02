
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Next.js Auth Configuration", () => {
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

    it("should provide an auth instance", async () => {
        const { auth } = await import("./auth");
        expect(auth).toBeDefined();
        expect(auth.api).toBeDefined();
    });

    it("should have Paystack plugin registered", async () => {
         const { auth } = await import("./auth");
         expect(auth).toBeTruthy();
         expect(auth.api.paystackWebhook).toBeDefined();
    });

    it("should expose subscription management endpoints", async () => {
        const { auth } = await import("./auth");
        // Verify that the server-side auth instance has the plugin API methods attached
        expect(auth.api.listLocalSubscriptions).toBeDefined();
        expect(auth.api.getConfig).toBeDefined();
    });

    // Note: To test transactionInitialize end-to-end requires mocking the underlying 'paystack-node' client
    // because auth.api calls execute real logic.
    // For now, we verify the structure.
});

