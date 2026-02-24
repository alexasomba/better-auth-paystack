import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Buildings, CheckCircle, Coins, CreditCard, Package, ShieldCheck, Sparkle, User } from "@phosphor-icons/react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    planCode?: string;
    paystackId?: string;
}

interface PaystackProduct {
    id?: string;
    name: string;
    amount: number;
    currency: string;
    metadata?: Record<string, unknown> | string;
    description?: string;
    features?: Array<string>;
    slug?: string;
    paystackId?: string;
}

interface Organization {
    id: string;
    name: string;
    slug: string;
}


export default function PaymentManager({ activeTab }: { activeTab: "subscriptions" | "one-time" }) {
    const [subscriptions, setSubscriptions] = useState<Array<Subscription>>([]);
    const [config, setConfig] = useState<{ plans: Array<PaystackPlan>, products: Array<PaystackProduct> }>({ plans: [], products: [] });
    const [nativeProducts, setNativeProducts] = useState<Array<PaystackProduct>>([]);
    const [nativePlans, setNativePlans] = useState<Array<PaystackPlan>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [organizations, setOrganizations] = useState<Array<Organization>>([]);
    const [selectedBillingTarget, setSelectedBillingTarget] = useState<string>("personal"); // "personal" or org.id
    const [quantity, setQuantity] = useState(1);


    const fetchNativeProducts = useCallback(async () => {
        try {
            const res = await authClient.paystack.listProducts();
            if (res.data?.products) {
                setNativeProducts(res.data.products as unknown as Array<PaystackProduct>);
            }
        } catch (e) {
            console.error("Failed to fetch native products", e);
        }
    }, []);

    const fetchNativePlans = useCallback(async () => {
        try {
            const res = await authClient.paystack.listPlans();
            if (res.data?.plans) {
                setNativePlans(res.data.plans as Array<PaystackPlan>);
            }
        } catch (e) {
            console.error("Failed to fetch native plans", e);
        }
    }, []);

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const [configRes, subsRes] = await Promise.all([
                    authClient.paystack.getConfig(),
                    authClient.paystack.subscription.listLocal({
                        query: { referenceId: selectedBillingTarget !== "personal" ? selectedBillingTarget : undefined }
                    })
                ]);
                
                if (configRes.data) {
                    setConfig(configRes.data as unknown as { plans: Array<PaystackPlan>, products: Array<PaystackProduct> });
                }
                if (subsRes.data?.subscriptions) {
                    setSubscriptions(subsRes.data.subscriptions as Array<Subscription>);
                }
            } catch (e) {
                console.error("Failed to fetch data", e);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
        fetchNativeProducts();
        fetchNativePlans();
    }, [selectedBillingTarget, fetchNativeProducts, fetchNativePlans]);

    const handleSyncProducts = async () => {
        setActionLoading(true);
        try {
            const res = await authClient.paystack.syncProducts();
            if (res.data?.status === "success") {
                await fetchNativeProducts();
                alert(`Successfully synced ${res.data.count} products from Paystack.`);
            }
        } catch (e) {
            console.error("Failed to sync products", e);
            alert("Failed to sync products from Paystack.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleSyncPlans = async () => {
        setActionLoading(true);
        try {
            const res = await authClient.paystack.syncPlans();
            if (res.data?.status === "success") {
                await fetchNativePlans();
                alert(`Successfully synced ${res.data.count} plans from Paystack.`);
            }
        } catch (e) {
            console.error("Failed to sync plans", e);
            alert("Failed to sync plans from Paystack.");
        } finally {
            setActionLoading(false);
        }
    };

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
            // If billing to an organization, pass referenceId
            if (selectedBillingTarget && selectedBillingTarget !== "personal") {
                initPayload.referenceId = selectedBillingTarget;
                // Add quantity/seats for organization billing
                if (quantity > 1) {
                    (initPayload as any).quantity = quantity;
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
            const metadata = typeof product.metadata === 'string' ? JSON.parse(product.metadata) : product.metadata;
            const res = await authClient.paystack.transaction.initialize({
                product: product.name,
                amount: (product as any).price || (product as any).amount, 
                currency: product.currency,
                metadata: metadata,
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

    // Subscription management functions are now handled via Paystack management link
    // or can be re-enabled if needed:
    // const handleManageSubscription = ...
    // const handleResumeSubscription = ...

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
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-xl font-semibold">Subscription Plans</CardTitle>
                        <p className="text-sm text-muted-foreground">Choose a plan that fits your needs.</p>
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleSyncPlans} 
                        disabled={actionLoading}
                        className="gap-2"
                    >
                        <ArrowRight className={cn("transition-transform", actionLoading && "animate-spin")} />
                        Sync Native Plans
                    </Button>
                </CardHeader>
                <CardContent className="space-y-8">
                    {/* Active Subscription Summary */}
                    {activeSubscription && (
                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <Sparkle weight="duotone" size={20} className="text-primary" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">Active {activeSubscription.plan} Plan</p>
                                    <p className="text-xs text-muted-foreground">
                                        Status: <span className="capitalize">{activeSubscription.status.replace("_", " ")}</span>
                                        {activeSubscription.cancelAtPeriodEnd && " (Ends at period end)"}
                                    </p>
                                </div>
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
                                        Manage Billing
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
                            <Select 
                                data-testid="billing-target-select"
                                value={selectedBillingTarget} 
                                onValueChange={(val) => val && setSelectedBillingTarget(val)}
                            >
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

                            {selectedBillingTarget !== "personal" && (
                                <div className="mt-4 pt-4 border-t border-dashed">
                                    <Label htmlFor="seats" className="text-xs font-medium mb-1.5 block">Number of Seats</Label>
                                    <div className="flex items-center gap-3">
                                        <Input 
                                            id="seats"
                                            type="number" 
                                            min={1} 
                                            max={100}
                                            value={quantity} 
                                            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                            className="w-24 h-9"
                                        />
                                        <p className="text-[10px] text-muted-foreground italic">
                                            Pricing scales linearly based on seat count.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Local Plans Section */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Sparkle weight="duotone" className="text-primary" />
                                Better Auth Config Plans
                            </h3>
                            <p className="text-xs text-muted-foreground">Plans defined in your application configuration.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {config.plans.map((plan) => (
                                <PlanCard key={plan.name} plan={plan} variant="local" />
                            ))}
                        </div>
                    </div>

                    {/* Native Plans Section */}
                    <div className="space-y-4 border-t pt-8 border-dashed">
                        <div>
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Package weight="duotone" className="text-primary" />
                                Paystack-&gt;DB Synced Plans
                            </h3>
                            <p className="text-xs text-muted-foreground">Plans synced directly from Paystack.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {nativePlans.length > 0 ? nativePlans.map((plan) => (
                                <PlanCard key={plan.paystackId || plan.planCode} plan={plan} variant="native" />
                            )) : (
                                <div className="col-span-full p-8 text-center text-muted-foreground border border-dashed rounded-lg">
                                    No native plans found. Click "Sync Native Plans" to import from Paystack.
                                </div>
                            )}
                        </div>
                    </div>

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
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold">Better Auth Config Products</h3>
                            <p className="text-xs text-muted-foreground">Products defined locally in your application configuration.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {config.products.length > 0 ? config.products.map((product) => (
                                <div key={product.name} className="p-4 border rounded-lg hover:border-primary/50 transition-colors cursor-default bg-muted/5 flex flex-col justify-between">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="font-bold text-lg">{product.name}</p>
                                            <p className="text-xs text-muted-foreground">One-time payment</p>
                                        </div>
                                        <Badge variant="outline" className="text-primary border-primary/20">{formatCurrency((product as any).price || (product as any).amount, product.currency)}</Badge>
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
                                    No one-time products configured locally.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-dashed">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold">Paystack-&gt;DB Synced Products</h3>
                                <p className="text-xs text-muted-foreground">Products synced automatically from your Paystack dashboard.</p>
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleSyncProducts} 
                                disabled={actionLoading}
                                className="gap-2"
                            >
                                <ArrowRight className={cn("transition-transform", actionLoading && "animate-spin")} />
                                Sync Now
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {nativeProducts.length > 0 ? nativeProducts.map((product) => (
                                <div key={product.id || product.paystackId} className="p-4 border rounded-lg hover:border-primary/50 transition-colors cursor-default bg-muted/5 flex flex-col justify-between">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="font-bold text-lg">{product.name}</p>
                                            <p className="text-xs text-muted-foreground truncate max-w-37.5">{product.description || "Synced Product"}</p>
                                        </div>
                                        <Badge variant="outline" className="text-primary border-primary/20">{formatCurrency(product.amount, product.currency)}</Badge>
                                    </div>
                                    <Button 
                                        onClick={() => handleBuyProduct(product)} 
                                        disabled={actionLoading} 
                                        variant="secondary"
                                        className="w-full h-10 gap-2 border-primary/10"
                                    >
                                        <Package weight="duotone" size={20} />
                                        {actionLoading ? "Initializing..." : "Purchase"}
                                    </Button>
                                </div>
                            )) : (
                                <div className="col-span-full p-8 text-center text-muted-foreground border border-dashed rounded-lg">
                                    No native products found. Click "Sync Now" to import from Paystack.
                                </div>
                            )}
                        </div>
                    </div>

                    <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest flex items-center justify-center gap-1 pt-4 border-t">
                        <ShieldCheck weight="duotone" size={12} />
                        Secure payments by Paystack
                    </p>
                </div>
            </CardContent>
        </Card>
    );

    function PlanCard({ plan, variant }: { plan: PaystackPlan, variant: 'local' | 'native' }) {
        const activeSubscription = subscriptions.find((sub: Subscription) => ["active", "trialing", "non-renewing", "past_due", "unpaid"].includes(sub.status));
        const isCurrentPlan = activeSubscription?.plan.toLowerCase() === plan.name.toLowerCase();
        
        // Dynamic amount based on quantity for organizations, but only for local/custom plans
        // Native plans have fixed pricing on Paystack.
        const isNative = variant === 'native' || !!plan.planCode;
        const displayAmount = (selectedBillingTarget !== "personal" && !isNative) 
            ? (plan.amount ?? 0) * quantity 
            : plan.amount;

        return (
            <div 
                className={cn(
                    "relative flex flex-col p-5 border rounded-2xl transition-all duration-300 group",
                    isCurrentPlan 
                        ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20" 
                        : "bg-muted/20 hover:border-primary/50 hover:bg-muted/30"
                )}
            >
                {isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-sm z-10">
                        Current Plan
                    </div>
                )}

                <div className="absolute top-4 right-4">
                    {isNative ? (
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 shadow-none">
                            Paystack Managed
                        </Badge>
                    ) : (
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider bg-purple-100 text-purple-700 hover:bg-purple-100 border-purple-200 shadow-none">
                            Custom Plan
                        </Badge>
                    )}
                </div>

                <div className="mb-4 mt-6">
                    <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">{plan.name}</p>
                    <div className="flex items-baseline gap-1">
                        <p className="text-3xl font-bold">
                            {displayAmount 
                                ? formatCurrency(displayAmount, plan.currency) 
                                : "Custom"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            /{plan.interval || "mo"}
                            {selectedBillingTarget !== "personal" && quantity > 1 && !isNative && ` for ${quantity} seats`}
                        </p>
                    </div>
                    {plan.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{plan.description}</p>}
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
                        variant={isCurrentPlan ? "outline" : variant === 'native' ? "secondary" : "default"}
                        className="w-full h-11 gap-2"
                    >
                        {isCurrentPlan ? (
                            <>
                                <CheckCircle weight="fill" size={20} />
                                Active
                            </>
                        ) : (
                            <>
                                <CreditCard weight="duotone" size={20} />
                                {actionLoading ? "Processing..." : "Subscribe Now"}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        );
    }
}
