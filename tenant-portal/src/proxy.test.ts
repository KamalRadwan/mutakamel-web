import {
  getRedirectUrl,
  unstable_doesMiddlewareMatch as doesProxyMatch,
} from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "./proxy";

describe("Tenant Portal server route boundary", () => {
  it.each([
    "/core",
    "/core/authentication",
    "/crm",
    "/crm/leads",
    "/crm/customer-profiles/customer-id",
    "/crm/opportunities",
  ])("passes the supported route %s to its page", (pathname) => {
    const response = proxy(request(pathname));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it.each([
    ["/core/organization/branches", "core"],
    ["/crm/dashboard", "crm"],
    ["/crm/customer-profiles/customer-id/history", "crm"],
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

  it.each([
    "/",
    "/login",
    "/unavailable",
    "/api/tenant/core/v1/auth/web/session",
    "/trade",
    "/trade/inventory",
  ])(
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

  it.each(["/core", "/crm/leads"])(
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

function request(pathname: string, method = "GET"): NextRequest {
  return new NextRequest(`https://tenant.example.test${pathname}`, { method });
}
