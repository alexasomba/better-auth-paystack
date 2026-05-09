import { createMiddleware, createStart } from "@tanstack/react-start";
import { homeMarkdown, linkHeader, markdownTokenCount } from "@/lib/agent-discovery";

const agentDiscoveryMiddleware = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);
  const acceptsMarkdown = request.headers.get("accept")?.includes("text/markdown") === true;

  if (request.method === "GET" && url.pathname === "/" && acceptsMarkdown) {
    return new Response(homeMarkdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        Link: linkHeader,
        "x-markdown-tokens": markdownTokenCount(homeMarkdown),
      },
    });
  }

  const result = await next();
  const response = result.response;

  if (request.method === "GET" && url.pathname === "/" && response !== undefined) {
    response.headers.set("Link", linkHeader);
  }

  return result;
});

export const startInstance = createStart(() => ({
  requestMiddleware: [agentDiscoveryMiddleware],
}));
