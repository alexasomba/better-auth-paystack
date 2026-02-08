import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { headers } from "next/headers";

export default async function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });

  if (!session) {
    redirect("/");
  }

  return <>{children}</>;
}
