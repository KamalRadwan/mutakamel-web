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
 *   in `src/app/layout.tsx`, which takes the nonce. It also carries no
 *   `'self'` — see below, and do not re-add it.
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
 * `upgrade-insecure-requests` is absent to support the selected HTTP browser
 * deployment as well as HTTPS. Browser-facing TLS/HSTS is a separate ingress
 * choice; including this directive would force HTTP subresources to HTTPS.
 */
function buildContentSecurityPolicy(nonce: string): string {
  // React reconstructs server error stacks through `eval` in development, and
  // `next dev --webpack` serves eval-wrapped modules. Neither is true of a
  // production build.
  const isDevelopment = process.env.NODE_ENV === "development";
  const developmentScriptSources = isDevelopment ? " 'unsafe-eval'" : "";

  // `next dev` opens a hot-reload WebSocket at `ws://<host>/_next/webpack-hmr`.
  // CSP3 says `'self'` should cover a same-origin `ws:`, and Firefox does not
  // honour that — it blocks the socket, the dev client never connects, and the
  // page renders nothing. Added for development only; a production build opens
  // no WebSocket, so shipping this there would widen the policy for a
  // connection that is never made.
  //
  // This is exactly the gap the 13.1 verification had: the policy was driven
  // against `next build` + `next start` and proven there, and dev mode was
  // never exercised. Production was right; development was untested.
  const developmentConnectSources = isDevelopment ? " ws: wss:" : "";

  return [
    "default-src 'self'",
    // No `'self'` here, and this is not an oversight — D16 decided
    // `script-src 'nonce-<n>' 'strict-dynamic'` and the implementation had
    // drifted from it. CSP3 §6.6.2.2 says that when `'strict-dynamic'` is
    // present the browser ignores `'self'`, every host-source expression and
    // `'unsafe-inline'` in this directive, so the pair states two policies and
    // enforces one. Firefox says so out loud on every page load: `Ignoring
    // "'self'" within script-src: 'strict-dynamic' specified`.
    //
    // `'self'` is the usual CSP2 fallback for a browser that does not know
    // `'strict-dynamic'` and would otherwise refuse the lazily injected chunks.
    // There is no such browser here: Next 16 compiles for `chrome 111`,
    // `edge 111`, `firefox 111`, `safari 16.4`
    // (`next/dist/shared/lib/modern-browserslist-target`), and the last of
    // those to gain `'strict-dynamic'` was Safari 15.4. Adding a fallback for
    // browsers the bundle already refuses to run in buys nothing.
    //
    // Nothing needs a host allowance either. Every `<script>` Next emits —
    // framework, bundle, flight, and the inline bootstrap — carries this
    // nonce; webpack injects lazy chunks with `createElement("script")`, which
    // is exactly what `'strict-dynamic'` propagates trust to; and the app
    // loads no third-party script and constructs no Worker. The 2026-08-31
    // driving run recorded in security-headers.md is the proof rather than the
    // argument: it observed a full hydrate with zero violations under a policy
    // whose `'self'` the browser was already discarding.
    `script-src 'nonce-${nonce}' 'strict-dynamic'${developmentScriptSources}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${developmentConnectSources}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

/**
 * 16 random bytes as hex — deliberately **not** a UUID.
 *
 * AGENTS.md limits this workspace to UUIDv7 for identifiers, and a v7 spends
 * its first 48 bits on a timestamp, leaving roughly 74 unpredictable. A CSP
 * nonce is not an identifier: its only job is to be unguessable for the
 * lifetime of one response, so it wants every bit random. `getRandomValues`
 * gives a full 128, and the emitted shape — 32 lowercase hex characters — is
 * unchanged from the `randomUUID().replaceAll("-", "")` this replaces.
 */
function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let nonce = "";
  for (const byte of bytes) nonce += byte.toString(16).padStart(2, "0");
  return nonce;
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
