import { useEffect, useState } from "react";
import { ArrowRight, Buildings, CheckCircle, Clock, Coins, CreditCard, ShieldCheck, Sparkle, User } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface Subscription {
  plan: string;
  status: string;
  paystackSubscriptionCode?: string;
  trialStart?: string;
  trialEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

interface PaystackPlan {
    name: string;
    amount: number;
    currency: string;
    interval?: string;
    description?: string;
    features?: Array<string>;
}

interface PaystackProduct {
    name: string;
    amount: number;
    currency: string;
    metadata?: Record<string, unknown>;
    description?: string;
    features?: Array<string>;
}

interface Organization {
    id: string;
    name: string;
    slug: string;
}


export default function PaymentManager({ activeTab }: { activeTab: "subscriptions" | "one-time" }) {
    const [subscriptions, setSubscriptions] = useState<Array<Subscription>>([]);
    const [config, setConfig] = useState<{ plans: Array<PaystackPlan>, products: Array<PaystackProduct> }>({ plans: [], products: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [organizations, setOrganizations] = useState<Array<Organization>>([]);
    const [selectedBillingTarget, setSelectedBillingTarget] = useState<string>("personal"); // "personal" or org.id
    const [seats, setSeats] = useState<number>(1);

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const query = selectedBillingTarget === "personal" ? {} : { referenceId: selectedBillingTarget };
                const [subRes, configRes] = await Promise.all([
                    authClient.paystack.subscription.listLocal({ query }),
                    authClient.paystack.getConfig(),
                ]);

                if (subRes.data) {
                    const data = subRes.data;
                    if (Array.isArray(data)) {
                        setSubscriptions(data as Array<Subscription>);
                    } else if (data && "subscriptions" in data && Array.isArray(data.subscriptions)) {
                         setSubscriptions(data.subscriptions as Array<Subscription>);
                    }
                }

                if (configRes.data) {
                    const data = configRes.data as { plans: Array<PaystackPlan>, products: Array<PaystackProduct> };
                    setConfig(data);
                }
            } catch (e) {
                console.error("Failed to fetch billing data", e);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [selectedBillingTarget]);

    // Fetch organizations for billing target selection
    useEffect(() => {
        async function fetchOrganizations() {
            try {
                const result = await authClient.organization.list();
                if (result.data) {
                    setOrganizations(result.data as Array<Organization>);
                }
            } catch (e) {
                console.error("Failed to fetch organizations", e);
            }
        }
        fetchOrganizations();
    }, []);

    const handleSubscribe = async (planName: string) => {
        setActionLoading(true);
        try {
            const initPayload: { plan: string; callbackURL: string; referenceId?: string } = {
                plan: planName,
                callbackURL: `${window.location.origin}/billing/paystack/callback`,
            };
            // If billing to an organization, pass referenceId and quantity (seats)
            if (selectedBillingTarget && selectedBillingTarget !== "personal") {
                initPayload.referenceId = selectedBillingTarget;
                if (seats > 1) {
                    (initPayload as any).quantity = seats;
                }
            }
            const res = await authClient.paystack.transaction.initialize(initPayload);
            if (res.data?.url) {
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
            if (res.data?.url) {
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
                subscriptionCode,
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
                const data = res.data;
                if (Array.isArray(data)) {
                    setSubscriptions(data as Array<Subscription>);
                } else if (data && "subscriptions" in data && Array.isArray(data.subscriptions)) {
                     setSubscriptions(data.subscriptions as Array<Subscription>);
                }
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

    const handleResumeSubscription = async (subscriptionCode: string) => {
        setActionLoading(true);
        try {
            await authClient.paystack.subscription.restore({
                subscriptionCode,
            });
            const res = await authClient.paystack.subscription.listLocal({ query: {} });
            if (res.data) {
                const data = res.data;
                if (Array.isArray(data)) {
                    setSubscriptions(data as Array<Subscription>);
                } else if (data && "subscriptions" in data && Array.isArray(data.subscriptions)) {
                     setSubscriptions(data.subscriptions as Array<Subscription>);
                }
            }
        } catch (e: unknown) {
            console.error(e);
            if (e instanceof Error) {
                alert(e.message || "Failed to resume subscription");
            }
        } finally {
            setActionLoading(false);
        }
    };

    if (isLoading) {
        return <div className="text-center py-8 text-muted-foreground animate-pulse">Loading billing details...</div>;
    }


    const activeSubscription = subscriptions.find((sub: Subscription) => ["active", "trialing", "non-renewing", "past_due", "unpaid"].includes(sub.status));

    const formatCurrency = (amount: number | undefined, currency: string | undefined) => {
        if (amount === undefined) return "—";
        const currencyCode = currency || "NGN"; // fallback to NGN
        return new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: currencyCode,
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
                    {activeSubscription && (
                        <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/10 rounded-lg">
                            <div>
                                <p className="font-medium text-primary uppercase text-xs tracking-wider flex items-center gap-1">
                                    <Sparkle weight="duotone" size={12} />
                                    Active Subscription
                                </p>
                                <p className="text-2xl font-bold capitalize">{activeSubscription.plan}</p>
                                <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                    <span className="flex items-center gap-1">
                                        Status: <span className="text-green-600 font-medium lowercase">{activeSubscription.status}</span>
                                    </span>
                                    {activeSubscription.trialEnd && new Date(activeSubscription.trialEnd) > new Date() && (
                                        <>
                                            <span className="text-muted-foreground/30">•</span>
                                            <span className="flex items-center gap-1 text-amber-600">
                                                <Clock size={12} weight="duotone" />
                                                Trial: {Math.ceil((new Date(activeSubscription.trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days left
                                            </span>
                                        </>
                                    )}
                                    {activeSubscription.paystackSubscriptionCode && (
                                        <>
                                            <span className="text-muted-foreground/30">•</span>
                                            {activeSubscription.status === "non-renewing" ? (
                                                <button 
                                                    onClick={() => handleResumeSubscription(activeSubscription.paystackSubscriptionCode!)}
                                                    className="text-xs text-primary hover:text-primary/80 hover:underline transition-all font-medium"
                                                    disabled={actionLoading}
                                                >
                                                    Resume Subscription
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => handleManageSubscription(activeSubscription.paystackSubscriptionCode!)}
                                                    className="text-xs text-red-500 hover:text-red-600 hover:underline transition-all"
                                                    disabled={actionLoading}
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </>
                                    )}
                                </p>
                            </div>
                            <div className="flex flex-col gap-2">
                                {activeSubscription.paystackSubscriptionCode && (
                                    <Button
                                        onClick={() => handleManageBilling(activeSubscription.paystackSubscriptionCode!)}
                                        disabled={actionLoading}
                                        size="sm"
                                        variant="outline"
                                        className="h-9 gap-2 text-xs"
                                    >
                                        <ArrowRight size={12} />
                                        Manage Cards
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Billing Target Selector */}
                    {organizations.length > 0 && (
                        <div className="p-4 bg-muted/30 border border-dashed rounded-lg">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <Buildings weight="duotone" size={20} className="text-primary" />
                                </div>
                                <div>
                                    <p className="font-medium text-sm">Bill To</p>
                                    <p className="text-xs text-muted-foreground">Choose who will be charged for this subscription</p>
                                </div>
                            </div>
                            <Select value={selectedBillingTarget} onValueChange={(val) => val && setSelectedBillingTarget(val)}>
                                <SelectTrigger className="w-full max-w-xs">
                                    <SelectValue placeholder="Select billing target" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="personal">
                                        <div className="flex items-center gap-2">
                                            <User size={16} />
                                            <span>Personal Account</span>
                                        </div>
                                    </SelectItem>
                                    {organizations.map((org) => (
                                        <SelectItem key={org.id} value={org.id}>
                                            <div className="flex items-center gap-2">
                                                <Buildings size={16} />
                                                <span>{org.name}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedBillingTarget && selectedBillingTarget !== "personal" && (
                                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                    <CheckCircle weight="duotone" size={12} className="text-green-500" />
                                    Billing to organization: {organizations.find(o => o.id === selectedBillingTarget)?.name}
                                </p>
                            )}
                            
                            {selectedBillingTarget && selectedBillingTarget !== "personal" && (
                                <div className="mt-4 pt-4 border-t border-dashed">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-primary/10">
                                            <User weight="duotone" size={20} className="text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">Seats</p>
                                            <p className="text-xs text-muted-foreground">Number of members allowed</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => setSeats(Math.max(1, seats - 1))}
                                            disabled={seats <= 1}
                                            className="h-8 w-8 p-0"
                                        >
                                            -
                                        </Button>
                                        <span className="text-sm font-medium w-8 text-center">{seats}</span>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => setSeats(seats + 1)}
                                            className="h-8 w-8 p-0"
                                        >
                                            +
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {config.plans.map((plan) => {
                            const isCurrentPlan = activeSubscription?.plan.toLowerCase() === plan.name.toLowerCase();
                            
                            return (
                                <div 
                                    key={plan.name} 
                                    className={cn(
                                        "relative flex flex-col p-5 border rounded-2xl transition-all duration-300 group",
                                        isCurrentPlan 
                                            ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20" 
                                            : "bg-muted/20 hover:border-primary/50 hover:bg-muted/30"
                                    )}
                                >
                                    {isCurrentPlan && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
                                            Current Plan
                                        </div>
                                    )}
                                    <div className="mb-4">
                                        <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">{plan.name}</p>
                                        <div className="flex items-baseline gap-1">
                                            <p className="text-3xl font-bold">
                                                {plan.amount ? formatCurrency(plan.amount * (selectedBillingTarget !== "personal" ? seats : 1), plan.currency) : "Custom"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                /{plan.interval || "mo"}
                                                {!plan.amount && <span className="ml-1">(Paystack plan)</span>}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <ul className="space-y-2 mb-6 text-sm text-muted-foreground">
                                        <li className="flex items-center gap-2">
                                            <span className="text-primary"><CheckCircle weight="duotone" size={16} /></span>
                                            Full access to all features
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="text-primary"><CheckCircle weight="duotone" size={16} /></span>
                                            Priority support
                                        </li>
                                    </ul>

                                    <div className="mt-auto">
                                        <Button 
                                            onClick={() => !isCurrentPlan && handleSubscribe(plan.name)} 
                                            disabled={actionLoading || isCurrentPlan} 
                                            variant={isCurrentPlan ? "secondary" : "default"}
                                            className={cn(
                                                "w-full h-11 gap-2 text-sm font-semibold transition-all duration-300",
                                                isCurrentPlan && "opacity-50 cursor-default"
                                            )}
                                        >
                                            {isCurrentPlan ? (
                                                <>
                                                    <CheckCircle weight="bold" size={16} />
                                                    Current Plan
                                                </>
                                            ) : (
                                                <>
                                                    <CreditCard weight="duotone" size={16} />
                                                    {actionLoading ? "Processing..." : `Select ${plan.name}`}
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest flex items-center justify-center gap-1 pt-4 border-t">
                        <ShieldCheck weight="duotone" size={12} />
                        Secure payments by Paystack
                    </p>
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
                                    <Coins weight="duotone" size={20} />
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
                        <ShieldCheck weight="duotone" size={12} />
                        Secure payments by Paystack
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
