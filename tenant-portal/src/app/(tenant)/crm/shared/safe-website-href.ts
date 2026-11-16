/** Website links accept only HTTP(S); a bare host defaults to HTTPS. */
export function safeWebsiteHref(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;

  try {
    const hasScheme = /^[a-z][a-z\d+.-]*:/iu.test(trimmed);
    const url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // Preserve stored HTTP(S) links; only bare hosts need normalization.
    return hasScheme ? trimmed : url.href;
  } catch {
    return null;
  }
}
