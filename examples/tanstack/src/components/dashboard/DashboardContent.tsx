import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GithubLogo, Package, User, Scroll, Clock, IdentificationCard } from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SignOutButton from "./SignOutButton";
import PaymentManager from "./PaymentManager";
import TransactionsTable from "./TransactionsTable";

interface DashboardContentProps {
    session: {
        user: {
            id: string;
            name: string;
            email?: string | null;
            image?: string | null;
        };
    };
}

export default function DashboardContent({ session }: DashboardContentProps) {
    if (!session?.user) {
        return null;
    }

    return (
        <div className="flex flex-col min-h-screen font-sans">
            <main className="flex-1 flex flex-col items-center justify-center p-8">
                <div className="w-full max-w-3xl">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold">Dashboard</h1>
                        <p className="text-sm text-gray-500 mt-2">Powered by better-auth-paystack</p>
                    </div>

                    <Tabs defaultValue="user" className="w-full">
                        <div className="relative mb-6">
                            <TabsList className="flex items-center justify-center w-full h-12 p-1 bg-muted/50 rounded-xl overflow-hidden gap-1">
                                <TabsTrigger value="user" className="group flex-none w-12 sm:flex-1 sm:w-auto data-active:flex-1 data-active:min-w-28 gap-2 rounded-lg data-active:bg-background data-active:shadow-sm transition-all duration-300 py-2 px-2">
                                    <User weight="duotone" className="size-4 shrink-0" />
                                    <span className="text-xs sm:text-sm font-medium hidden group-data-active:inline sm:inline">User Info</span>
                                </TabsTrigger>
                                <TabsTrigger value="subscriptions" className="group flex-none w-12 sm:flex-1 sm:w-auto data-active:flex-1 data-active:min-w-32 gap-2 rounded-lg data-active:bg-background data-active:shadow-sm transition-all duration-300 py-2 px-2">
                                    <Scroll weight="duotone" className="size-4 shrink-0" />
                                    <span className="text-xs sm:text-sm font-medium hidden group-data-active:inline sm:inline">Subscriptions</span>
                                </TabsTrigger>
                                <TabsTrigger value="one-time" className="group flex-none w-12 sm:flex-1 sm:w-auto data-active:flex-1 data-active:min-w-28 gap-2 rounded-lg data-active:bg-background data-active:shadow-sm transition-all duration-300 py-2 px-2">
                                    <IdentificationCard weight="duotone" className="size-4 shrink-0" />
                                    <span className="text-xs sm:text-sm font-medium hidden group-data-active:inline sm:inline">One-Time</span>
                                </TabsTrigger>
                                <TabsTrigger value="transactions" className="group flex-none w-12 sm:flex-1 sm:w-auto data-active:flex-1 data-active:min-w-32 gap-2 rounded-lg data-active:bg-background data-active:shadow-sm transition-all duration-300 py-2 px-2">
                                    <Clock weight="duotone" className="size-4 shrink-0" />
                                    <span className="text-xs sm:text-sm font-medium hidden group-data-active:inline sm:inline">Transactions</span>
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="user" className="space-y-6">
                            <Card className="w-full">
                                <CardHeader>
                                    <CardTitle className="text-xl font-semibold">User Information</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center gap-4 mb-4">
                                        <Avatar size="lg" className="ring-2 ring-primary/10">
                                            <AvatarImage src={session.user?.image || undefined} alt={session.user?.name || ""} />
                                            <AvatarFallback>
                                                <User weight="duotone" className="size-6 text-muted-foreground" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-lg font-semibold">
                                                {session.user?.name || "Anonymous User"}
                                            </p>
                                            <p className="text-sm text-muted-foreground">Logged in via better-auth</p>
                                        </div>
                                    </div>
                                    {session.user?.email && (
                                        <p className="text-md wrap-break-word">
                                            <strong>Email:</strong>{" "}
                                            <span className="break-all">{session.user.email}</span>
                                        </p>
                                    )}
                                    {!session.user?.email && (
                                        <p className="text-md">
                                            <strong>Account Type:</strong> Anonymous
                                        </p>
                                    )}
                                    {session.user?.id && (
                                        <p className="text-md">
                                            <strong>User ID:</strong> {session.user.id}
                                        </p>
                                    )}
                                    <SignOutButton />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="subscriptions" className="space-y-6">
                            <PaymentManager activeTab="subscriptions" />
                        </TabsContent>

                        <TabsContent value="one-time" className="space-y-6">
                            <PaymentManager activeTab="one-time" />
                        </TabsContent>

                        <TabsContent value="transactions" className="space-y-6">
                            <Card className="w-full">
                                <CardHeader>
                                    <CardTitle className="text-xl font-semibold">Transaction History</CardTitle>
                                    <p className="text-sm text-gray-600">
                                        View and track your previous Paystack transactions
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    <TransactionsTable />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </main>

            <footer className="w-full text-center text-sm text-gray-500 py-4 mt-8">
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
