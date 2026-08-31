import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  isSupportedCorePath,
  isSupportedCrmPath,
  isSupportedTradePath,
} from "./lib/navigation/tenant-routes";

type TenantModule = "core" | "crm" | "trade";

const SUPPORTED_PATH_CHECKS: Record<TenantModule, (pathname: string) => boolean> = {
  core: isSupportedCorePath,
  crm: isSupportedCrmPath,
  trade: isSupportedTradePath,
};

/**
 * The rollout step `docs/architecture/security-headers.md` calls non-optional:
 * ship the policy as `Content-Security-Policy-Report-Only` first, watch, then
 * enforce. Read at request time — Proxy runs on the Node.js runtime, so this is
 * a real environment read rather than a build-time inline.
 *
 * Enforcing is the default: this project has twice shipped a mechanism that was
 * sound in reasoning and inert in fact, and a policy that only ever reports is
 * exactly that shape.
 */
function isReportOnly(): boolean {
  return process.env.TENANT_CSP_REPORT_ONLY === "1";
}

/**
 * The policy decided in `docs/build/DECISIONS.md` D16, against the real code.
 *
 * Four directives are deliberate and must not be "simplified":
 *
 * - `script-src` carries the nonce and `'strict-dynamic'`, and **no**
 *   `'unsafe-inline'`. The one inline script in the app is the theme bootstrap
 *   in `src/app/layout.tsx`, which takes the nonce.
 * - `style-src` needs `'unsafe-inline'`, but **not** for the reason
 *   security-headers.md originally gave. Tenant branding and density write
 *   through `element.style.setProperty` — a CSSOM mutation `style-src` never
 *   sees. What forces it is `style` **attributes in server-rendered markup**:
 *   React `style={{…}}` props and Radix's positioning both emit them, and no
 *   nonce can ever whitelist a style attribute.
 * - `connect-src 'self'` covers both the Gateway (`/api/tenant/…`, same origin)
 *   and the realtime socket — `createSocketIoTransportFactory` documents that it
 *   "always uses the current browser origin", and `'self'` matches `wss:` on the
 *   page's own origin. If realtime ever moves to its own host, name it here
 *   rather than widening to `*`.
 * - `img-src 'self'` covers the two branding binaries; they are same-origin
 *   paths (`PUBLIC_BRANDING_LOGO_PATH`, `PUBLIC_BRANDING_ICON_PATH`), never a
 *   CDN URL.
 *
 * `upgrade-insecure-requests` is absent on purpose: NPM forces SSL and sets
 * HSTS, and the app loads no external subresource, so there is nothing to
 * upgrade — while including it would break a plain-HTTP `next start` used to
 * verify the policy.
 */
function buildContentSecurityPolicy(nonce: string): string {
  // React reconstructs server error stacks through `eval` in development, and
  // `next dev --webpack` serves eval-wrapped modules. Neither is true of a
  // production build.
  const developmentScriptSources =
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developmentScriptSources}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

function createNonce(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

function readTenantModule(pathname: string): TenantModule | null {
  const segment = pathname.split("/")[1];
  return segment === "core" || segment === "crm" || segment === "trade"
    ? segment
    : null;
}

function applyPolicy(response: NextResponse, policy: string): NextResponse {
  response.headers.set(
    isReportOnly()
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy",
    policy,
  );
  return response;
}

export function proxy(request: NextRequest): NextResponse {
  const nonce = createNonce();
  const policy = buildContentSecurityPolicy(nonce);
  const pathname = request.nextUrl.pathname;
  const tenantModule = readTenantModule(pathname);

  // Both module rules are gated on the module segment, not on the matcher. The
  // matcher is wide because CSP belongs on every document — including /login,
  // which is the one screen that handles a password. Gating here is what keeps
  // widening it from resurrecting DEFECTS.md D22, where a matched path with no
  // allowlist entry redirected six finished screens to /unavailable.
  if (tenantModule !== null) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return applyPolicy(
        new NextResponse(null, {
          status: 405,
          headers: {
            Allow: "GET, HEAD",
            "Cache-Control": "no-store",
          },
        }),
        policy,
      );
    }

    if (!SUPPORTED_PATH_CHECKS[tenantModule](pathname)) {
      const unavailableUrl = request.nextUrl.clone();
      unavailableUrl.pathname = "/unavailable";
      unavailableUrl.search = "";
      unavailableUrl.searchParams.set("module", tenantModule);

      return applyPolicy(NextResponse.redirect(unavailableUrl), policy);
    }
  }

  // The nonce reaches the renderer on the REQUEST headers, not the response
  // ones: Next parses the request's `Content-Security-Policy`, extracts
  // `'nonce-…'`, and stamps it onto every framework and bundle script it emits.
  // Setting it only on the response — which is what security-headers.md's first
  // draft did — leaves `headers()` in the layout with nothing to read, and the
  // bootstrap script is silently blocked.
  //
  // The request copy always carries the enforcing name even in report-only
  // mode, so flipping the mode changes what the browser does and nothing about
  // what the renderer emits.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", policy);
  requestHeaders.set("x-nonce", nonce);

  return applyPolicy(
    NextResponse.next({ request: { headers: requestHeaders } }),
    policy,
  );
}

export const config = {
  matcher: [
    // Everything that can render a document. `api` is the Gateway proxy path,
    // and the three `_next`/icon exclusions are static bytes that carry no
    // inline script — a CSP on them costs a header and protects nothing.
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
