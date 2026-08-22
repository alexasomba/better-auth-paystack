import path from "node:path";

/**
 * Enable calling `getCloudflareContext()` in `next dev`.
 * See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
 */
import * as OpenNextCloudflare from "@opennextjs/cloudflare";

OpenNextCloudflare.initOpenNextCloudflareForDev?.();

/** @type {import("next").NextConfig} */
const nextConfig = {
  // In a pnpm workspace, dependencies may live above this app folder.
  // This also silences Next.js' inferred workspace root warning.
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  // The example runs `vp run typecheck` separately; Next's checker over the
  // generated route types can exceed the recursion limit with Better Auth's
  // deeply inferred client types.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
