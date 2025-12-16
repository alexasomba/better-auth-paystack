// Polyfill for Zod: ensure ZodSchema.prototype.parseAsync exists and delegates
// to safeParseAsync when available. This works for both CJS and ESM runtime
// shapes and avoids a breaking test error in CI where older zod versions were
// resolved that don't provide parseAsync.
(async () => {
  try {
    const mod = await import("zod");
    // Support both default and named exports
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const z: any = (mod && (mod as any).default) ? (mod as any).default : mod;

    // Try a few possible schema constructor names; some builds export ZodType
    const ZodSchema = z?.ZodSchema ?? z?.ZodType ?? z?.default?.ZodSchema ?? z?.default?.ZodType;
    const proto = ZodSchema?.prototype;

    if (proto && typeof proto.parseAsync !== "function" && typeof proto.safeParseAsync === "function") {
      // Provide a parseAsync wrapper that matches the Zod behavior: resolve to
      // parsed value or throw the validation error.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      proto.parseAsync = function (...args: any[]) {
        return (this as any).safeParseAsync(...args).then((res: any) => {
          if (res && res.success) return res.data;
          throw res?.error ?? new Error("Zod parseAsync failed");
        });
      };
      // Helpful debug line for CI logs
      // eslint-disable-next-line no-console
      console.log("vitest.setup: injected Zod.parseAsync polyfill");
    } else {
      // eslint-disable-next-line no-console
      console.log("vitest.setup: Zod.parseAsync already present or safeParseAsync missing");
    }
  } catch (e) {
    // Log to help diagnostics in CI (do not throw to avoid masking real test
    // failures unrelated to zod).
    // eslint-disable-next-line no-console
    console.log("vitest.setup: failed to apply zod polyfill", e?.message || e);
  }
})();
