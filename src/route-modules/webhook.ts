import type { GenericEndpointContext } from "better-auth";

export function getWebhookRequest(ctx: GenericEndpointContext): Request | undefined {
  return (
    (ctx as unknown as { requestClone?: Request }).requestClone ??
    (ctx as { request?: Request }).request
  );
}

export function getWebhookHeaders(ctx: GenericEndpointContext): Headers | undefined {
  return (
    (ctx as GenericEndpointContext & { headers?: Headers }).headers ??
    (ctx.request as unknown as { headers?: Headers })?.headers
  );
}

export function getWebhookClientIP(
  ctx: GenericEndpointContext,
  headers: Headers | undefined,
): string | undefined {
  return (
    headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers?.get("x-real-ip") ??
    (ctx.request as unknown as { ip?: string }).ip
  );
}
