"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface Subscription {
  plan: string;
  status: string;
  paystackSubscriptionCode?: string;
}

export default function SubscriptionManager() {
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
            console.log("Paystack Initialize Response:", res);
            if (res?.data?.url) {
                window.location.href = res.data.url;
            } else {
                console.error("No redirect URL found in response", res);
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
            // Refresh subscriptions
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
        return <div className="text-center py-4">Loading subscriptions...</div>;
    }

    const activeSubscription = subscriptions?.find((sub) => sub.status === "active" || sub.status === "non-renewing");

    return (
        <div className="space-y-4">
            {activeSubscription ? (
                <div className="space-y-3">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="font-semibold text-green-900">Active Subscription</p>
                        <p className="text-sm text-green-700">Plan: {activeSubscription.plan}</p>
                        <p className="text-sm text-green-700">Status: {activeSubscription.status}</p>
                    </div>
                    {activeSubscription.paystackSubscriptionCode && (
                        <Button
                            onClick={() => handleManageSubscription(activeSubscription.paystackSubscriptionCode!)}
                            variant="outline"
                            disabled={actionLoading}
                            className="w-full"
                        >
                            {actionLoading ? "Processing..." : "Disable Subscription"}
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-gray-700">No active subscription</p>
                        <p className="text-sm text-gray-600">Subscribe to test the Paystack integration</p>
                    </div>
                    <Button onClick={handleSubscribe} disabled={actionLoading} className="w-full">
                        {actionLoading ? "Initializing..." : "Subscribe (Starter Plan - NGN 5,000)"}
                    </Button>
                </div>
            )}
        </div>
    );
}
