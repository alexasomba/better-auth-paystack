import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Github, Package } from "lucide-react";
import { redirect } from "next/navigation";
import SignOutButton from "./SignOutButton";
import PaymentManager from "./PaymentManager";
import TransactionsTable from "./TransactionsTable";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function DashboardPage() {
    // Fetch session using next/headers per better-auth docs for server components
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
        redirect("/"); // Redirect to home if no session
    }

    return (
        <div className="flex flex-col min-h-screen font-(family-name:--font-geist-sans)">
            <main className="flex-1 flex flex-col items-center justify-center p-8">
                <div className="w-full max-w-3xl">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold">Dashboard</h1>
                        <p className="text-sm text-gray-500 mt-2">Powered by better-auth-paystack</p>
                    </div>

                    <Tabs defaultValue="user" className="w-full">
                        <TabsList className="grid w-full grid-cols-4 mb-6">
                            <TabsTrigger value="user">User Info</TabsTrigger>
                            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
                            <TabsTrigger value="one-time">One-Time</TabsTrigger>
                            <TabsTrigger value="transactions">Transactions</TabsTrigger>
                        </TabsList>

                        <TabsContent value="user" className="space-y-6">
                            <Card className="w-full">
                                <CardHeader>
                                    <CardTitle className="text-xl font-semibold">User Information</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-lg">
                                        Welcome,{" "}
                                        <span className="font-semibold">
                                            {session.user?.name || session.user?.email || "Anonymous User"}
                                        </span>
                                        !
                                    </p>
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
                            <Github size={16} />
                            <span>GitHub</span>
                        </a>
                        <a
                            href="https://www.npmjs.com/package/@alexasomba/better-auth-paystack"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                        >
                            <Package size={16} />
                            <span>npm</span>
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
