import { defineProject } from "vitest/config";
export default defineProject({
    test: {
        clearMocks: true,
        globals: true,
        // Run the vitest setup file to polyfill Zod when necessary (fixes CI CJS/ESM cases)
        setupFiles: ["./test/vitest.setup.ts"],
        exclude: [
            "**/*.d.ts",
            "**/*.test.js",
            "**/dist/**",
            "**/node_modules/**",
            "**/examples/**", // Examples have their own test configs
            ...(process.env.RUN_INTEGRATION_TESTS ? [] : ["**/*.integration.test.ts"]),
        ],
    },
});
