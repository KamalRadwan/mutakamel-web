import { describe, expect, it } from "vitest";
import {
  parsePublicBranding,
  PUBLIC_BRANDING_ICON_PATH,
  PUBLIC_BRANDING_LOGO_PATH,
} from "./public-branding";

describe.each([
  ["logoUrl", PUBLIC_BRANDING_LOGO_PATH],
  ["iconUrl", PUBLIC_BRANDING_ICON_PATH],
] as const)("public branding %s", (field, path) => {
  it("preserves the exact route and optional 16-character key hash", () => {
    for (const value of [path, `${path}?v=0123456789abcdef`]) {
      expect(parsePublicBranding({ [field]: value })[field]).toBe(value);
    }
    expect(parsePublicBranding({ [field]: null })[field]).toBeNull();
    expect(parsePublicBranding({})[field]).toBeNull();
  });

  it.each([
    "?v=",
    "?v=0123456789abcde",
    "?v=0123456789abcdef0",
    "?v=0123456789abcdeg",
    "?v=0123456789ABCDEF",
    "?v=0123456789abcdef&extra=1",
    "?v=0123456789abcdef&v=0123456789abcdef",
    "?v=0123456789abcdef#fragment",
    "?v=0123456789abcdef\n",
    "?v=%30123456789abcdef",
    "?extra=1&v=0123456789abcdef",
    "/?v=0123456789abcdef",
  ])("rejects an invalid version suffix %s", suffix => {
    expect(() => parsePublicBranding({ [field]: `${path}${suffix}` })).toThrow();
  });

  it.each([
    "https://evil.example/logo.png?v=0123456789abcdef",
    "//evil.example/logo.png?v=0123456789abcdef",
    "/api/tenant/core/v1/branding/public/other?v=0123456789abcdef",
    123,
    {},
    ["0123456789abcdef"],
  ])("rejects a noncanonical asset value %j", value => {
    expect(() => parsePublicBranding({ [field]: value })).toThrow();
  });
});
