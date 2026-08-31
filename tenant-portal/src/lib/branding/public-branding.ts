import { readCoreData } from "@/lib/api/envelope";

// `GET /api/tenant/core/v1/branding/public` — `@Public()`, resolved from the
// request host, so it answers before anyone has signed in. That is what makes
// it usable for the login screen as well as the shell.
//
// The field list is `PublicBrandingView` in
// ../backend/mutakamel-apps/core-app/src/tenant/branding/branding.service.ts.
// `logoUrl` and `iconUrl` are same-origin **paths** to the two binary routes,
// not storage keys — the bytes stream through Core so no Storage credential
// ever reaches the browser.

const PUBLIC_BRANDING_PATH = "/api/tenant/core/v1/branding/public" as const;
export const PUBLIC_BRANDING_LOGO_PATH = "/api/tenant/core/v1/branding/public/logo" as const;
export const PUBLIC_BRANDING_ICON_PATH = "/api/tenant/core/v1/branding/public/icon" as const;

/** `varchar(120)` on every text column of `BrandingEntity`. */
export const BRANDING_TEXT_MAX_LENGTH = 120;
/** `login_html` is `text`, capped by `@MaxLength(20000)` on the DTO. */
const BRANDING_LOGIN_HTML_MAX_LENGTH = 20_000;

const PUBLIC_BRANDING_RESPONSE_LIMIT_BYTES = 64_000;

export interface PublicBranding {
  appName: string | null;
  tabTitle: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  fontFamily: string | null;
  loginHtml: string | null;
  logoUrl: string | null;
  iconUrl: string | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nullableText(source: Record<string, unknown>, key: string, maxLength: number): string | null {
  const value = source[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new Error("Invalid Core public branding response.");
  }
  return value;
}

/**
 * The two asset fields are compared against the exact paths Core emits rather
 * than accepted as free-form strings. They are server-generated constants, and
 * treating them as opaque would let a compromised upstream point an `<img>`
 * anywhere.
 */
function assetPath(
  source: Record<string, unknown>,
  key: string,
  expected: string,
): string | null {
  const value = source[key];
  if (value === undefined || value === null) return null;
  if (value !== expected) throw new Error("Invalid Core public branding response.");
  return expected;
}

export function parsePublicBranding(payload: unknown): PublicBranding {
  const branding = record(payload);
  if (!branding) throw new Error("Invalid Core public branding response.");
  return {
    appName: nullableText(branding, "appName", BRANDING_TEXT_MAX_LENGTH),
    tabTitle: nullableText(branding, "tabTitle", BRANDING_TEXT_MAX_LENGTH),
    primaryColor: nullableText(branding, "primaryColor", 9),
    secondaryColor: nullableText(branding, "secondaryColor", 9),
    fontFamily: nullableText(branding, "fontFamily", BRANDING_TEXT_MAX_LENGTH),
    loginHtml: nullableText(branding, "loginHtml", BRANDING_LOGIN_HTML_MAX_LENGTH),
    logoUrl: assetPath(branding, "logoUrl", PUBLIC_BRANDING_LOGO_PATH),
    iconUrl: assetPath(branding, "iconUrl", PUBLIC_BRANDING_ICON_PATH),
  };
}

/**
 * Reads public branding without ever attempting a session refresh.
 *
 * The route is public and the login screen calls it while unauthenticated; a
 * 401 here would otherwise drive the refresh machinery for a request that never
 * needed a session.
 */
export async function fetchPublicBranding(signal?: AbortSignal): Promise<PublicBranding> {
  const payload = await readCoreData(PUBLIC_BRANDING_PATH, {
    signal,
    skipAuthRefresh: true,
    cache: "no-store",
    maxResponseBytes: PUBLIC_BRANDING_RESPONSE_LIMIT_BYTES,
  });
  return parsePublicBranding(payload);
}
