import { createFileRoute } from "@tanstack/react-router";
import { getOrigin, getSitemapXml } from "@/lib/agent-discovery";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: ({ request }) => {
        return new Response(getSitemapXml(getOrigin(request)), {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
          },
        });
      },
    },
  },
});
