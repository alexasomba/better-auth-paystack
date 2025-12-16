// Polyfill for Zod: ensure ZodSchema.prototype.parseAsync exists and delegates
// to safeParseAsync when available. This fixes CI where the runtime zod
// export shape may differ (CJS/ESM interop) and avoids a breaking test error.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const z = require("zod");

  // z.ZodSchema might be exported under different shapes depending on bundling
  const ZodSchema = z?.ZodSchema ?? z?.ZodType ?? z?.default?.ZodSchema ?? z?.default?.ZodType;
  const proto = ZodSchema?.prototype;

  if (proto && typeof proto.parseAsync !== "function" && typeof proto.safeParseAsync === "function") {
    // Provide a parseAsync wrapper that matches the Zod behavior: resolve to
    // parsed value or throw the validation error.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    proto.parseAsync = function (...args: any[]) {
      // `this` is the schema instance
      // safeParseAsync returns { success: boolean, data?, error? }
      // so we adapt it to parseAsync semantics
      return (this as any).safeParseAsync(...args).then((res: any) => {
        if (res && res.success) return res.data;
        throw res?.error ?? new Error("Zod parseAsync failed");
      });
    };
  }
} catch (e) {
  // no-op: if zod is not present or something else fails, let tests fail
  // with the original error (we don't want to mask other issues here).
}
