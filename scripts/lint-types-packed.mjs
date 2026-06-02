import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const packDir = mkdtempSync(join(tmpdir(), "better-auth-paystack-attw-"));

try {
  execFileSync("pnpm", ["pack", "--pack-destination", packDir], {
    cwd: process.cwd(),
    stdio: "pipe",
  });

  const tarball = readdirSync(packDir).find((file) => file.endsWith(".tgz"));
  if (tarball === undefined) {
    throw new Error("pnpm pack did not produce a tarball.");
  }

  execFileSync("pnpm", ["exec", "attw", "--profile", "esm-only", join(packDir, tarball)], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
} finally {
  rmSync(packDir, { recursive: true, force: true });
}
