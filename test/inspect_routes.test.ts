import { describe, it } from "vitest";
import { betterAuth } from "better-auth";
import { paystack } from "../src";

describe("Route Inspection", () => {
  it("should show registered routes", async () => {
    const auth = betterAuth({
      baseURL: "http://localhost:3000",
      plugins: [paystack({ secretKey: "test", paystackClient: {} as any })],
    });

    // Better Auth registers routes in an internal map
    // @ts-ignore: Internal API access for debugging
    const _endpoints = Object.keys(auth.api.paystack);

    // Try to trigger the handler and check results
    const req = new Request("http://localhost:3000/api/auth/paystack/webhook", { method: "POST" });
    const _res = await auth.handler(req);
    const reqInit = new Request("http://localhost:3000/api/auth/paystack/initialize-transaction", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    });
    await auth.handler(reqInit);
  });
});
