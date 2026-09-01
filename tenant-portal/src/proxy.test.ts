import {
  getRedirectUrl,
  unstable_doesMiddlewareMatch as doesProxyMatch,
} from "next/experimental/testing/server";
import { NextRequest, type NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "./proxy";

describe("Tenant Portal server route boundary", () => {
  it.each([
    "/core",
    "/core/authentication",
    "/core/settings",
    "/core/settings/workspace",
    "/core/settings/currencies",
    "/core/settings/taxes",
    "/core/settings/numbering",
    "/core/settings/email",
    "/core/notifications",
    "/core/notifications/0199f2b0-1111-4222-8333-444455556666",
    "/core/profile",
    "/core/organization",
    "/core/organization/companies",
    "/core/organization/companies/0199f2b0-1111-4222-8333-444455556666",
    "/core/organization/branches",
    "/core/organization/departments",
    "/core/organization/teams",
    "/core/users",
    "/core/users/0199f2b0-1111-4222-8333-444455556666",
    "/core/roles",
    "/core/roles/0199f2b0-1111-4222-8333-444455556666",
    "/core/directory",
    "/core/directory/settings",
    "/core/directory/0199f2b0-1111-4222-8333-444455556666",
    "/core/templates",
    "/core/templates/assets",
    "/core/templates/assignments",
    "/core/templates/0199f2b0-1111-4222-8333-444455556666",
    "/core/activities",
    "/core/audit",
    "/core/settings/branding",
    "/core/billing",
    "/core/billing/invoices",
    "/core/billing/invoices/0199f2b0-1111-4222-8333-444455556666",
    "/core/subscription",
    "/crm",
    "/crm/leads",
    "/crm/customer-profiles/customer-id",
    "/crm/opportunities",
    // Trade · advanced and analytics (Phase 12). `/trade/inventory/movements`
    // is listed deliberately: it has no read route behind it (Q37) but is
    // still a real screen, so the allowlist must admit it.
    "/trade",
    "/trade/inventory",
    "/trade/inventory/nodes",
    "/trade/inventory/nodes/0199f2b0-1111-4222-8333-444455556666",
    "/trade/inventory/periods",
    "/trade/inventory/uom-conversions",
    "/trade/inventory/movements",
    "/trade/inventory/serials",
    "/trade/inventory/serials/0199f2b0-1111-4222-8333-444455556666",
    "/trade/inventory/decisions",
    "/trade/inventory/decisions/0199f2b0-1111-4222-8333-444455556666",
    "/trade/price-books",
    "/trade/price-book-versions/0199f2b0-1111-4222-8333-444455556666",
    "/trade/pricing",
    "/trade/policies",
    "/trade/workflows",
    "/trade/decisions/0199f2b0-1111-4222-8333-444455556666",
    "/trade/document-profiles",
    "/trade/extensions",
    "/trade/extensions/0199f2b0-1111-4222-8333-444455556666",
    "/trade/imports",
    "/trade/imports/0199f2b0-1111-4222-8333-444455556666",
    "/trade/import-mappings",
    "/trade/import-mappings/0199f2b0-1111-4222-8333-444455556666",
    "/trade/webhooks",
    "/trade/webhooks/0199f2b0-1111-4222-8333-444455556666",
    "/trade/webhooks/deliveries",
    "/trade/webhooks/deliveries/0199f2b0-1111-4222-8333-444455556666",
    "/trade/control-tower",
    "/trade/control-tower/0199f2b0-1111-4222-8333-444455556666",
    "/trade/dashboards",
    "/trade/dashboards/0199f2b0-1111-4222-8333-444455556666",
    "/trade/widgets",
    "/trade/widgets/0199f2b0-1111-4222-8333-444455556666",
  ])("passes the supported route %s to its page", (pathname) => {
    const response = proxy(request(pathname));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it.each([
    ["/core/organization/branches/an-id/extra", "core"],
    ["/core/billing/invoices/an-id/lines", "core"],
    ["/core/subscription/plan", "core"],
    ["/core/templates/an-id/versions", "core"],
    ["/core/directory/an-id/addresses", "core"],
    ["/core/activities/an-id", "core"],
    ["/crm/dashboard", "crm"],
    ["/crm/customer-profiles/customer-id/history", "crm"],
    // One detail segment per list, never two.
    ["/trade/inventory/nodes/an-id/branches", "trade"],
    // Document profiles and their versions have no GET by id (Q38), so no
    // detail route exists for either — a deep link must not render a shell.
    ["/trade/document-profiles/an-id", "trade"],
    ["/trade/document-profile-versions/an-id", "trade"],
    // The governed ladder has nine action routes and a PATCH but no read, so a
    // version is only ever seen through the definition list (Q91).
    ["/trade/policy-versions/an-id", "trade"],
    ["/trade/workflow-versions/an-id", "trade"],
    // Movements expose no GET at all (Q37).
    ["/trade/inventory/receipts/an-id", "trade"],
  ])(
    "redirects unsupported route %s before its page renders",
    (pathname, tenantModule) => {
      const response = proxy(request(`${pathname}?returnTo=%2Fprivate&debug=1`));
      const expectedLocation =
        `https://tenant.example.test/unavailable?module=${tenantModule}`;

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(expectedLocation);
      expect(getRedirectUrl(response)).toBe(expectedLocation);
      expect(response.headers.get("location")).not.toContain("returnTo");
      expect(response.headers.get("location")).not.toContain("debug");
    },
  );

  it.each(["/crm/leads"])(
    "rejects non-navigation requests to UI path %s",
    (pathname) => {
      const response = proxy(request(pathname, "POST"));

      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, HEAD");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("location")).toBeNull();
    },
  );

  // The matcher went wide in 13.1 so CSP reaches every document, /login most
  // of all. What used to protect these paths was the matcher not claiming
  // them; what protects them now is that both module rules are gated on the
  // module segment. That is a stronger guarantee, so it is asserted directly:
  // a matched path outside the three modules must be passed through untouched.
  //
  // Six finished screens once shipped unreachable exactly here — a matched
  // path with no entry in an `isSupported*Path` allowlist redirected to
  // /unavailable (DEFECTS.md D22, Q40).
  it.each([
    "/",
    "/login",
    "/unavailable",
    "/session-expired",
    "/account-suspended",
    // The two Phase 13 cross-module surfaces (13.21, 13.23). Both sit at the
    // top level because neither belongs to one module.
    "/search",
    "/getting-started",
  ])("passes the non-module path %s through untouched", (pathname) => {
    const response = proxy(request(pathname));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(getRedirectUrl(response)).toBeNull();
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'self'",
    );
  });

  // A non-GET to a non-module path must NOT be rejected: Server Functions POST
  // to the route that uses them, and the 405 rule was only ever about the three
  // module segments.
  it("does not reject a non-GET request to a non-module path", () => {
    const response = proxy(request("/login", "POST"));

    expect(response.status).toBe(200);
    expect(response.headers.get("allow")).toBeNull();
  });

  it.each(["/api/tenant/core/v1/auth/web/session"])(
    "does not match unrelated path %s",
    (url) => {
      expect(
        doesProxyMatch({
          config,
          nextConfig: {},
          url,
        }),
      ).toBe(false);
    },
  );

  it.each(["/", "/login", "/search", "/getting-started"])(
    "matches the document path %s so it can carry a policy",
    (url) => {
      expect(doesProxyMatch({ config, nextConfig: {}, url })).toBe(true);
    },
  );

  // `/trade` joined the matcher with Phase 12: the segment now has real
  // screens, so it is admitted through `isSupportedTradePath` like the other
  // two modules rather than falling through unmatched.
  it.each(["/core", "/crm/leads", "/trade", "/trade/inventory"])(
    "matches the tenant module path %s",
    (url) => {
      expect(
        doesProxyMatch({
          config,
          nextConfig: {},
          url,
        }),
      ).toBe(true);
    },
  );
});

// MASTER-PLAN 13.1, policy from DECISIONS.md D16.
//
// These assert the two halves that fail SILENTLY. A policy the browser never
// receives, and a nonce that never reaches the renderer, both look exactly like
// a working app until an inline script is blocked or an injected one is not.
describe("Content Security Policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["/", "/login", "/crm/leads"])(
    "sets an enforcing policy on %s",
    (pathname) => {
      const response = proxy(request(pathname));

      expect(response.headers.get("content-security-policy-report-only")).toBeNull();
      expect(policyOf(response)).toContain("default-src 'self'");
    },
  );

  it.each([
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ])("declares %s", (directive) => {
    expect(policyOf(proxy(request("/crm/leads")))).toContain(directive);
  });

  // `'self'` is asserted absent, not merely unused. A browser that honours
  // `'strict-dynamic'` discards `'self'`, every host-source and
  // `'unsafe-inline'` from this directive — so listing it states a policy the
  // browser does not enforce, and Firefox reports it as an ignored source on
  // every page load. `default-src 'self'` above is untouched; this is only
  // about the directive `'strict-dynamic'` governs.
  it("gives script-src a nonce and strict-dynamic, and no ignored sources", () => {
    const policy = policyOf(proxy(request("/crm/leads")));
    const scriptSource = directive(policy, "script-src");

    expect(scriptSource).toMatch(/'nonce-[0-9a-f]{32}'/u);
    expect(scriptSource).toContain("'strict-dynamic'");
    expect(scriptSource).not.toContain("'unsafe-inline'");
    expect(scriptSource).not.toContain("'self'");
  });

  // The theme bootstrap is an inline <script>. It survives the policy above
  // only if the nonce reaches the renderer, and the renderer reads it from the
  // REQUEST headers. `x-middleware-request-*` is how NextResponse.next({request})
  // carries an overridden request header — asserting it is the only way to
  // prove the nonce is not stranded on the response.
  it("hands the same nonce to the renderer on the request headers", () => {
    const response = proxy(request("/login"));
    const nonce = policyOf(response).match(/'nonce-([0-9a-f]{32})'/u)?.[1];

    expect(nonce).toBeDefined();
    expect(response.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(
      response.headers.get("x-middleware-request-content-security-policy"),
    ).toBe(policyOf(response));
  });

  it("mints a fresh nonce for every request", () => {
    const nonces = new Set(
      Array.from({ length: 5 }, () =>
        policyOf(proxy(request("/login"))).match(/'nonce-([0-9a-f]{32})'/u)?.[1],
      ),
    );

    expect(nonces.size).toBe(5);
  });

  it("adds 'unsafe-eval' in development only", () => {
    expect(directive(policyOf(proxy(request("/login"))), "script-src")).not.toContain(
      "'unsafe-eval'",
    );

    vi.stubEnv("NODE_ENV", "development");

    expect(directive(policyOf(proxy(request("/login"))), "script-src")).toContain(
      "'unsafe-eval'",
    );
  });

  // security-headers.md's rollout calls the report-only soak non-optional. It
  // is only real if the flag actually changes which header ships.
  it("ships report-only, and only report-only, when the flag is set", () => {
    vi.stubEnv("TENANT_CSP_REPORT_ONLY", "1");
    const response = proxy(request("/login"));

    expect(response.headers.get("content-security-policy")).toBeNull();
    expect(
      response.headers.get("content-security-policy-report-only"),
    ).toContain("default-src 'self'");
    // The renderer must still stamp nonces, so flipping the mode changes the
    // browser's behaviour and nothing about the emitted HTML.
    expect(
      response.headers.get("x-middleware-request-content-security-policy"),
    ).toContain("'strict-dynamic'");
  });

  it("still sets the policy on the responses that carry no document", () => {
    expect(policyOf(proxy(request("/crm/dashboard")))).toContain("default-src 'self'");
    expect(policyOf(proxy(request("/crm/leads", "POST")))).toContain("default-src 'self'");
  });
});

function policyOf(response: NextResponse): string {
  return (
    response.headers.get("content-security-policy") ??
    response.headers.get("content-security-policy-report-only") ??
    ""
  );
}

function directive(policy: string, name: string): string {
  return (
    policy
      .split("; ")
      .find((entry) => entry.startsWith(`${name} `)) ?? ""
  );
}

function request(pathname: string, method = "GET"): NextRequest {
  return new NextRequest(`https://tenant.example.test${pathname}`, { method });
}
