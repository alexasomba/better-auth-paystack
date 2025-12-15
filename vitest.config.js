import { defineProject } from "vitest/config";
export default defineProject({
    test: {
        clearMocks: true,
        globals: true,
        exclude: ["**/*.d.ts", "**/*.test.js", "**/dist/**", "**/node_modules/**"],
    },
});
