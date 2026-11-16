import { unstable_doesMiddlewareMatch as doesProxyMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../next.config";
import { config, proxy } from "./proxy";

describe("Admin document security headers", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["/", "/login", "/dashboard", "/tenants/tenant-id", "/settings/webphone"])(
    "protects %s with an enforcing nonce policy and security headers",
    (url) => {
      expect(doesProxyMatch({ config, nextConfig, url })).toBe(true);
      const response = proxy(new NextRequest(`http://localhost:5001${url}`));
      const policy = response.headers.get("content-security-policy") ?? "";
      const nonce = response.headers.get("x-middleware-request-x-nonce");

      expect(response.status).toBe(200);
      expect(nonce).toMatch(/^[0-9a-f]{32}$/u);
      expect(policy.split("; ")).toEqual([
        "default-src 'self'",
        `script-src 'nonce-${nonce}' 'strict-dynamic'`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://tile.openstreetmap.org",
        "font-src 'self'",
        "connect-src 'self' wss:",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'self'",
        "object-src 'none'",
      ]);
      expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(policy);
      expect(response.headers.get("content-security-policy-report-only")).toBeNull();
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("referrer-policy")).toBe("same-origin");
      expect(response.headers.get("permissions-policy")).toBe(
        "camera=(), microphone=(self), geolocation=()",
      );
    },
  );

  it("replaces supplied nonce/CSP headers and generates a fresh nonce on repeat requests", () => {
    const request = new NextRequest("http://localhost:5001/login", {
      headers: { "x-nonce": "caller-nonce", "Content-Security-Policy": "script-src *" },
    });
    const first = proxy(request);
    const second = proxy(request);
    const nonce = first.headers.get("x-middleware-request-x-nonce");

    expect(nonce).toMatch(/^[0-9a-f]{32}$/u);
    expect(nonce).not.toBe(second.headers.get("x-middleware-request-x-nonce"));
    expect(first.headers.get("content-security-policy")).not.toContain("caller-nonce");
    expect(first.headers.get("x-middleware-request-content-security-policy")).toBe(
      first.headers.get("content-security-policy"),
    );
    expect(request.headers.get("x-nonce")).toBe("caller-nonce");
  });

  it.each([
    "/api/admin/core/v1/auth/me",
    "/_next/static/chunks/app.js",
    "/_next/image?url=%2Flogo.png&w=64&q=75",
    "/favicon.ico",
  ])("excludes %s from document policy handling", (url) => {
    expect(doesProxyMatch({ config, nextConfig, url })).toBe(false);
  });

  it("allows eval and insecure HMR WebSockets only in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const policy = proxy(new NextRequest("http://localhost:5001/login"))
      .headers.get("content-security-policy");
    expect(policy).toContain("'strict-dynamic' 'unsafe-eval'");
    expect(policy).toContain("connect-src 'self' wss: ws:");
  });

  it("disables Next's X-Powered-By header", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
