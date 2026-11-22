// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTenantPlatformDomain } from "./useTenantPlatformDomain";

const { get, put, access } = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  access: { read: true, write: true },
}));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "actor" }, isLoading: false }),
}));
vi.mock("@/lib/auth/rbac", () => ({
  adminCan: () => access.read,
  adminCanAll: () => access.write,
  ADMIN_RBAC_CRITICAL: { SETTINGS_UPDATE: ["admin.settings.update", "admin.settings.critical"] },
}));
vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { get, put },
  getApiRequestOutcome: () => undefined,
}));

const key = "tenants.platform_domain";
const domain = "tenants.example.net";
const anotherDomain = "tenants.example.org";
const base = "/api/admin/core/v1/system-settings";
const correlationId = "019f0000-0000-7000-8000-000000000007";

function response(data: unknown) {
  return { data: { success: true, data, correlationId, timestamp: "2026-11-22T10:00:00.000Z" } };
}

function setting(value: string) {
  return response({
    key, value, description: "Domain", descriptionI18n: { en: "Domain", ar: "النطاق" },
    isDefault: false, readOnly: false,
  });
}

function failure(httpStatus: number, errorCode: string) {
  return { isNormalized: true, httpStatus, errorCode, message: errorCode, correlationId };
}

describe("tenant platform domain settings", () => {
  beforeEach(() => {
    get.mockReset();
    put.mockReset();
    access.read = true;
    access.write = true;
  });

  it("loads missing and empty states without permitting an arbitrary domain", async () => {
    get.mockResolvedValue(response({ defaultDomain: null, eligibleDomains: [] }));
    const { result } = renderHook(useTenantPlatformDomain);
    await waitFor(() => expect(result.current.loadState).toBe("READY"));
    expect(result.current.options).toEqual({ defaultDomain: null, eligibleDomains: [] });
    expect(get).toHaveBeenCalledWith(`${base}/tenant-platform-domain`, expect.objectContaining({ cache: "no-store" }));
    act(() => result.current.select(domain));
    await act(() => result.current.save());
    expect(put).not.toHaveBeenCalled();
  });

  it("distinguishes missing read permission from a read-only setting", async () => {
    access.read = false;
    access.write = false;
    const { result, rerender } = renderHook(useTenantPlatformDomain);
    expect(result.current.loadState).toBe("FORBIDDEN");
    expect(get).not.toHaveBeenCalled();
    access.read = true;
    get.mockResolvedValue(response({ defaultDomain: domain, eligibleDomains: [domain, anotherDomain] }));
    rerender();
    await waitFor(() => expect(result.current.loadState).toBe("READY"));
    expect(result.current.options?.defaultDomain).toBe(domain);
    act(() => result.current.select(anotherDomain));
    expect(result.current.canSave).toBe(false);
  });

  it("refreshes an outdated eligible list after Core rejects the selection", async () => {
    get.mockResolvedValueOnce(response({ defaultDomain: null, eligibleDomains: [domain] }));
    get.mockResolvedValueOnce(response({ defaultDomain: domain, eligibleDomains: [anotherDomain] }));
    put.mockRejectedValueOnce(failure(422, "TENANT_PLATFORM_DOMAIN_NOT_ALLOWED"));
    const { result } = renderHook(useTenantPlatformDomain);
    await waitFor(() => expect(result.current.loadState).toBe("READY"));
    act(() => result.current.select(domain));
    await act(() => result.current.save());
    expect(result.current.stale).toBe(true);
    expect(result.current.canSave).toBe(false);
    expect(result.current.writeError?.correlationId).toBe(correlationId);
    await act(() => result.current.reload());
    expect(result.current.options).toEqual({ defaultDomain: domain, eligibleDomains: [anotherDomain] });
    expect(result.current.selected).toBe("");
  });

  it("keeps the same idempotency key for an ambiguous outcome and applies Core's response", async () => {
    get.mockResolvedValue(response({ defaultDomain: null, eligibleDomains: [domain, anotherDomain] }));
    put.mockRejectedValueOnce(failure(503, "UNAVAILABLE")).mockResolvedValueOnce(setting(domain));
    const { result } = renderHook(useTenantPlatformDomain);
    await waitFor(() => expect(result.current.loadState).toBe("READY"));
    act(() => result.current.select(domain));
    await act(() => result.current.save());
    expect(result.current.ambiguous).toBe(true);
    act(() => result.current.select(anotherDomain));
    expect(result.current.selected).toBe(domain);
    await act(() => result.current.save());
    expect(put).toHaveBeenCalledTimes(2);
    const firstCall = put.mock.calls[0];
    expect(firstCall).toEqual([
      `${base}/${key}`,
      { value: domain },
      expect.objectContaining({ headers: { "x-idempotency-key": expect.stringMatching(/^[0-9a-f-]+$/iu) } }),
    ]);
    expect(put.mock.calls[1][2].headers).toEqual(firstCall[2].headers);
    expect(result.current.options?.defaultDomain).toBe(domain);
    expect(result.current.ambiguous).toBe(false);
  });
});
