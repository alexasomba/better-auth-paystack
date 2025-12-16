import { Hono } from "hono";
import { createAuth, type Bindings } from "./auth";

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => c.text("Better Auth + Paystack (Hono example)"));

app.all("/api/auth/*", (c) => {
  const auth = createAuth(c.req.raw, c.env);
  return auth.handler(c.req.raw);
});

export default app;
