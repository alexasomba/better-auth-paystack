import { describe, it, expect, vi, beforeAll } from 'vitest';

describe('TanStack Example - Paystack Integration', () => {
    let auth: any;

    beforeAll(async () => {
        vi.stubEnv('PAYSTACK_SECRET_KEY', 'sk_test_mock');
        vi.stubEnv('PAYSTACK_WEBHOOK_SECRET', 'whsec_test_mock');
        
        // Dynamic import to ensure env is set before auth loads
        const authModule = await import('../lib/auth');
        auth = authModule.auth;
    });

    it('should have paystack plugin endpoints registered', () => {
        const endpoints = auth.api;
        
        // In this environment, endpoints seem to be flattened
        expect(endpoints.initializeTransaction).toBeDefined();
        expect(endpoints.verifyTransaction).toBeDefined();
        expect(endpoints.paystackWebhook).toBeDefined();
        expect(endpoints.listTransactions).toBeDefined();
        expect(endpoints.listSubscriptions).toBeDefined();
        expect(endpoints.syncProducts).toBeDefined();
    });

    it('should have products and plans configured in the plugin', async () => {
        // Use getConfig endpoint to verify configuration
        const req = new Request('http://localhost:3000/api/auth/paystack/get-config', {
            headers: { 'origin': 'http://localhost:3000' }
        });
        const res = await auth.handler(req);
        expect(res.status).toBe(200);
        
        const config = await res.json();
        expect(config.products).toBeDefined();
        expect(config.products).toHaveLength(2);
        expect(config.products[0].name).toBe('50 Credits Pack');

        expect(config.plans).toBeDefined();
        // 2 Paystack-managed (starter, pro) + 2 local (team, enterprise)
        expect(config.plans).toHaveLength(4);
    });

    it('should successfully call sync-products (mocking session)', async () => {
        // Mock a request to sync-products
        // Note: Standardized path is /paystack/sync-products
        const req = new Request('http://localhost:3000/api/auth/paystack/sync-products', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'origin': 'http://localhost:3000',
            },
        });

        // This will likely fail with 401 locally because there's no session,
        // but it proves the route is handled by Better Auth.
        const res = await auth.handler(req);
        
        // If it's 401, it means the middleware is working (endpoint exists and is protected)
        // If it's 404, it means the endpoint is NOT registered.
        expect(res.status).not.toBe(404);
        expect(res.status).toBe(401); 
    });
});
