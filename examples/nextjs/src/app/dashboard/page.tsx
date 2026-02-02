import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import DashboardContent from "./DashboardContent";

export default async function DashboardPage() {
    // Fetch session using next/headers per better-auth docs for server components
    const h = await headers();
    const session = await auth.api.getSession({ headers: h });

    if (!session) {
        redirect("/"); // Redirect to home if no session
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <DashboardContent session={session as any} />;
}
