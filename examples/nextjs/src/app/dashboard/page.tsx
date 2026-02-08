import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getAuth } from "@/auth";
import DashboardContent from "./DashboardContent";

export default async function DashboardPage() {
    const cookieStore = await cookies();
    
    // Build cookie header from cookieStore for auth.api.getSession
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');
    
    // Get auth instance with D1 database and retrieve session
    const auth = await getAuth();
    const session = await auth.api.getSession({
        headers: new Headers({ cookie: cookieHeader }),
    });
    
    console.log("Dashboard page session:", session ? "FOUND" : "NOT FOUND", session?.user?.id);

    if (!session) {
        console.log("No session found, redirecting to /");
        redirect("/");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <DashboardContent session={session as any} />;
}
