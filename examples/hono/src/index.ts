import type { GenericEndpointContext } from "better-auth";
import {
  chargeSubscriptionRenewal,
  syncPaystackPlans,
  syncPaystackProducts,
} from "better-auth-paystack";
import { Hono } from "hono";

import { createAuth, createPaystackOptions, type Bindings } from "./auth";

const app = new Hono<{ Bindings: Bindings }>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const routes = app
  .get("/", (c) => c.json({ ok: true, service: "better-auth-paystack-hono-example" }))
  .get("/health", (c) => c.json({ ok: true, service: "better-auth-paystack-hono-example" }))
  .get("/mcp", (c) =>
    c.json({
      jsonrpc: "2.0",
      error: {
        code: -32_000,
        message: "MCP transport is advertised for discovery only in this demo.",
      },
    }),
  )
  .post("/mcp", (c) =>
    c.json({
      jsonrpc: "2.0",
      result: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        serverInfo: { name: "better-auth-paystack-hono-example", version: "1.0.0" },
      },
    }),
  )
  .get("/openapi.json", (c) =>
    c.json(
      {
        openapi: "3.1.0",
        info: {
          title: "Better Auth Paystack Hono example",
          version: "1.0.0",
        },
        paths: {
          "/health": { get: { responses: { "200": { description: "Healthy" } } } },
          "/api/auth/{path}": {
            get: { responses: { "200": { description: "Better Auth response" } } },
            post: { responses: { "200": { description: "Better Auth response" } } },
          },
          "/api/billing": {
            post: { responses: { "200": { description: "Billing operation result" } } },
          },
        },
      },
      200,
      { "Content-Type": "application/vnd.oai.openapi+json; charset=utf-8" },
    ),
  )
  .get("/.well-known/api-catalog", (c) =>
    c.json(
      {
        links: [
          { href: "/api/health", rel: "status" },
          { href: "/api/auth/*", rel: "auth" },
          { href: "/api/billing", rel: "billing" },
          { href: "/openapi.json", rel: "service-desc" },
        ],
      },
      200,
      { "Content-Type": "application/linkset+json; charset=utf-8" },
    ),
  )
  .all("/api/auth/*", (c) => {
    const auth = createAuth(c.req.raw, c.env);
    return auth.handler(c.req.raw);
  })
  .post("/api/billing", async (c) => {
    try {
      const body = await c.req.json().catch(() => null);
      if (!isRecord(body) || typeof body.action !== "string") {
        return c.json({ error: "Invalid billing action" }, 400);
      }

      const auth = createAuth(c.req.raw, c.env);
      if (body.action === "verify") {
        if (typeof body.reference !== "string" || body.reference === "") {
          return c.json({ error: "A transaction reference is required" }, 400);
        }
        return c.json(
          await auth.api.verifyTransaction({
            body: { reference: body.reference },
            headers: c.req.raw.headers,
          }),
        );
      }

      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (session?.user === undefined) {
        return c.json({ error: "You must be signed in to run this billing operation." }, 401);
      }

      const ctx = { context: auth.$context } as unknown as GenericEndpointContext;
      const options = createPaystackOptions(c.env);
      if (body.action === "sync-products") {
        return c.json(await syncPaystackProducts(ctx, options));
      }
      if (body.action === "sync-plans") {
        return c.json(await syncPaystackPlans(ctx, options));
      }
      if (body.action !== "charge-renewal" || typeof body.subscriptionId !== "string") {
        return c.json({ error: "Invalid billing action payload" }, 400);
      }

      const subscription = await ctx.context.adapter.findOne<{
        id: string;
        referenceId: string;
      }>({
        model: "paystackSubscription",
        where: [{ field: "id", value: body.subscriptionId }],
      });
      if (subscription === null) {
        return c.json({ error: "Subscription not found." }, 404);
      }
      if (subscription.referenceId !== session.user.id) {
        const member = await ctx.context.adapter.findOne<{ role?: unknown }>({
          model: "member",
          where: [
            { field: "organizationId", value: subscription.referenceId },
            { field: "userId", value: session.user.id },
          ],
        });
        if (member === null || !["owner", "admin"].includes(String(member.role))) {
          return c.json({ error: "Only organization owners and admins can manage billing." }, 403);
        }
      }

      return c.json(
        await chargeSubscriptionRenewal(ctx, options, {
          subscriptionId: body.subscriptionId,
        }),
      );
    } catch (error: unknown) {
      console.error(error);
      return c.json(
        { error: error instanceof Error ? error.message : "Billing operation failed." },
        400,
      );
    }
  });

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((error, c) => {
  console.error(error);
  return c.json({ error: "Internal server error" }, 500);
});

export type AppType = typeof routes;
export default routes;
