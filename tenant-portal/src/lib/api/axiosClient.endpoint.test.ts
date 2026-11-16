// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { customTenantFetch } from "./axiosClient";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.cookie = "mutakamel-http-tenant-csrf=endpoint-proof; path=/";
});

afterEach(() => {
  document.cookie = "mutakamel-http-tenant-csrf=; Max-Age=0; path=/";
  vi.unstubAllGlobals();
});

describe("tenant endpoint boundary", () => {
  it.each([
    "https://attacker.invalid/api/tenant/core/v1/settings",
    "http://attacker.invalid/api/tenant/core/v1/settings",
    `${window.location.origin}/api/tenant/core/v1/settings`,
    "//attacker.invalid/api/tenant/core/v1/settings",
    "api/tenant/core/v1/settings",
    "/api/admin/core/v1/settings",
    "/api/tenant-other/core/v1/settings",
    "/api/tenant",
    "/api/tenant/../../admin",
    "/api/tenant/%2e%2e/admin",
    "/api/tenant/\\attacker.invalid",
    "/api/tenant/\n../admin",
  ])("rejects %j before fetch", async (endpoint) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(customTenantFetch(endpoint, { method: "POST", body: "{}" }))
      .rejects.toMatchObject({
        response: { status: 400, data: { errorCode: "INVALID_TENANT_ENDPOINT" } },
      });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["core", "crm", "trade"])("preserves the %s path, query, credentials and CSRF proof", async (app) => {
    const endpoint = `/api/tenant/${app}/v1/settings?next=https%3A%2F%2Fexample.com`;
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await customTenantFetch(endpoint, { method: "POST", body: "{}" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(endpoint, expect.objectContaining({
      credentials: "include",
      method: "POST",
    }));
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("x-csrf-token")).toBe("endpoint-proof");
  });
});
