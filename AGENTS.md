# Agents Context: @alexasomba/better-auth-paystack

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown,
Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend
tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through
`vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for
information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation,
      run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include
      its output when asking for help.

<!--VITE PLUS END-->

## Package Source Inspection

No local vendoring. Use `opensrc path <package>` + `rg`/`sed`.

- Search: `rg "query" $(opensrc path <package>)`
- Read: `cat $(opensrc path <package>)/path/to/file`
- Other registries: `find $(opensrc path pypi:requests) -name "*.py"`

> **Note:** For deep technical details, refer to [README.md](file:///Users/alexasomba/Documents/GitHub/alexasomba/better-auth-paystack/README.md).

## Project Identity

A TypeScript library providing **Paystack** integration for **Better Auth**. Supports native/local subscriptions, one-time payments, organization billing, and secure webhooks with automated limit enforcement.

## Research Sources

For best practices and reference implementations, research:

- `better-auth better-auth main packages-stripe/`: Stripe integration reference.
- `docs/better-auth/concepts`: Core Better Auth concepts and patterns.

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
