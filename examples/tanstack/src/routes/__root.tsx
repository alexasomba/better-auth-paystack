import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Link, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { createSeoHead } from "@/lib/seo";

import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";

import appCss from "../styles.css?url";

interface MyRouterContext {
  queryClient: QueryClient;
  session?: any;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => {
    const seo = createSeoHead({ includeCanonical: false });

    return {
      ...seo,
      meta: [
        {
          charSet: "utf-8",
        },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        },
        ...seo.meta,
      ],
      links: [
        ...seo.links,
        {
          rel: "stylesheet",
          href: appCss,
        },
      ],
    };
  },

  shellComponent: RootDocument,
  errorComponent: ({ error }: any) => {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <h1 className="mb-4 text-4xl font-bold">Something went wrong</h1>
        <pre className="mb-8 max-w-full overflow-auto rounded bg-muted p-4 text-red-500">
          {error.message}
        </pre>
        <Link to="/" className="text-primary hover:underline">
          Go back home
        </Link>
      </div>
    );
  },
  notFoundComponent: () => {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <h1 className="mb-4 text-4xl font-bold">404 - Not Found</h1>
        <p className="mb-8 text-muted-foreground">The page you are looking for does not exist.</p>
        <Link to="/" className="text-primary hover:underline">
          Go back home
        </Link>
      </div>
    );
  },
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
