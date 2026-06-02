import { createFileRoute } from "@tanstack/react-router";
import { getOpenApiDocument, getOrigin } from "@/lib/agent-discovery";

export const Route = createFileRoute("/openapi.json")({
  server: {
    handlers: {
      GET: ({ request }) => {
        return Response.json(getOpenApiDocument(getOrigin(request)), {
          headers: {
            "Content-Type": "application/vnd.oai.openapi+json; charset=utf-8",
          },
        });
      },
    },
  },
});
