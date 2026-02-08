import type { NextConfig } from "next";

import path from "node:path";

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import * as OpenNextCloudflare from "@opennextjs/cloudflare";

const initOpenNextCloudflareForDev = (
	OpenNextCloudflare as unknown as {
		initOpenNextCloudflareForDev?: (options?: unknown) => void;
	}
).initOpenNextCloudflareForDev;

initOpenNextCloudflareForDev?.();

const nextConfig: NextConfig = {
	// In a pnpm workspace, dependencies may live above this app folder.
	// This also silences Next.js' "inferred workspace root" warning.
	outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
    //output: "standalone",
};

export default nextConfig;

