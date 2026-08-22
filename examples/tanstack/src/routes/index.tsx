import {
  Fingerprint,
  GithubLogo,
  Package,
  RocketLaunch,
  ShieldCheck,
  Sparkle,
} from "@phosphor-icons/react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { linkHeader } from "@/lib/agent-discovery";
import { authClient } from "@/lib/auth-client";
import { createHomeStructuredData, createSeoHead, defaultSeoDescription } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () =>
    createSeoHead({
      title: "TanStack Start Billing Demo",
      description: defaultSeoDescription,
      path: "/",
      structuredData: createHomeStructuredData(),
    }),
  headers: () => ({
    Link: linkHeader,
  }),
  component: Home,
});

function Home() {
  const router = useRouter();
  const { data: sessionData, error: sessionError } = authClient.useSession();
  const [isAuthActionInProgress, setIsAuthActionInProgress] = useState(false);

  useEffect(() => {
    if (sessionData?.user !== null && sessionData?.user !== undefined) {
      void router.navigate({ to: "/dashboard" });
    }
  }, [sessionData, router]);

  useEffect(() => {
    const modelContext = navigator.modelContext;

    if (modelContext === undefined) {
      return;
    }

    const controller = new AbortController();
    const tools = [
      {
        name: "open_home",
        description: "Navigate to the Better Auth Paystack demo home page.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        execute: () => {
          globalThis.location.assign("/");
          return { ok: true };
        },
      },
      {
        name: "open_dashboard",
        description: "Navigate to the authenticated billing dashboard.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        execute: () => {
          globalThis.location.assign("/dashboard");
          return { ok: true };
        },
      },
      {
        name: "get_agent_resources",
        description: "Return the site discovery resources for API and agent automation.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        execute: () => ({
          apiCatalog: "/.well-known/api-catalog",
          openApi: "/openapi.json",
          health: "/api/health",
          sitemap: "/sitemap.xml",
        }),
      },
    ];

    if (modelContext.registerTool !== undefined) {
      for (const tool of tools) {
        modelContext.registerTool(tool, { signal: controller.signal });
      }
    } else if (modelContext.provideContext !== undefined) {
      modelContext.provideContext({ tools }, { signal: controller.signal });
    }

    return () => {
      controller.abort();
    };
  }, []);

  const handleAnonymousLogin = async () => {
    setIsAuthActionInProgress(true);
    try {
      const result = await authClient.signIn.anonymous();
      if (result.error !== null && result.error !== undefined) {
        setIsAuthActionInProgress(false);
        alert(`Anonymous login failed: ${result.error.message}`);
      } else {
        void router.navigate({ to: "/dashboard" });
      }
    } catch (e: unknown) {
      setIsAuthActionInProgress(false);
      const message = e instanceof Error ? e.message : "Unknown error";
      alert(`An unexpected error occurred during login: ${message}`);
    }
  };

  if (sessionError !== null && sessionError !== undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Error loading session: {sessionError.message}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-background to-muted/20 p-6 font-sans">
      <div className="w-full max-w-md animate-in space-y-8 duration-700 fade-in slide-in-from-bottom-4">
        <div className="space-y-2 text-center">
          <div className="mb-2 inline-flex items-center justify-center rounded-2xl bg-primary/5 p-2">
            <span className="text-primary">
              <RocketLaunch weight="duotone" size={32} />
            </span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">Better Auth + Paystack SDK = ♥</h1>
          <p className="text-muted-foreground">The ultimate Paystack plugin for Better Auth.</p>
        </div>

        <Card className="border-border/50 bg-background/80 shadow-xl shadow-primary/5 backdrop-blur-sm">
          <CardHeader className="pb-2 text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-xl">
              <span className="text-primary">
                <Fingerprint weight="duotone" size={20} />
              </span>
              Anonymous Login
            </CardTitle>
            <CardDescription>
              Experience seamless payments with one click, powered by better-auth-paystack.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 py-4">
            <div className="grid grid-cols-1 gap-3 py-2">
              <div className="flex items-start gap-3 rounded-lg border border-transparent bg-muted/30 p-3 transition-colors hover:border-primary/10">
                <span className="mt-0.5 shrink-0 text-primary">
                  <ShieldCheck weight="duotone" size={20} />
                </span>
                <div className="space-y-1">
                  <p className="text-xs font-medium">Secure Checkout</p>
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    Enterprise-grade security for every transaction.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={() => {
                void handleAnonymousLogin();
              }}
              className="group h-11 w-full gap-2 text-sm font-semibold shadow-lg shadow-primary/20"
              disabled={isAuthActionInProgress}
            >
              {isAuthActionInProgress ? (
                "Logging In..."
              ) : (
                <>
                  <span className="group-hover:animate-pulse">
                    <Sparkle weight="duotone" size={16} />
                  </span>
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

      <footer className="absolute bottom-0 w-full py-4 text-center text-sm text-gray-500">
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
