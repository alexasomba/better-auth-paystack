import {
  Buildings,
  Clock,
  GithubLogo,
  IdentificationCard,
  Package,
  Scroll,
  User,
} from "@phosphor-icons/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import OrganizationManager from "./OrganizationManager";
import PaymentManager from "./PaymentManager";
import SignOutButton from "./SignOutButton";
import TransactionsTable from "./TransactionsTable";

interface DashboardContentProps {
  session: {
    user: {
      id: string;
      name: string;
      email?: string | null;
      image?: string | null;
      paystackCustomerCode?: string | null;
    };
  };
}

export default function DashboardContent({ session }: DashboardContentProps) {
  return (
    <div className="flex min-h-screen flex-col font-sans">
      <main className="flex flex-1 flex-col items-center justify-center p-8">
        <div className="w-full max-w-3xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="mt-2 text-sm text-gray-500">Powered by better-auth-paystack</p>
          </div>

          <Tabs defaultValue="user" className="w-full">
            <div className="relative mb-6">
              <TabsList className="flex h-12 w-full items-center justify-center gap-1 overflow-hidden rounded-xl bg-muted/50 p-1">
                <TabsTrigger
                  value="user"
                  className="group w-12 flex-none gap-2 rounded-lg px-2 py-2 transition-all duration-300 data-active:min-w-28 data-active:flex-1 data-active:bg-background data-active:shadow-sm sm:w-auto sm:flex-1"
                >
                  <span className="shrink-0">
                    <User weight="duotone" size={16} />
                  </span>
                  <span className="hidden text-xs font-medium group-data-active:inline sm:inline sm:text-sm">
                    User Info
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="organizations"
                  className="group w-12 flex-none gap-2 rounded-lg px-2 py-2 transition-all duration-300 data-active:min-w-32 data-active:flex-1 data-active:bg-background data-active:shadow-sm sm:w-auto sm:flex-1"
                >
                  <span className="shrink-0">
                    <Buildings weight="duotone" size={16} />
                  </span>
                  <span className="hidden text-xs font-medium group-data-active:inline sm:inline sm:text-sm">
                    Organizations
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="subscriptions"
                  className="group w-12 flex-none gap-2 rounded-lg px-2 py-2 transition-all duration-300 data-active:min-w-32 data-active:flex-1 data-active:bg-background data-active:shadow-sm sm:w-auto sm:flex-1"
                >
                  <span className="shrink-0">
                    <Scroll weight="duotone" size={16} />
                  </span>
                  <span className="hidden text-xs font-medium group-data-active:inline sm:inline sm:text-sm">
                    Subscriptions
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="one-time"
                  className="group w-12 flex-none gap-2 rounded-lg px-2 py-2 transition-all duration-300 data-active:min-w-28 data-active:flex-1 data-active:bg-background data-active:shadow-sm sm:w-auto sm:flex-1"
                >
                  <span className="shrink-0">
                    <IdentificationCard weight="duotone" size={16} />
                  </span>
                  <span className="hidden text-xs font-medium group-data-active:inline sm:inline sm:text-sm">
                    One-Time
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="transactions"
                  className="group w-12 flex-none gap-2 rounded-lg px-2 py-2 transition-all duration-300 data-active:min-w-32 data-active:flex-1 data-active:bg-background data-active:shadow-sm sm:w-auto sm:flex-1"
                >
                  <span className="shrink-0">
                    <Clock weight="duotone" size={16} />
                  </span>
                  <span className="hidden text-xs font-medium group-data-active:inline sm:inline sm:text-sm">
                    Transactions
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="user" className="space-y-6">
              <Card className="w-full">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold">User Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="mb-4 flex items-center gap-4">
                    <Avatar size="lg" className="ring-2 ring-primary/10">
                      <AvatarImage
                        src={session.user.image ?? undefined}
                        alt={session.user.name || ""}
                      />
                      <AvatarFallback>
                        <span className="text-muted-foreground">
                          <User weight="duotone" size={24} />
                        </span>
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-lg font-semibold">
                        {session.user.name || "Anonymous User"}
                      </p>
                      <p className="text-sm text-muted-foreground">Logged in via better-auth</p>
                    </div>
                  </div>
                  {session.user.email !== null &&
                    session.user.email !== undefined &&
                    session.user.email !== "" && (
                      <p className="text-md wrap-break-word">
                        <strong>Email:</strong>{" "}
                        <span className="break-all">{session.user.email}</span>
                      </p>
                    )}
                  {(session.user.email === null ||
                    session.user.email === undefined ||
                    session.user.email === "") && (
                    <p className="text-md">
                      <strong>Account Type:</strong> Anonymous
                    </p>
                  )}
                  {session.user.id !== null &&
                    session.user.id !== undefined &&
                    session.user.id !== "" && (
                      <p className="text-md">
                        <strong>User ID:</strong> {session.user.id}
                      </p>
                    )}
                  {session.user.paystackCustomerCode !== null &&
                    session.user.paystackCustomerCode !== undefined &&
                    session.user.paystackCustomerCode !== "" && (
                      <p className="text-md">
                        <strong>Paystack Customer ID:</strong>{" "}
                        <code className="rounded bg-muted px-1 text-sm text-primary">
                          {session.user.paystackCustomerCode}
                        </code>
                      </p>
                    )}
                  <SignOutButton />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="organizations" className="space-y-6">
              <OrganizationManager />
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

      <footer className="mt-8 w-full py-4 text-center text-sm text-gray-500">
        <div className="space-y-3">
          <div>Powered by better-auth-paystack</div>
          <div className="flex items-center justify-center gap-4">
            <a
              href="https://github.com/alexasomba/better-auth-paystack"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 transition-colors hover:text-gray-700"
            >
              <GithubLogo weight="duotone" size={16} />
              <span>GitHub</span>
            </a>
            <a
              href="https://www.npmjs.com/package/better-auth-paystack"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 transition-colors hover:text-gray-700"
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
