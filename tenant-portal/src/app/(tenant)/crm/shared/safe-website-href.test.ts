import { describe, expect, it } from "vitest";
import { safeWebsiteHref } from "./safe-website-href";

describe("safeWebsiteHref", () => {
  it.each([
    null, undefined, "", "   ", "javascript:alert(1)", "JAVASCRIPT:alert(1)",
    "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)",
    "httpx:foo", "ftp://example.com", "https://", "not a website",
    "java\nscript:alert(1)",
  ])("rejects %j", (value) => {
    expect(safeWebsiteHref(value)).toBeNull();
  });

  it.each([
    [" example.com ", "https://example.com/"],
    ["https://EXAMPLE.com", "https://EXAMPLE.com"],
    ["http://example.com", "http://example.com"],
    [" https://alnoor.sa ", "https://alnoor.sa"],
    ["HTTPS://example.com/path?q=1#top", "HTTPS://example.com/path?q=1#top"],
  ])("defaults bare hosts to HTTPS and preserves trimmed HTTP(S) input: %s", (value, href) => {
    expect(safeWebsiteHref(value)).toBe(href);
  });
});
