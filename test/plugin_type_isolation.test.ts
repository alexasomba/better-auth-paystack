import type { BetterAuthPlugin } from "better-auth";
import { describe, expectTypeOf, it } from "vite-plus/test";

import type { paystackClient } from "../src/client.ts";
import type { paystack } from "../src/index.ts";

/**
 * Regression tests for this plugin's types leaking into — and collapsing — the *consuming*
 * app's Better Auth inference.
 *
 * Both defects below are invisible from inside this repo (they need a host app that composes
 * several plugins, and one of them only bites under `noUncheckedIndexedAccess`), so these
 * assertions target the two root causes directly instead of their downstream symptoms.
 */

/** Only `true` when `T` carries a string index signature. */
type HasStringIndexSignature<T> = string extends keyof T ? true : false;

describe("plugin type isolation", () => {
  it("keeps the server plugin's endpoints free of a string index signature", () => {
    type Endpoints = ReturnType<typeof paystack>["endpoints"];

    // Better Auth merges every plugin's endpoints into `auth.api`. An index signature here
    // spreads across that whole merged surface, which under `noUncheckedIndexedAccess` makes
    // *every* `auth.api.*` call (getSession, createApiKey, ...) possibly `undefined`.
    expectTypeOf<HasStringIndexSignature<Endpoints>>().toEqualTypeOf<false>();
  });

  it("still satisfies BetterAuthPlugin's endpoints contract", () => {
    // The index signature was load-bearing: `endpoints` must remain assignable to
    // `{ [key: string]: Endpoint }`. A `type` alias gets that via TypeScript's implicit index
    // signature; an `interface` would not, which is why this pair of assertions is kept together.
    type Endpoints = ReturnType<typeof paystack>["endpoints"];

    expectTypeOf<Endpoints>().toExtend<NonNullable<BetterAuthPlugin["endpoints"]>>();
  });

  it("keeps the literal plugin id on the client plugin", () => {
    // Better Auth keys its plugin merge on the *literal* id. Widening this to
    // `LiteralString` (e.g. by annotating the return as plain `BetterAuthClientPlugin`)
    // collapses the consuming app's entire auth client to `never`.
    expectTypeOf<ReturnType<typeof paystackClient>["id"]>().toEqualTypeOf<"paystack">();
  });

  it("exposes a concrete $InferServerPlugin on the client plugin", () => {
    // This is what the client uses to resolve server endpoints; it must stay concrete
    // rather than widening to the `InferableServerPlugin` default.
    type Inferred = ReturnType<typeof paystackClient>["$InferServerPlugin"];

    expectTypeOf<Inferred["id"]>().toEqualTypeOf<"paystack">();
    expectTypeOf<HasStringIndexSignature<Inferred["endpoints"]>>().toEqualTypeOf<false>();
  });
});
