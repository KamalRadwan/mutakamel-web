import {
  isSupportedCorePath,
  isSupportedCrmPath,
  isSupportedTradePath,
} from "@/lib/navigation/tenant-routes";
import { DEFAULT_NAV_APP, type NavAppId } from "./nav-config";

/**
 * Which app owns a route — the FIRST input to the active app, ahead of any
 * stored preference.
 *
 * Opening `/crm/leads` in a fresh tab must show the CRM sidebar, whatever the
 * last app this browser chose was. Deriving from the route is what makes a
 * deep link, a bookmark and a shared URL land somewhere coherent; a stored
 * preference alone would show a CRM screen framed by the Trade sidebar.
 *
 * The three predicates are the allowlists `proxy.ts` already redirects
 * against, reused verbatim rather than re-expressed as path prefixes. A prefix
 * test would answer "crm" for `/crm/not-a-real-screen`, which the proxy
 * redirects to `/unavailable` — this returns `null` there instead and lets the
 * stored preference stand.
 *
 * `null` means the route belongs to no app. That is not a failure case:
 *
 *   * `/` is the portal root.
 *   * `/search` and `/getting-started` are deliberately cross-module — search
 *     fans out across Core and CRM, and the checklist walks a tenant through
 *     Core then CRM then Trade (see the note on `TENANT_ROUTES.search`). Being
 *     app-less is what keeps a CRM user in CRM when they open global search.
 *   * `/unavailable`, `/login` and anything unrecognized.
 *
 * For all of those the caller falls back to the stored preference.
 */
export function appForPath(pathname: string): NavAppId | null {
  if (isSupportedCrmPath(pathname)) return "crm";
  if (isSupportedTradePath(pathname)) return "trade";
  if (isSupportedCorePath(pathname)) return "workspace";
  return null;
}

/**
 * The chosen app, persisted per browser.
 *
 * A cookie, not `localStorage`, and deliberately so. The portal's three
 * localStorage axes — `tenant_lang`, `tenant_theme`, `tenant_density` — are
 * document-level attributes that must be right in the first painted frame, so
 * each needs the inline bootstrap in `app/layout.tsx` to beat hydration. The
 * app scope is not that kind of value: it selects which sections the sidebar
 * renders, which the server renders too. Reading it from a cookie in
 * `app/(tenant)/layout.tsx` makes the first server-rendered frame already
 * correct — no flash, no hydration mismatch, and no fourth inline script.
 *
 * This is the convention the sidebar's own persisted dimension already
 * follows: `tenant_sidebar` is a cookie for exactly the same reason
 * (`useSidebar.ts`). Same shape, same max-age, same samesite.
 */
export const NAV_APP_COOKIE = "tenant_app";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Narrows an untrusted cookie value — a hand-edited cookie is just a string. */
export function isNavAppId(value: string | undefined | null): value is NavAppId {
  return value === "workspace" || value === "crm" || value === "trade";
}

/** The app a server component should start the shell in. */
export function storedAppOrDefault(value: string | undefined | null): NavAppId {
  return isNavAppId(value) ? value : DEFAULT_NAV_APP;
}

export function writeStoredApp(app: NavAppId): void {
  document.cookie = `${NAV_APP_COOKIE}=${app}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}
