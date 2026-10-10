/** Accept only absolute HTTP(S) URLs or root-relative paths on the Better Auth origin. */
function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (
      codePoint !== undefined &&
      (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f))
    ) {
      return true;
    }
  }
  return false;
}

export function isTrustedCallbackURL(callbackURL: string, baseURL: string): boolean {
  if (
    callbackURL.startsWith("//") ||
    callbackURL.includes("\\") ||
    hasControlCharacters(callbackURL)
  ) {
    return false;
  }
  try {
    const base = new URL(baseURL);
    const isAbsoluteHttpURL = /^https?:\/\//i.test(callbackURL);
    if (!isAbsoluteHttpURL && !callbackURL.startsWith("/")) return false;
    const callback = new URL(callbackURL, base);
    return (
      (callback.protocol === "http:" || callback.protocol === "https:") &&
      callback.origin === base.origin &&
      callback.username === "" &&
      callback.password === ""
    );
  } catch {
    return false;
  }
}
