// @vitest-environment jsdom

import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError, axiosClient } from "@/lib/api/axiosClient";
import { useAcquisitionSources } from "../../acquisition-sources/hooks/useAcquisitionSources";
import { useAcquisitionSourceIcon } from "../../acquisition-sources/hooks/useAcquisitionSourceIcon";
import { useCrmCustomFields } from "../../custom-fields/hooks/useCrmCustomFields";
import CrmSettingsPage from "../page";
import { useCrmSettings } from "./useCrmSettings";

const locale = vi.hoisted(() => ({ lang: "ar" as "ar" | "en" }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: locale.lang, t: { ar, en }[locale.lang] }),
}));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { permissions: [
    "crm.settings.read", "crm.settings.manage", "crm.acquisition_sources.manage", "crm.custom_fields.manage",
  ] } }),
}));
vi.mock("@/design-system", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/design-system")>(),
  SubNav: () => null,
}));

const settings = {
  id: "01900100-0000-7000-8000-000000000001",
  requireQualifiedStageForConversion: true,
  defaultLeadStageId: null,
  defaultPipelineId: "01900100-0000-7000-8000-000000000002",
  outboundEmailContentRetentionDays: 730,
  outboundEmailRetentionPolicyRevision: 1,
  asteriskIntegration: { enabled: false, allowInvalidTlsCertificate: false },
};
const source = {
  id: settings.id, nameAr: "إحالة", nameEn: "Referral", isActive: true,
  sortOrder: 1, createdAt: "2026-10-18T00:00:00.000Z", updatedAt: "2026-10-18T00:00:00.000Z", iconUrl: null,
};
const input = {
  ownerType: "LEAD" as const, fieldKey: "channel", nameAr: "القناة", nameEn: "Channel",
  type: "TEXT" as const, isSearchable: false,
};
const outcomes = [
  { status: 403, key: "errorForbidden" },
  { status: 409, key: "errorConflict" },
  { status: 422, key: "errorValidation" },
] as const;
function response(data: unknown) {
  return { data, status: 200, statusText: "OK", headers: new Headers() };
}
function failure(status: number) {
  return new TenantApiClientError("Private server prose", {
    status, statusText: "Failure", headers: new Headers(),
    data: { code: "UNKNOWN_CONFIGURATION_FAILURE", message: "Private server prose" },
  });
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe.each([{ lang: "ar", t: ar }, { lang: "en", t: en }] as const)("$lang configuration feedback", ({ lang, t }) => {
  beforeEach(() => {
    locale.lang = lang;
    vi.spyOn(axiosClient, "get").mockResolvedValue(response([]));
  });

  it.each(outcomes)("localizes $status on source and field creation", async ({ status, key }) => {
    const post = vi.spyOn(axiosClient, "post").mockRejectedValue(failure(status));
    const { result } = renderHook(() => ({ sources: useAcquisitionSources(), fields: useCrmCustomFields() }));
    await waitFor(() => expect(result.current.sources.isLoading || result.current.fields.isLoading).toBe(false));
    await act(async () => { await result.current.sources.handleCreate(source); });
    await act(async () => { await result.current.fields.handleCreate(input); });
    expect(result.current.sources.mutationError).toBe(t.crmShared[key]);
    expect(result.current.fields.createError).toBe(t.crmShared[key]);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it.each(outcomes)("localizes $status on settings saves and icon uploads", async ({ status, key }) => {
    vi.mocked(axiosClient.get).mockResolvedValue(response(settings));
    vi.spyOn(axiosClient, "put").mockRejectedValue(failure(status));
    vi.spyOn(axiosClient, "post").mockRejectedValue(failure(status));
    const { result } = renderHook(() => ({ settings: useCrmSettings(), icon: useAcquisitionSourceIcon(true, vi.fn()) }));
    await waitFor(() => expect(result.current.settings.settings).not.toBeNull());
    act(() => {
      result.current.settings.setDraft({ requireQualifiedStageForConversion: false, outboundEmailContentRetentionDays: 730 });
      result.current.icon.select(source);
    });
    await act(async () => { await result.current.settings.saveSettings(); });
    await act(async () => { await result.current.icon.upload(new File(["image"], "icon.png", { type: "image/png" })); });
    expect(result.current.settings.error).toBe(t.crmShared[key]);
    expect(result.current.icon.error).toBe(t.crmShared[key]);
  });

  it("uses localized name validation without sending a request", async () => {
    const post = vi.spyOn(axiosClient, "post");
    const { result } = renderHook(() => useAcquisitionSources());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.handleCreate({ nameAr: "", nameEn: "" }); });
    expect(result.current.mutationError).toBe(t.crmAcquisitionSources.invalidNames);
    expect(post).not.toHaveBeenCalled();
  });

  it("localizes malformed mutation responses without replaying the write", async () => {
    const post = vi.spyOn(axiosClient, "post").mockResolvedValue(response({}));
    const { result } = renderHook(() => ({ sources: useAcquisitionSources(), fields: useCrmCustomFields() }));
    await waitFor(() => expect(result.current.sources.isLoading || result.current.fields.isLoading).toBe(false));
    await act(async () => { await result.current.sources.handleCreate(source); });
    await act(async () => { await result.current.fields.handleCreate(input); });
    expect(result.current.sources.mutationError).toBe(t.crmAcquisitionSources.createUncertain);
    expect(result.current.fields.createError).toBe(t.crmCustomFields.ambiguousCreateRefreshed);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("shows one translated settings load-error surface after a parse failure", async () => {
    vi.mocked(axiosClient.get).mockResolvedValue(response({}));
    render(<CrmSettingsPage />);
    await screen.findByText(t.crmSettings.loadFailed);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: t.crmSettings.retry })).toHaveLength(1);
    expect(screen.queryByText("INVALID_CRM_SETTINGS_RESPONSE")).not.toBeInTheDocument();
  });

  it("does not retain parser prose in catalogue error state", async () => {
    vi.mocked(axiosClient.get).mockResolvedValue(response({}));
    const { result } = renderHook(() => ({ sources: useAcquisitionSources(), fields: useCrmCustomFields() }));
    await waitFor(() => expect(result.current.sources.queryError).not.toBeNull());
    await waitFor(() => expect(result.current.fields.error).not.toBeNull());
    expect(result.current.sources.queryError).toEqual({ status: 0, code: undefined });
    expect(result.current.fields.error).toEqual({ status: 0, code: undefined });
  });
});
