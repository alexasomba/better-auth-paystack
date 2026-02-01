"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Sparkle, CheckCircle, Coins, ArrowRight, ShieldCheck } from "@phosphor-icons/react";

interface Subscription {
  plan: string;
  status: string;
  paystackSubscriptionCode?: string;
}

export default function PaymentManager({ activeTab }: { activeTab: "subscriptions" | "one-time" }) {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        async function fetchSubscriptions() {
            try {
                const res = await authClient.paystack.subscription.listLocal({ query: {} });
                if (res.data) {
                    const data = res.data as unknown as { subscriptions: Subscription[] } | Subscription[];
                    setSubscriptions(Array.isArray(data) ? data : data.subscriptions || []);
                }
            } catch (e) {
                console.error("Failed to fetch subscriptions", e);
            } finally {
                setIsLoading(false);
            }
        }
        fetchSubscriptions();
    }, []);

    const handleSubscribe = async () => {
        setActionLoading(true);
        try {
            const res = await authClient.paystack.transaction.initialize({
                plan: "starter",
                callbackURL: `${window.location.origin}/billing/paystack/callback`,
            });
            if (res?.data?.url) {
                window.location.href = res.data.url;
            } else {
                alert("Failed to get redirect URL from Paystack");
            }
        } catch (e: unknown) {
            console.error(e);
            if (e instanceof Error) {
                alert(e.message || "Failed to initialize payment");
            }
            setActionLoading(false);
        }
    };

    const handleManageSubscription = async (subscriptionCode: string) => {
        setActionLoading(true);
        try {
            await authClient.paystack.subscription.disable({
                subscriptionCode,
            });
            const res = await authClient.paystack.subscription.listLocal({ query: {} });
            if (res.data) {
                const data = res.data as unknown as { subscriptions: Subscription[] } | Subscription[];
                setSubscriptions(Array.isArray(data) ? data : data.subscriptions || []);
            }
        } catch (e: unknown) {
            console.error(e);
            if (e instanceof Error) {
                alert(e.message || "Failed to manage subscription");
            }
        } finally {
            setActionLoading(false);
        }
    };

    const handleBuyCredits = async () => {
        setActionLoading(true);
        try {
            const res = await authClient.paystack.transaction.initialize({
                amount: 250000, 
                currency: "NGN",
                metadata: { type: "credits", quantity: 50 },
                callbackURL: `${window.location.origin}/billing/paystack/callback`,
            });
            if (res?.data?.url) {
                window.location.href = res.data.url;
            } else {
                alert("Failed to get redirect URL from Paystack");
            }
        } catch (e: unknown) {
            console.error(e);
            if (e instanceof Error) {
                alert(e.message || "Failed to initialize payment");
            }
            setActionLoading(false);
        }
    };

    if (isLoading) {
        return <div className="text-center py-8 text-muted-foreground animate-pulse">Loading billing details...</div>;
    }

    const activeSubscription = subscriptions?.find((sub: Subscription) => sub.status === "active" || sub.status === "non-renewing");

    if (activeTab === "subscriptions") {
        return (
            <Card className="w-full">
                <CardHeader>
                    <CardTitle className="text-xl font-semibold">Subscription Plan</CardTitle>
                    <p className="text-sm text-muted-foreground">Manage your recurring billing and plan status.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                    {activeSubscription ? (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/10 rounded-lg">
                                <div>
                                    <p className="font-medium text-primary uppercase text-xs tracking-wider flex items-center gap-1">
                                        <Sparkle weight="duotone" className="size-3" />
                                        Current Plan
                                    </p>
                                    <p className="text-2xl font-bold capitalize">{activeSubscription.plan}</p>
                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                        Status: <span className="text-green-600 font-medium lowercase">{activeSubscription.status}</span>
                                    </p>
                                </div>
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                    <CheckCircle weight="duotone" className="text-primary size-6" />
                                </div>
                            </div>
                            {activeSubscription.paystackSubscriptionCode && (
                                <Button
                                    onClick={() => handleManageSubscription(activeSubscription.paystackSubscriptionCode!)}
                                    variant="outline"
                                    disabled={actionLoading}
                                    className="w-full h-11"
                                >
                                    {actionLoading ? "Processing..." : "Cancel Subscription"}
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="p-4 bg-muted/30 border border-dashed rounded-lg text-center">
                                <p className="text-muted-foreground italic">You don&apos;t have an active subscription.</p>
                            </div>
                            <Button onClick={handleSubscribe} disabled={actionLoading} className="w-full h-11 bg-primary hover:bg-primary/90 gap-2">
                                <CreditCard weight="duotone" className="size-5" />
                                {actionLoading ? "Initializing..." : "Subscribe to Starter (NGN 5,000/mo)"}
                                <ArrowRight className="size-4 ml-auto" />
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-xl font-semibold">One-Time Credits</CardTitle>
                <p className="text-sm text-muted-foreground">Purchase credits for extra features. No recurring commitment.</p>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4">
                        <div className="p-4 border rounded-lg hover:border-primary/50 transition-colors cursor-default bg-muted/5">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="font-bold text-xl">50 Credits</p>
                                    <p className="text-sm text-muted-foreground">Premium features & usage</p>
                                </div>
                                <p className="font-bold text-lg text-primary">NGN 2,500</p>
                            </div>
                            <Button 
                                onClick={handleBuyCredits} 
                                disabled={actionLoading} 
                                variant="default"
                                className="w-full mt-2 h-10 gap-2"
                            >
                                <Coins weight="duotone" className="size-5" />
                                {actionLoading ? "Initializing..." : "Buy Now"}
                            </Button>
                        </div>
                    </div>
                    <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest flex items-center justify-center gap-1">
                        <ShieldCheck weight="duotone" className="size-3" />
                        Secure payments by Paystack
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
