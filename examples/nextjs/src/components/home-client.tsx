"use client";

import { authClient } from "@/auth/authClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { GithubLogo, Package, Sparkle, Fingerprint, ShieldCheck, RocketLaunch } from "@phosphor-icons/react";
import { useState } from "react";

export default function HomeClient() {
    const { error: sessionError } = authClient.useSession();
    const [isAuthActionInProgress, setIsAuthActionInProgress] = useState(false);

    const handleAnonymousLogin = async () => {
        setIsAuthActionInProgress(true);
        try {
            const result = await authClient.signIn.anonymous();
            if (result.error) {
                setIsAuthActionInProgress(false);
                alert(`Anonymous login failed: ${result.error.message}`);
            } else {
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
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-linear-to-b from-background to-muted/20 font-(family-name:--font-geist-sans)">
            <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center p-2 bg-primary/5 rounded-2xl mb-2">
                        <span className="text-primary"><RocketLaunch weight="duotone" size={32} /></span>
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight">Better Auth + Paystack SDK = ♥</h1>
                    <p className="text-muted-foreground">The ultimate Paystack plugin for Better Auth.</p>
                </div>

                <Card className="border-border/50 shadow-xl shadow-primary/5 backdrop-blur-sm bg-background/80">
                    <CardHeader className="text-center pb-2">
                        <CardTitle className="text-xl flex items-center justify-center gap-2">
                            <span className="text-primary"><Fingerprint weight="duotone" size={20} /></span>
                            Anonymous Login
                        </CardTitle>
                        <CardDescription>Experience seamless payments with one click, powered by better-auth-paystack.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 py-4">
                        <div className="grid grid-cols-1 gap-3 py-2">
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-transparent hover:border-primary/10 transition-colors">
                                <span className="text-primary shrink-0 mt-0.5"><ShieldCheck weight="duotone" size={20} /></span>
                                <div className="space-y-1">
                                    <p className="text-xs font-medium">Secure Checkout</p>
                                    <p className="text-[10px] text-muted-foreground leading-relaxed">Enterprise-grade security for every transaction.</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button 
                            onClick={handleAnonymousLogin} 
                            className="w-full h-11 text-sm font-semibold gap-2 shadow-lg shadow-primary/20 group" 
                            disabled={isAuthActionInProgress}
                        >
                            {isAuthActionInProgress ? (
                                "Logging In..."
                            ) : (
                                <>
                                    <span className="group-hover:animate-pulse"><Sparkle weight="duotone" size={16} /></span>
                                    Login Anonymously
                                </>
                            )}
                        </Button>
                    </CardFooter>
                </Card>

                <p className="text-center text-[11px] text-muted-foreground">
                    No personal information required.
                </p>
            </div>

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
