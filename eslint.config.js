import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import importPlugin from "eslint-plugin-import";
import js from "@eslint/js";

export default [
  {
    ignores: [
      "**/*.js",
      "**/*.cjs",
      "**/*.mjs",
      "node_modules",
      "dist",
      "coverage",
      "build",
      ".next",
      ".turbo",
      ".cache",
      "docs",
      "examples",
      "scripts",
      "test",
      "vitest.config.ts",
      "vitest.config.js",
      "vitest.workspace.ts",
      "test",
      "**/paystack-test.ts",
      "**/paystack-test.js",
      "**/*.d.ts",
      "**/*.d.ts.map",
      "**/*.map",
      "**/*.tsbuildinfo",
      "**/test_output*.txt",
      "**/typecheck_output*.txt",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json", // Required for type-aware linting
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooksPlugin,
      import: importPlugin,
    },
    rules: {
      // --- TypeScript & Type Safety (Crucial for Better Auth) ---
      "@typescript-eslint/no-floating-promises": "error", // Ensure auth actions are awaited
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-explicit-any": "warn", // Avoid 'any' in auth schemas
      "@typescript-eslint/strict-boolean-expressions": "error", // Safe null checks

      // --- React Hooks (For Better Auth Client) ---
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // --- Best Practices ---
      "no-console": "warn",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "import/order": ["error", { "newlines-between": "always" }],
    },
  },
];
