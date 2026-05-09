const publicPages = ["/", "/billing/paystack/callback"] as const;

export const linkHeader =
  '</.well-known/api-catalog>; rel="api-catalog", </openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json", </api/health>; rel="status", <https://github.com/alexasomba/better-auth-paystack#readme>; rel="service-doc"';

export const homeMarkdown = `# Better Auth Paystack TanStack Start Example

This example demonstrates Better Auth anonymous sessions with Paystack billing flows.

## Public Pages

- Home: anonymous sign-in entry point.
- Paystack callback: payment verification return path.

## Agent Resources

- API catalog: /.well-known/api-catalog
- OpenAPI description: /openapi.json
- Health endpoint: /api/health
- Sitemap: /sitemap.xml
`;

export const paystackSkillMarkdown = `# better-auth-paystack-demo

Use this site to inspect the Better Auth Paystack TanStack Start demo.

## Resources

- API catalog: /.well-known/api-catalog
- OpenAPI description: /openapi.json
- Health endpoint: /api/health
- Sitemap: /sitemap.xml

## Actions

- Visit / to start an anonymous Better Auth session.
- Visit /dashboard after signing in to manage demo billing workflows.
`;

export function getOrigin(request: Request) {
  return new URL(request.url).origin;
}

export function absoluteUrl(origin: string, path: string) {
  return new URL(path, origin).toString();
}

export function getSitemapXml(origin: string) {
  const urls = publicPages
    .map((path) => {
      return `  <url>
    <loc>${absoluteUrl(origin, path)}</loc>
  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export function getOpenApiDocument(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Better Auth Paystack TanStack Example API",
      version: "1.0.0",
      description: "Discovery metadata for the Better Auth Paystack TanStack Start example.",
    },
    servers: [{ url: origin }],
    paths: {
      "/api/health": {
        get: {
          summary: "Health check",
          responses: {
            "200": {
              description: "The example application is available.",
            },
          },
        },
      },
      "/api/auth/{path}": {
        get: {
          summary: "Better Auth endpoint",
          parameters: [
            {
              name: "path",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Better Auth response.",
            },
          },
        },
        post: {
          summary: "Better Auth endpoint",
          parameters: [
            {
              name: "path",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Better Auth response.",
            },
          },
        },
      },
    },
  };
}

export function getApiCatalog(origin: string) {
  return {
    linkset: [
      {
        anchor: absoluteUrl(origin, "/api"),
        "service-desc": [
          {
            href: absoluteUrl(origin, "/openapi.json"),
            type: "application/vnd.oai.openapi+json",
          },
        ],
        "service-doc": [
          {
            href: "https://github.com/alexasomba/better-auth-paystack#readme",
            type: "text/html",
          },
        ],
        status: [
          {
            href: absoluteUrl(origin, "/api/health"),
            type: "application/json",
          },
        ],
      },
    ],
  };
}

export function getOidcConfiguration(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: absoluteUrl(origin, "/api/auth/sign-in"),
    token_endpoint: absoluteUrl(origin, "/api/auth/token"),
    jwks_uri: absoluteUrl(origin, "/api/auth/jwks"),
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    scopes_supported: ["openid", "profile", "email"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
  };
}

export function getOAuthProtectedResource(origin: string) {
  return {
    resource: absoluteUrl(origin, "/api"),
    authorization_servers: [origin],
    scopes_supported: ["openid", "profile", "email"],
  };
}

export function getMcpServerCard(origin: string) {
  return {
    serverInfo: {
      name: "better-auth-paystack-tanstack-example",
      version: "1.0.0",
    },
    transport: {
      type: "streamable-http",
      endpoint: absoluteUrl(origin, "/mcp"),
    },
    capabilities: {
      tools: {
        listChanged: false,
      },
      resources: {},
      prompts: {},
    },
  };
}

export async function getAgentSkillsIndex(origin: string) {
  const digest = await sha256(paystackSkillMarkdown);

  return {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills: [
      {
        name: "better-auth-paystack-demo",
        type: "skill-md",
        description:
          "Inspect the Better Auth Paystack TanStack Start demo and its discovery resources.",
        url: absoluteUrl(origin, "/.well-known/agent-skills/better-auth-paystack-demo/SKILL.md"),
        digest: `sha256:${digest}`,
      },
    ],
  };
}

export function markdownTokenCount(markdown: string) {
  return markdown.trim().split(/\s+/u).filter(Boolean).length.toString();
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hashBuffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
