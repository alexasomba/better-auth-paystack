import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { headers } from "next/headers";
import HomeClient from "@/components/home-client";

export default async function Home() {
    const h = await headers();
    const session = await auth.api.getSession({ headers: h });

    if (session) {
        redirect("/dashboard");
    }

    return <HomeClient />;
}
