import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () => {
        return Response.json({
          ok: true,
          service: "better-auth-paystack-tanstack-example",
        });
      },
    },
  },
});
