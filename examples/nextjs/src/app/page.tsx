"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { GithubLogo, Package } from "@phosphor-icons/react";
import { useState } from "react";

export default function Home() {
    const { error: sessionError } = authClient.useSession();
    const [isAuthActionInProgress, setIsAuthActionInProgress] = useState(false);

    const handleAnonymousLogin = async () => {
        setIsAuthActionInProgress(true);
        try {
            const result = await authClient.signIn.anonymous();
            console.log("Anonymous login result:", result);

            if (result.error) {
                setIsAuthActionInProgress(false);
                alert(`Anonymous login failed: ${result.error.message}`);
            } else {
                // Login succeeded - force reload to update session
                window.location.href = "/dashboard";
            }
        } catch (e: unknown) {
            setIsAuthActionInProgress(false);
            const message = e instanceof Error ? e.message : "Unknown error";
            alert(`An unexpected error occurred during login: ${message}`);
        }
    };

    if (sessionError) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <p>Error loading session: {sessionError.message}</p>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen p-8 font-(family-name:--font-geist-sans)">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-2xl">Login</CardTitle>
                    <CardDescription>Powered by better-auth-paystack.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <p className="text-sm text-gray-600 text-center">No personal information required.</p>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleAnonymousLogin} className="w-full" disabled={isAuthActionInProgress}>
                        {isAuthActionInProgress ? "Logging In..." : "Login Anonymously"}
                    </Button>
                </CardFooter>
            </Card>
            <footer className="absolute bottom-0 w-full text-center text-sm text-gray-500 py-4">
                <div className="space-y-3">
                    <div>Powered by better-auth-paystack</div>
                    <div className="flex items-center justify-center gap-4">
                        <a
                            href="https://github.com/alexasomba/better-auth-paystack"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                        >
                            <GithubLogo weight="duotone" size={16} />
                            <span>GitHub</span>
                        </a>
                        <a
                            href="https://www.npmjs.com/package/@alexasomba/better-auth-paystack"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                        >
                            <Package weight="duotone" size={16} />
                            <span>npm</span>
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
