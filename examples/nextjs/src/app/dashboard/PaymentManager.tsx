"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Sparkle, CheckCircle, Coins, ShieldCheck, ArrowRight } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";

interface Subscription {
  plan: string;
  status: string;
  paystackSubscriptionCode?: string;
}

interface PaystackPlan {
    name: string;
    amount: number;
    currency: string;
    interval?: string;
}

interface PaystackProduct {
    name: string;
    amount: number;
    currency: string;
    metadata?: Record<string, unknown>;
}

export default function PaymentManager({ activeTab }: { activeTab: "subscriptions" | "one-time" }) {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [config, setConfig] = useState<{ plans: PaystackPlan[], products: PaystackProduct[] }>({ plans: [], products: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        async function fetchData() {
            try {
                const [subRes, configRes] = await Promise.all([
                    authClient.paystack.subscription.listLocal({ query: {} }),
                    authClient.paystack.getConfig(),
                ]);

                if (subRes.data) {
                    const data = subRes.data as unknown as { subscriptions: Subscription[] } | Subscription[];
                    setSubscriptions(Array.isArray(data) ? data : data.subscriptions || []);
                }
                
                if (configRes.data) {
                    const data = configRes.data as { plans: PaystackPlan[], products: PaystackProduct[] };
                    setConfig(data);
                }
            } catch (e) {
                console.error("Failed to fetch billing data", e);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    const handleSubscribe = async (planName: string) => {
        setActionLoading(true);
        try {
            const res = await authClient.paystack.transaction.initialize({
                plan: planName,
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

    const handleBuyProduct = async (product: PaystackProduct) => {
        setActionLoading(true);
        try {
            const res = await authClient.paystack.transaction.initialize({
                amount: product.amount, 
                currency: product.currency,
                metadata: product.metadata,
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

    const handleManageBilling = async (subscriptionCode: string) => {
        setActionLoading(true);
        try {
            const res = await authClient.paystack.subscription.manageLink({
                query: { subscriptionCode },
            });
            if (res.data?.link) {
                window.location.href = res.data.link;
            } else {
                alert("Failed to get management link from Paystack");
            }
        } catch (e: unknown) {
            console.error(e);
            if (e instanceof Error) {
                alert(e.message || "Failed to fetch management link");
            }
        } finally {
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

    if (isLoading) {
        return <div className="text-center py-8 text-muted-foreground animate-pulse">Loading billing details...</div>;
    }

    const activeSubscription = subscriptions?.find((sub: Subscription) => sub.status === "active" || sub.status === "non-renewing");

    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: currency,
        }).format(amount / 100);
    };

    if (activeTab === "subscriptions") {
        return (
            <Card className="w-full">
                <CardHeader>
                    <CardTitle className="text-xl font-semibold">Subscription Plans</CardTitle>
                    <p className="text-sm text-muted-foreground">Choose a plan or manage your current subscription.</p>
                </CardHeader>
                <CardContent className="space-y-6">
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
                                <div className="flex flex-col gap-3">
                                    <Button
                                        onClick={() => handleManageBilling(activeSubscription.paystackSubscriptionCode!)}
                                        disabled={actionLoading}
                                        className="w-full h-11 gap-2"
                                    >
                                        <ArrowRight className="size-4" />
                                        {actionLoading ? "Loading..." : "Manage Billing & Upgrade"}
                                    </Button>
                                    <Button
                                        onClick={() => handleManageSubscription(activeSubscription.paystackSubscriptionCode!)}
                                        variant="outline"
                                        disabled={actionLoading}
                                        className="w-full h-11"
                                    >
                                        {actionLoading ? "Processing..." : "Cancel Subscription"}
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {config.plans.map((plan) => (
                                <div key={plan.name} className="flex flex-col p-4 border rounded-xl bg-muted/20 hover:border-primary/50 transition-all group">
                                    <div className="mb-4">
                                        <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">{plan.name}</p>
                                        <p className="text-2xl font-bold">{formatCurrency(plan.amount, plan.currency)}</p>
                                        <p className="text-xs text-muted-foreground italic">billed {plan.interval || "monthly"}</p>
                                    </div>
                                    <div className="mt-auto">
                                        <Button 
                                            onClick={() => handleSubscribe(plan.name)} 
                                            disabled={actionLoading} 
                                            className="w-full h-10 gap-2 text-xs"
                                        >
                                            <CreditCard weight="duotone" className="size-4" />
                                            {actionLoading ? "Starting..." : `Select ${plan.name}`}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-xl font-semibold">One-Time Payments</CardTitle>
                <p className="text-sm text-muted-foreground">Purchase fixed packs or top up your account balance.</p>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {config.products.length > 0 ? config.products.map((product) => (
                            <div key={product.name} className="p-4 border rounded-lg hover:border-primary/50 transition-colors cursor-default bg-muted/5 flex flex-col justify-between">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="font-bold text-lg">{product.name}</p>
                                        <p className="text-xs text-muted-foreground">One-time payment</p>
                                    </div>
                                    <Badge variant="outline" className="text-primary border-primary/20">{formatCurrency(product.amount, product.currency)}</Badge>
                                </div>
                                <Button 
                                    onClick={() => handleBuyProduct(product)} 
                                    disabled={actionLoading} 
                                    variant="default"
                                    className="w-full h-10 gap-2"
                                >
                                    <Coins weight="duotone" className="size-5" />
                                    {actionLoading ? "Initializing..." : "Buy Now"}
                                </Button>
                            </div>
                        )) : (
                            <div className="col-span-full p-8 text-center text-muted-foreground border border-dashed rounded-lg">
                                No one-time products configured.
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest flex items-center justify-center gap-1 pt-4 border-t">
                        <ShieldCheck weight="duotone" className="size-3" />
                        Secure payments by Paystack
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
