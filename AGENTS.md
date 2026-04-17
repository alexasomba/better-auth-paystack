# Gemini Context: @alexasomba/better-auth-paystack

> **Note:** For deep technical details, refer to [README.md](file:///Users/alexasomba/Documents/GitHub/alexasomba/better-auth-paystack/README.md).

## Project Identity

A TypeScript library providing **Paystack** integration for **Better Auth**. Supports native/local subscriptions, one-time payments, organization billing, and secure webhooks with automated limit enforcement.

## Tech Stack

- **Core**: TypeScript, pnpm, tsdown, vitest, Oxlint
- **Dependencies**: `better-auth`, `@alexasomba/paystack-node`, `better-call`, `zod`

## Project Map

- `src/`: Core logic
  - `index.ts`: Server plugin entry
  - `client.ts`: Client plugin entry
  - `routes.ts`: API implementations
  - `schema.ts`: DB extensions
  - `middleware.ts`, `limits.ts`, `utils.ts`: Core helpers
- `examples/`: Next.js and TanStack Start reference implementations
- `test/`: Unit and integration test suite

## Research Sources

For best practices and reference implementations, research:

- `better-auth better-auth main packages-stripe/`: Stripe integration reference.
- `docs/better-auth/concepts`: Core Better Auth concepts and patterns.

## Key Commands (vp)

| Command              | Action                                                |
| :------------------- | :---------------------------------------------------- |
| `vp pack`            | Build the library                                     |
| `vp test`            | Run tests (`RUN_INTEGRATION_TESTS=1` for integration) |
| `vp check`           | All-in-one format, lint, and type check               |
| `vp lint` / `vp fmt` | Lint and format code                                  |

## Rules of Engagement

1. **Surgical Updates**: Maintain existing architectural patterns and strict type safety.
2. **Planning Mode**: Enter plan mode for any non-trivial task (3+ steps). Write detailed specs.
3. **Subagent Strategy**: Use subagents for research, exploration, and parallel analysis.
4. **Autonomous Bug Fixing**: Fix bugs and failing CI tests without hand-holding.
5. **Verification**: Never mark a task complete without proof (tests, logs, diffs).
6. **Elegance**: Avoid hacky fixes. Seek the elegant solution for non-trivial changes.
7. **Self-Improvement**: Update `tasks/lessons.md` after any user correction.

## 🚨 Session Close Protocol

Work is **NOT** complete until `git push` succeeds.

1. **Quality Gates**: Run `vp check` and `vp test`.
2. **Git Workflow**: `git add .`, `git commit -m "..."`, `git pull --rebase`, and **`git push`**.
3. **Verify**: Ensure local branch is up to date with origin.

## Vite+ (vp) Cheat Sheet

This project uses `vite-plus`.

- **Imports**: `import { ... } from 'vite-plus'` or `vite-plus/test`.
- **Scripts**: Use `vp run <script>` for custom package.json scripts.
- **Tools**: Use `vp dev`, `vp build`, `vp test`. Do not use `vitest` or `oxlint` directly.
- **Dependencies**: Use `vp add`, `vp rm`, `vp update`. Auto-wraps pnpm/npm/yarn.

<!-- intent-skills:start -->

# Skill mappings - when working in these areas, load the linked skill file into context.

skills:

- task: "Working on TanStack Start server functions, middleware, or deployment in the tanstack example"
  load: "examples/tanstack/node_modules/@tanstack/react-start/skills/react-start/SKILL.md"
- task: "Managing TanStack Router routes, search params, and type-safety"
  # To load this skill, run: vp dlx @tanstack/intent@latest list | grep react-router
- task: "Building type-safe forms with TanStack Form"
  # To load this skill, run: vp dlx @tanstack/intent@latest list | grep react-form
- task: "Data fetching and caching with TanStack Query" # To load this skill, run: vp dlx @tanstack/intent@latest list | grep react-query
<!-- intent-skills:end -->
