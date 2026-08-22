import { createFileRoute } from "@tanstack/react-router";

import {
  getAgentSkillsIndex,
  getApiCatalog,
  getMcpServerCard,
  getOAuthProtectedResource,
  getOidcConfiguration,
  getOrigin,
  paystackSkillMarkdown,
} from "@/lib/agent-discovery";

export const Route = createFileRoute("/.well-known/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const origin = getOrigin(request);
        const splat = params._splat;

        if (splat === "api-catalog") {
          return json(getApiCatalog(origin), "application/linkset+json");
        }

        if (splat === "openid-configuration" || splat === "oauth-authorization-server") {
          return json(getOidcConfiguration(origin));
        }

        if (splat === "oauth-protected-resource") {
          return json(getOAuthProtectedResource(origin));
        }

        if (splat === "mcp/server-card.json") {
          return json(getMcpServerCard(origin));
        }

        if (splat === "agent-skills/index.json") {
          return json(await getAgentSkillsIndex(origin));
        }

        if (splat === "agent-skills/better-auth-paystack-demo/SKILL.md") {
          return new Response(paystackSkillMarkdown, {
            headers: {
              "Content-Type": "text/markdown; charset=utf-8",
            },
          });
        }

        return new Response("Not found", { status: 404 });
      },
    },
  },
});

function json(value: unknown, contentType = "application/json") {
  return Response.json(value, {
    headers: {
      "Content-Type": `${contentType}; charset=utf-8`,
    },
  });
}
