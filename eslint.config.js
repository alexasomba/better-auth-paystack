import tseslint from "typescript-eslint";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import importXPlugin from "eslint-plugin-import-x";
import promisePlugin from "eslint-plugin-promise";
import unicornPlugin from "eslint-plugin-unicorn";
import js from "@eslint/js";
import { fixupPluginRules } from "@eslint/compat";

const cleanedPluginsCache = new Map();

/** @param {any} plugin */
function cleanPlugin(plugin) {
  if (!plugin || typeof plugin !== "object") return plugin;
  if (cleanedPluginsCache.has(plugin)) return cleanedPluginsCache.get(plugin);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { configs, flatConfigs, ...rest } = plugin;
  cleanedPluginsCache.set(plugin, rest);
  return rest;
}

/** @param {any[]} configs */
function cleanConfigs(configs) {
  return configs.map(c => {
    if (c?.plugins) {
      const cleanedPlugins = {};
      for (const [name, plugin] of Object.entries(c.plugins)) {
        cleanedPlugins[name] = cleanPlugin(plugin);
      }
      return { ...c, plugins: cleanedPlugins };
    }
    return c;
  });
}

export default cleanConfigs([
  {
    ignores: [
      "**/*.js",
      "**/*.cjs",
      "**/*.mjs",
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/build/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/.cache/**",
      "docs/**",
      "scripts/**",
      "examples/**",
      "vitest.config.ts",
      "vitest.config.js",
      "vitest.workspace.ts",
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
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": reactHooksPlugin,
      import: importXPlugin,
      promise: fixupPluginRules(promisePlugin),
      unicorn: unicornPlugin,
    },
    rules: {
      // --- Biome-style Adjustments ---
      "indent": ["error", "tab"], // Biome indentStyle: tab
      "prefer-const": "error", // Biome useConst: error
      "no-debugger": "error", // Biome noDebugger: error
      "no-restricted-syntax": [
        "error",
        {
          selector: "UnaryExpression[operator='delete']",
          message: "Performance: Using 'delete' on object properties is discouraged. Set properties to undefined instead.", // Biome performance.noDelete: error
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "Date",
          property: "getTime",
          message: "Complexity: Use 'Date.now()' instead of 'new Date().getTime()'.", // Biome complexity.useDateNow: error
        },
      ],
      
      // --- TypeScript & Type Safety ---
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: false,
        },
      ],
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/strict-boolean-expressions": "warn",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": "allow-with-description" } // Biome noTsIgnore: error (but allowing desc is safer)
      ],
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/consistent-generic-constructors": "off", // WORKAROUND: Crashes on ESLint 10 with isolatedDeclarations error

      // --- Import & Export Style ---
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports", // Biome useImportType: separatedType
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "zod",
              importNames: ["z"],
              message: "Use `import * as z from \"zod\"` instead of `import { z }`.",
            },
          ],
        },
      ],

      // --- Node.js Best Practices ---
      "unicorn/prefer-node-protocol": "error", // Biome useNodejsImportProtocol: error

      // --- React Hooks ---
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // --- Unused Variables ---
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // --- Best Practices ---
      "no-console": "warn",
      "import/order": ["error", { "newlines-between": "always" }],
      "promise/always-return": "warn",
      "promise/catch-or-return": "warn",
    },
  },
  {
    // Packages source restriction for Buffer
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-restricted-types": [
        "error",
        {
          types: {
            Buffer: {
              message: "Buffer is deprecated. Use `Uint8Array` instead.",
              fixWith: "Uint8Array",
            },
          },
        },
      ],
      "no-restricted-globals": [
        "error",
        {
          name: "Buffer",
          message: "Buffer is deprecated. Use `Uint8Array` instead.",
        },
      ],
    },
  },
  {
    // Test & Example overrides
    files: [
      "**/*.test.*",
      "**/*.spec.*",
      "**/test/**",
      "**/__tests__/**",
      "src/paystack.test.ts",
      "examples/**",
    ],
    rules: {
      "no-restricted-globals": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-restricted-types": "off",
    },
  },
]);
