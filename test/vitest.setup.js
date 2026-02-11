"use strict";
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
// Polyfill for Zod: ensure schema.parseAsync exists and delegates to safeParseAsync.
// Some zod runtime shapes (CJS/ESM) don't expose the base class constructor in exports,
// so we detect the prototype by creating a dummy schema instance.
void (async () => {
    try {
        const mod = await import("zod");
        // Support both default and named exports
        const z = (mod && mod.default) ? mod.default : mod;
        // Try to find the base prototype from exports, otherwise derive it from an instance.
        let proto = z?.ZodSchema?.prototype ??
            z?.ZodType?.prototype ??
            z?.default?.ZodSchema?.prototype ??
            z?.default?.ZodType?.prototype;
        if (!proto && typeof z?.object === "function") {
            const schema = z.object({});
            proto = Object.getPrototypeOf(schema);
            // Walk up to the first prototype that has safeParseAsync
            while (proto && typeof proto.safeParseAsync !== "function") {
                proto = Object.getPrototypeOf(proto);
            }
        }
        if (proto && typeof proto.parseAsync !== "function" && typeof proto.safeParseAsync === "function") {
            proto.parseAsync = function (...args) {
                return (this).safeParseAsync(...args).then((res) => {
                    if (res?.success)
                        return res.data;
                    throw res?.error ?? new Error("Zod parseAsync failed");
                });
            };
            // eslint-disable-next-line no-console
            console.log("vitest.setup: injected Zod.parseAsync polyfill");
        }
    }
    catch {
        // no-op: do not mask real test failures
    }
})();
