import { Outlet, createFileRoute } from "@tanstack/react-router";

import { createSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/billing")({
  head: () =>
    createSeoHead({
      title: "Billing",
      description: "Billing routes for Better Auth Paystack checkout and verification flows.",
      path: "/billing",
      noIndex: true,
      includeCanonical: false,
    }),
  component: () => <Outlet />,
});
