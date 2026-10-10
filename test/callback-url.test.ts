import { describe, expect, it } from "vite-plus/test";

import { isTrustedCallbackURL } from "../src/route-modules/callback-url.ts";

describe("trusted callback URLs", () => {
  const baseURL = "https://app.example.com/auth/callback";

  it("allows same-origin absolute URLs and root-relative paths", () => {
    expect(isTrustedCallbackURL("https://app.example.com/paid", baseURL)).toBe(true);
    expect(isTrustedCallbackURL("/paid", baseURL)).toBe(true);
  });

  it.each(["//evil.example/path", "/\\\\evil.example/path", "javascript:alert(1)", "paid"])(
    "rejects unsafe or ambiguous callback %s",
    (callbackURL) => {
      expect(isTrustedCallbackURL(callbackURL, baseURL)).toBe(false);
    },
  );

  it("rejects an absolute URL with a foreign origin or embedded credentials", () => {
    expect(isTrustedCallbackURL("https://evil.example/paid", baseURL)).toBe(false);
    expect(isTrustedCallbackURL("https://user@app.example.com/paid", baseURL)).toBe(false);
  });
});
