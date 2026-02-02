import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useRouter } from "@tanstack/react-router";
import { SignOut } from "@phosphor-icons/react";

export default function SignOutButton() {
    const router = useRouter();

    const handleSignOut = async () => {
        await authClient.signOut();
        router.navigate({ to: "/" });
    };

    return (
        <Button onClick={handleSignOut} variant="outline" className="w-full gap-2">
            <SignOut weight="duotone" className="size-4" />
            Sign Out
        </Button>
    );
}
