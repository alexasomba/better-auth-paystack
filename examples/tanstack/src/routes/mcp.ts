import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      GET: () => {
        return Response.json({
          jsonrpc: "2.0",
          error: {
            code: -32_000,
            message: "MCP transport is advertised for discovery only in this demo.",
          },
        });
      },
      POST: () => {
        return Response.json({
          jsonrpc: "2.0",
          result: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            serverInfo: {
              name: "better-auth-paystack-tanstack-example",
              version: "1.0.0",
            },
          },
        });
      },
    },
  },
});
