import { useRouter } from "@tanstack/react-router";
import { SignOut } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export default function SignOutButton() {
    const router = useRouter();

    const handleSignOut = async () => {
        await authClient.signOut();
        router.navigate({ to: "/" });
    };

    return (
        <Button onClick={handleSignOut} variant="outline" className="w-full gap-2">
            <SignOut weight="duotone" size={16} />
            Sign Out
        </Button>
    );
}
