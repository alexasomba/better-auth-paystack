import { URL, fileURLToPath } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig(({ mode }) => {
  const isTest = mode === "test";

  return {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
      tsconfigPaths: true,
    },
    ssr: {
      noExternal: ["better-auth-paystack"],
    },
    plugins: lazyPlugins(() =>
      isTest
        ? [viteReact()]
        : [
            devtools(),
            cloudflare({ viteEnvironment: { name: "ssr" } }),
            tailwindcss(),
            tanstackStart(),
            viteReact(),
          ],
    ),
    fmt: {
      ignorePatterns: ["src/routeTree.gen.ts"],
      printWidth: 100,
      semi: true,
      singleQuote: false,
      trailingComma: "all",
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/__tests__/setup.ts"],
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      coverage: {
        reporter: ["text", "html"],
        exclude: ["node_modules/", "src/__tests__/setup.ts", "src/routeTree.gen.ts"],
      },
    },
  };
});
