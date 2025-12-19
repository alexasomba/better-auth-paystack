#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const BEADS_VERSION = "0.30.6";

const args = process.argv.slice(2);

// pnpm passes an extra "--" through to scripts (e.g. `pnpm bd -- --help`)
const normalizedArgs = args[0] === "--" ? args.slice(1) : args;

const result = spawnSync(
    "npx",
    ["--yes", "--package", `@beads/bd@${BEADS_VERSION}`, "bd", ...normalizedArgs],
    {
        stdio: "inherit",
    },
);

process.exit(result.status ?? 1);
