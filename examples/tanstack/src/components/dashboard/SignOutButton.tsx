import { SignOut } from "@phosphor-icons/react";
import { useRouter } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut();
    await router.navigate({ to: "/" });
  };

  return (
    <Button onClick={handleSignOut} variant="outline" className="w-full gap-2">
      <SignOut weight="duotone" size={16} />
      Sign Out
    </Button>
  );
}
