// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { axiosClient, subscribePermissionDenials } from "./axiosClient";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

it.each(["post", "patch", "put", "delete"] as const)("publishes structured %s denials and preserves the global toast", async (method) => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
    errorCode: "CRM_SCOPED_PERMISSION_DENIED", message: "Denied", correlationId: "reference",
  }), { status: 403 }))));
  const listener = vi.fn();
  const toast = vi.fn();
  const unsubscribe = subscribePermissionDenials(listener);
  window.addEventListener("global-toast", toast);
  const endpoint = "/api/tenant/crm/v1/leads/example";
  const config = { headers: { "x-mutakamel-branch-id": "branch", "x-mutakamel-company-id": "company" } };
  try {
    const write = () => method === "delete"
      ? axiosClient.delete(endpoint, config) : axiosClient[method](endpoint, {}, config);
    await expect(write()).rejects.toMatchObject({ response: { status: 403,
      data: { errorCode: "CRM_SCOPED_PERMISSION_DENIED", correlationId: "reference" } } });
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({
      code: "CRM_SCOPED_PERMISSION_DENIED", endpoint, method: method.toUpperCase(),
      branchId: "branch", companyId: "company",
    });
    expect(toast).toHaveBeenCalledOnce();
    expect((toast.mock.calls[0][0] as CustomEvent).detail).toMatchObject({ type: "error" });
    unsubscribe();
    await expect(write()).rejects.toMatchObject({ response: { status: 403 } });
    expect(listener).toHaveBeenCalledOnce();
    expect(toast).toHaveBeenCalledTimes(2);
  } finally {
    unsubscribe();
    window.removeEventListener("global-toast", toast);
  }
});

it("does not publish permission denials for server errors", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
  const listener = vi.fn();
  const unsubscribe = subscribePermissionDenials(listener);
  try {
    await expect(axiosClient.get("/api/tenant/crm/v1/leads")).rejects.toMatchObject({ response: { status: 500 } });
    expect(listener).not.toHaveBeenCalled();
  } finally { unsubscribe(); }
});

it("suppresses advisory toasts while preserving rejection and denial events", async () => {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(
    JSON.stringify({ errorCode: "MISSING_REQUIRED_PERMISSIONS" }), { status: 403 },
  )));
  vi.stubGlobal("fetch", fetchMock);
  const toast = vi.fn();
  const listener = vi.fn();
  const unsubscribe = subscribePermissionDenials(listener);
  window.addEventListener("global-toast", toast);
  try {
    await expect(axiosClient.get("/api/tenant/core/v1/organization/companies", {
      suppressForbiddenToast: true,
    })).rejects.toMatchObject({ response: { status: 403 } });
    expect(toast).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("suppressForbiddenToast");
  } finally {
    unsubscribe();
    window.removeEventListener("global-toast", toast);
  }
});

it.each(["ar", "en"] as const)("uses code-specific denial copy in %s", async (language) => {
  window.localStorage.setItem("tenant_lang", language);
  const dictionaries = { ar, en };
  const copy = dictionaries[language];
  const toast = vi.fn();
  window.addEventListener("global-toast", toast);
  try {
    for (const code of ["TENANT_WIDE_PERMISSION_REQUIRED", "COMPANY_PERMISSION_DENIED",
      "ROLE_PERMISSION_GRANT_DENIED", "MISSING_REQUIRED_PERMISSIONS"] as const) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
        JSON.stringify({ code, message: "Untranslated upstream text" }), { status: 403 },
      )));
      await expect(axiosClient.post("/api/tenant/core/v1/roles", {}))
        .rejects.toMatchObject({ response: { status: 403 } });
      expect((toast.mock.lastCall?.[0] as CustomEvent).detail).toMatchObject({
        title: copy.errors.accessDenied,
        message: copy.coreIdentity.errors[code],
        dedupeKey: `forbidden:${code}`,
      });
    }
  } finally {
    window.removeEventListener("global-toast", toast);
  }
});

it("falls back safely for an unknown denial code", async () => {
  window.localStorage.setItem("tenant_lang", "en");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ code: "toString" }), { status: 403 },
  )));
  const toast = vi.fn();
  window.addEventListener("global-toast", toast);
  try {
    await expect(axiosClient.get("/api/tenant/core/v1/roles"))
      .rejects.toMatchObject({ response: { status: 403 } });
    expect((toast.mock.calls[0][0] as CustomEvent).detail.message).toBe(en.errors.accessDeniedMessage);
  } finally {
    window.removeEventListener("global-toast", toast);
  }
});
