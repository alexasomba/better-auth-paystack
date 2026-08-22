# Agents Context: @alexasomba/better-auth-paystack

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown,
Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend
tooling in a single global CLI called `vp`. Vite+ is distinct from Vite. Built-in app commands use
`vp dev`, `vp build`, and `vp preview`; target the TanStack app explicitly with
`vp -C examples/tanstack <command>`. The library uses `vp pack`. Run `vp help` to print a list of
commands and `vp <command> --help` for information about a specific command.

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

> **Note:** For deep technical details, refer to [README.md](README.md).

## Project Identity

A TypeScript library providing **Paystack** integration for **Better Auth**. Supports native/local subscriptions, one-time payments, organization billing, and secure webhooks with automated limit enforcement.

## Research Sources

For best practices and reference implementations, research:

- [Better Auth Stripe integration](https://github.com/better-auth/better-auth/tree/main/packages/stripe)
- [Better Auth plugin documentation](https://github.com/better-auth/better-auth/tree/main/docs/content/docs/plugins)

## Repository Validation

Run the following checks for changes that affect the package or its examples:

- `vp check`
- `vp test`
- `vp pack`
- `vp run lint:package`
- `vp run lint:types`
- `vp -C examples/tanstack test run`
- `vp -C examples/tanstack build`
- `vp -C examples/tanstack run wrangler:dry-run`

## 🚨 Session Close Protocol

Work is **NOT** complete until `git push` succeeds.

1. **Quality Gates**: Run `vp check` and `vp test`.
2. **Git Workflow**: `git add .`, `git commit -m "..."`, `git pull --rebase`, and **`git push`**.
3. **Verify**: Ensure local branch is up to date with origin.
