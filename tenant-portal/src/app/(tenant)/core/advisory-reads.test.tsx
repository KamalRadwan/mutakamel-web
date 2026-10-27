// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useCompanyOptions } from "./settings/hooks/useCompanyOptions";
import { useTenantWebphoneSettings } from "./settings/webphone/hooks/useTenantWebphoneSettings";
import { fetchOrgNodes } from "./contracts/organization-contract";
import { fetchTenantUsers } from "./contracts/user-contract";
import { fetchTenantRoles } from "./contracts/role-contract";
import { fetchScopeRoleAssignments } from "./contracts/role-assignment-contract";

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: { permissions: ["webphone.settings.read"] }, isLoading: false,
  }),
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: "en" }) }));

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function deny(code: string) {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(
    JSON.stringify({ errorCode: code }), { status: 403 },
  ))));
}

it("keeps the Taxes company picker silent without company-read permission", async () => {
  deny("MISSING_REQUIRED_PERMISSIONS");
  const toast = vi.fn();
  window.addEventListener("global-toast", toast);
  try {
    const { result } = renderHook(() => useCompanyOptions("taxes.tax.manage"));
    const initialCompanies = result.current.companies;
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    await waitFor(() => expect(result.current.companies).not.toBe(initialCompanies));
    expect(result.current.companies).toEqual([]);
    expect(toast).not.toHaveBeenCalled();
  } finally {
    window.removeEventListener("global-toast", toast);
  }
});

it("renders unsubscribed WebPhone as a screen state without a toast", async () => {
  deny("WEBPHONE_MODULE_NOT_PURCHASED");
  const toast = vi.fn();
  window.addEventListener("global-toast", toast);
  try {
    const { result } = renderHook(() => useTenantWebphoneSettings());
    await waitFor(() => expect(result.current.loadState).toBe("READY"));
    expect(result.current.entitlement).toBe("NOT_PURCHASED");
    expect(result.current.config).toBeNull();
    expect(toast).not.toHaveBeenCalled();
  } finally {
    window.removeEventListener("global-toast", toast);
  }
});

it("forwards suppression through each advisory Core contract", async () => {
  deny("MISSING_REQUIRED_PERMISSIONS");
  const toast = vi.fn();
  window.addEventListener("global-toast", toast);
  const signal = new AbortController().signal;
  try {
    const reads = [
      () => fetchOrgNodes("companies", { page: 1, search: "", signal, suppressForbiddenToast: true }),
      () => fetchTenantUsers({ page: 1, search: "", filters: {}, signal, suppressForbiddenToast: true }),
      () => fetchTenantRoles({ page: 1, search: "", signal, suppressForbiddenToast: true }),
      () => fetchScopeRoleAssignments("01900100-0000-7000-8000-000000000001", signal, {
        suppressForbiddenToast: true,
      }),
    ];
    for (const read of reads) {
      await expect(read()).rejects.toMatchObject({ response: { status: 403 } });
    }
    expect(toast).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(4);
  } finally {
    window.removeEventListener("global-toast", toast);
  }
});
