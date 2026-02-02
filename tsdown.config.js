import { defineConfig } from "tsdown";
export default defineConfig({
    tsconfig: "./tsconfig.build.json",
    dts: { build: true, incremental: true },
    format: ["esm"],
    entry: ["./src/index.ts", "./src/client.ts"],
    external: [
        /^better-auth($|\/)/,
        /^better-call($|\/)/,
        /^@better-fetch\/fetch($|\/)/,
        /^@better-auth\/core($|\/)/,
        /^@alexasomba\/paystack-node($|\/)/,
        "kysely",
        "@standard-schema/spec",
        "zod",
        "defu",
    ],
    inlineOnly: false,
    treeshake: true,
});
