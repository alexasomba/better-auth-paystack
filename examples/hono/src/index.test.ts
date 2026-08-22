import { describe, expect, it } from "vitest";

import app from "./index";

describe("Hono example", () => {
  it("serves the example landing page", async () => {
    const response = await app.request("http://localhost/");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      service: "better-auth-paystack-hono-example",
    });
  });

  it("serves a health response", async () => {
    const response = await app.request("http://localhost/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      service: "better-auth-paystack-hono-example",
    });
  });

  it("publishes billing discovery endpoints", async () => {
    const openApi = await app.request("http://localhost/openapi.json");
    expect(openApi.status).toBe(200);
    expect((await openApi.json()).openapi).toBe("3.1.0");

    const catalog = await app.request("http://localhost/.well-known/api-catalog");
    expect(catalog.status).toBe(200);
    expect((await catalog.json()).links).toEqual(
      expect.arrayContaining([expect.objectContaining({ href: "/api/billing" })]),
    );
  });

  it("returns 404 for unknown routes", async () => {
    const response = await app.request("http://localhost/missing");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });
});
