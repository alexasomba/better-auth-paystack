# Gemini Context: @alexasomba/better-auth-paystack

> **Note:** For up-to-date documentation, skills, and best practices, perform a Google search and then refer to `context7` before proceeding.

## Project Overview

This is a TypeScript library that provides a comprehensive **Paystack** integration plugin for **Better Auth**. It enables production-ready billing systems with support for subscriptions (native & local), one-time payments, trials, organization billing, and secure webhooks.

## Key Features

- **Billing Patterns**: Supports Paystack-native plans, local-managed subscriptions, and one-time payments (fixed products or ad-hoc amounts).
- **Trial Management**: Configurable trial periods with built-in abuse prevention logic.
- **Organization Billing**: Associate subscriptions with organizations, auto-create organization customers, and authorize access via roles.
- **Enforced Limits**: Automatic enforcement of seat limits (members) and resource limits (e.g., teams).
- **Checkout Flows**: Support for standard redirects and optional inline popup modals via `@alexasomba/paystack-browser`.
- **Webhooks**: Secure signature verification (`HMAC-SHA512`) with pre-configured event handlers.
- **Transaction History**: Synchronization and local storage of transaction records.
- **Automated Inventory Sync**: Real-time product quantity synchronization from Paystack during checkout.

## Tech Stack

- **Language**: TypeScript
- **Package Manager**: pnpm
- **Build Tool**: tsdown
- **Testing**: vitest
- **Core Dependencies**: `better-auth`, `@alexasomba/paystack-node`, `better-call`, `zod`, `defu`
- **Optional Client SDK**: `@alexasomba/paystack-browser` (for inline checkout)

## Project Structure

- `src/`
  - `index.ts`: **Server-side Plugin Entry**. Defines the `paystack` plugin and core logic.
  - `client.ts`: **Client-side Plugin Entry**. Defines the `paystackClient` for typed frontend API access.
  - `routes.ts`: Implementation of the plugin's API routes (transactions, subscriptions, webhooks).
  - `schema.ts`: Database schema extensions for `user`, `organization`, `subscription`, `paystackTransaction`, and `paystackProduct`.
  - `middleware.ts`: Authorization middleware for managing billing references (User vs Org).
  - `limits.ts`: Logic for enforcing seat and resource limits based on active plans.
  - `paystack-sdk.ts`: SDK wrapper and initialization utilities.
  - `types.ts`: Centralized TypeScript interfaces and types.
  - `utils.ts`: Internal helper functions (period calculation, amount validation, plan lookups).
- `examples/`: Reference implementations.
  - `nextjs/`: Integration with Next.js.
  - `tanstack/`: Integration with TanStack Start.
- `test/`: Unit and integration tests.

## Development Workflow

### Key Commands

| Command                 | Description                                      |
| :---------------------- | :----------------------------------------------- |
| `pnpm build`            | Build the library using `tsdown`.                |
| `pnpm dev`              | Run in watch mode for development.               |
| `pnpm test`             | Run unit tests.                                  |
| `pnpm test:integration` | Run integration tests (requires environment).    |
| `pnpm typecheck`        | Run TypeScript type checking.                    |
| `pnpm lint`             | Lint the codebase.                               |
| `pnpm lint:package`     | Validate package structure using `publint`.      |
| `pnpm coverage`         | Generate test coverage reports.                  |

### Conventions

- **Surgical Updates**: Always maintain existing architectural patterns and type safety.
- **Testing**: Add or update tests for every logic change. Reproduction scripts are mandatory for bugs.
- **Exports**: The package uses conditional exports for `.` and `./client`.
- **Instruction Alignment**: All AI interactions MUST follow the guidelines in the sections below.

## Workflow Orchestration

### 1. Plan Node Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One tack per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests - then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

## Usage Context

The plugin is added to `betterAuth()` on the server and `createAuthClient()` on the client. It handles database operations via the Better Auth adapter and communicates with Paystack via the Node SDK.

Refer to `README.md` for detailed configuration options and schema references.

## 🚨 Session Close Protocol (Landing the Plane)

Before completing any task or ending a session, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

### MANDATORY WORKFLOW:

1. **Run Quality Gates**: Verify with `lint`, `typecheck`, or `build` as needed (e.g., `pnpm run lint`, `pnpm run test`).
2. **Git Workflow & PUSH TO REMOTE**:
   ```bash
   git status
   git add .
   git commit -m "feat/fix: describe changes"
   git pull --rebase
   git push
   ```
3. **Clean up**: Clear stashes, prune remote branches.
4. **Verify**: Ensure `git status` shows the local branch is "up to date with origin" and all changes are committed AND pushed.
5. **Hand off**: Provide a brief context summary for the next session.

### CRITICAL RULES:

- **Work is NOT complete until `git push` succeeds.** NEVER stop before pushing—that leaves work stranded locally.
- **Proactive Push**: NEVER say "ready to push when you are"—YOU must push autonomously.
- **Fail-Safe**: If push fails, resolve conflicts or errors and retry until it succeeds.

