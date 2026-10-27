// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError, axiosClient } from "@/lib/api/axiosClient";
import { en } from "@/i18n/dictionaries/en";
import { useCrmSettings, type CrmSettings } from "./useCrmSettings";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { permissions: ["crm.settings.read", "crm.settings.manage"] } }),
}));

const loaded: CrmSettings = {
  id: "01900100-0000-7000-8000-000000000001",
  requireQualifiedStageForConversion: true,
  defaultLeadStageId: null,
  defaultPipelineId: "01900100-0000-7000-8000-000000000002",
  outboundEmailContentRetentionDays: 730,
  outboundEmailRetentionPolicyRevision: 4,
  asteriskIntegration: { enabled: false, allowInvalidTlsCertificate: false },
};
const draft = {
  requireQualifiedStageForConversion: false,
  outboundEmailContentRetentionDays: 1000,
};

function response(data: CrmSettings) {
  return { data, status: 200, statusText: "OK", headers: new Headers() };
}

function stalePolicy() {
  return new TenantApiClientError("Policy changed", {
    status: 409, statusText: "Conflict", headers: new Headers(),
    data: { code: "CRM_OUTBOUND_EMAIL_RETENTION_POLICY_STALE" },
  });
}

beforeEach(() => {
  vi.spyOn(axiosClient, "get").mockResolvedValue(response(loaded));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CRM retention saves", () => {
  it("sends the loaded revision and accepts the confirmed response", async () => {
    const saved = { ...loaded, ...draft, outboundEmailRetentionPolicyRevision: 5 };
    const put = vi.spyOn(axiosClient, "put").mockResolvedValue(response(saved));
    const { result } = renderHook(() => useCrmSettings());
    await waitFor(() => expect(result.current.settings).toEqual(loaded));
    act(() => result.current.setDraft(draft));

    await act(async () => { expect(await result.current.saveSettings()).toBe(true); });
    expect(put).toHaveBeenCalledWith("/api/tenant/crm/v1/settings", {
      ...draft, expectedOutboundEmailRetentionPolicyRevision: 4,
    }, expect.objectContaining({ nonReplayable: true, skipAutoIdempotency: true }));
    expect(result.current.settings).toEqual(saved);
    expect(result.current.isDirty).toBe(false);
  });

  it("omits the token when saving only qualification", async () => {
    const put = vi.spyOn(axiosClient, "put").mockResolvedValue(response({
      ...loaded, requireQualifiedStageForConversion: false,
    }));
    const { result } = renderHook(() => useCrmSettings());
    await waitFor(() => expect(result.current.settings).toEqual(loaded));
    act(() => result.current.setDraft({ ...draft, outboundEmailContentRetentionDays: 730 }));

    await act(async () => { await result.current.saveSettings(); });
    expect(put).toHaveBeenCalledWith("/api/tenant/crm/v1/settings", {
      requireQualifiedStageForConversion: false,
    }, expect.any(Object));
  });

  it("keeps the draft after 409, reloads the revision and waits for an explicit save", async () => {
    const put = vi.spyOn(axiosClient, "put").mockRejectedValueOnce(stalePolicy());
    const { result } = renderHook(() => useCrmSettings());
    await waitFor(() => expect(result.current.settings).toEqual(loaded));
    act(() => result.current.setDraft(draft));

    await act(async () => { expect(await result.current.saveSettings()).toBe(false); });
    expect(result.current.hasRetentionConflict).toBe(true);
    expect(result.current.draft).toEqual(draft);
    expect(axiosClient.get).toHaveBeenCalledTimes(1);
    await act(async () => { expect(await result.current.saveSettings()).toBe(false); });
    expect(put).toHaveBeenCalledTimes(1);

    const latest = { ...loaded, outboundEmailContentRetentionDays: 900, outboundEmailRetentionPolicyRevision: 5 };
    vi.mocked(axiosClient.get).mockResolvedValueOnce(response(latest));
    await act(async () => { await result.current.reloadRetentionPolicy(); });
    expect(result.current.settings).toEqual(latest);
    expect(result.current.draft).toEqual(draft);
    expect(result.current.hasRetentionConflict).toBe(false);
    expect(result.current.isDirty).toBe(true);
    expect(put).toHaveBeenCalledTimes(1);

    put.mockResolvedValueOnce(response({ ...latest, ...draft, outboundEmailRetentionPolicyRevision: 6 }));
    await act(async () => { expect(await result.current.saveSettings()).toBe(true); });
    expect(put).toHaveBeenLastCalledWith("/api/tenant/crm/v1/settings", {
      ...draft, expectedOutboundEmailRetentionPolicyRevision: 5,
    }, expect.any(Object));
    expect(result.current.isDirty).toBe(false);
  });

  it("keeps the draft and conflict recoverable when policy reload fails", async () => {
    const put = vi.spyOn(axiosClient, "put").mockRejectedValueOnce(stalePolicy());
    const { result } = renderHook(() => useCrmSettings());
    await waitFor(() => expect(result.current.settings).toEqual(loaded));
    act(() => result.current.setDraft(draft));
    await act(async () => { await result.current.saveSettings(); });

    vi.mocked(axiosClient.get).mockRejectedValueOnce(new Error("Reload failed"));
    await act(async () => { await result.current.reloadRetentionPolicy(); });
    expect(result.current.draft).toEqual(draft);
    expect(result.current.settings).toEqual(loaded);
    expect(result.current.hasRetentionConflict).toBe(true);
    expect(result.current.error).toBe(en.crmSettings.loadFailed);
    expect(result.current.isLoading).toBe(false);
    expect(put).toHaveBeenCalledTimes(1);

    await act(async () => { await result.current.reloadRetentionPolicy(); });
    expect(result.current.draft).toEqual(draft);
    expect(result.current.hasRetentionConflict).toBe(false);
  });
});
