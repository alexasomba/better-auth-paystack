"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/auth/authClient";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  return (
    <nav className="mb-8 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-primary">Better Auth</span>
            <span className="text-foreground">Paystack</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {session ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost">Dashboard</Button>
              </Link>
              <div className="flex items-center gap-2 text-sm text-muted-foreground border-l pl-4">
                <span>{session.user.email}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await authClient.signOut();
                    router.push("/sign-in");
                  }}
                >
                  Sign Out
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button 
                variant="outline"
                onClick={async () => {
                   await authClient.signIn.anonymous();
                   router.push("/dashboard");
                }}
              >
                Guest Sign In
              </Button>
              <Link href="/sign-in">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/sign-up">
                <Button>Sign Up</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
