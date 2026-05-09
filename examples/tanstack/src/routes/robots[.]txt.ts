import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl, getOrigin } from "@/lib/agent-discovery";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = getOrigin(request);

        return new Response(
          `User-agent: *
Disallow:
Content-Signal: ai-train=no, search=yes, ai-input=yes

Sitemap: ${absoluteUrl(origin, "/sitemap.xml")}
`,
          {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
            },
          },
        );
      },
    },
  },
});
