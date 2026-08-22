import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import DashboardContent from "@/components/dashboard/DashboardContent";
import { auth } from "@/lib/auth";
import { createSeoHead } from "@/lib/seo";

const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  return session;
});

export const Route = createFileRoute("/dashboard")({
  head: () =>
    createSeoHead({
      title: "Billing Dashboard",
      description:
        "Authenticated billing dashboard for the Better Auth Paystack TanStack Start example.",
      path: "/dashboard",
      noIndex: true,
    }),
  component: DashboardPage,
  loader: async () => {
    const session = await getSession();

    if (session?.user === null || session?.user === undefined) {
      throw redirect({ to: "/" });
    }

    return {
      session,
    };
  },
});

function DashboardPage() {
  const { session } = Route.useLoaderData();
  return <DashboardContent session={session} />;
}
