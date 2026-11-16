// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError, axiosClient } from "@/lib/api/axiosClient";
import { useCrmSettings, type CrmSettings } from "./useCrmSettings";

const state = vi.hoisted(() => ({ actor: "actor", mutate: true, success: vi.fn(), permissions: ["crm.settings.read", "crm.settings.manage"] }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { id: state.actor, permissions: state.permissions } }) }));
vi.mock("@/hooks/useAccessMode", () => ({ useAccessMode: () => ({ canMutate: state.mutate }) }));
vi.mock("@/design-system", () => ({ useToast: () => ({ success: state.success, outcomeFromApi: vi.fn() }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
const loaded: CrmSettings = {
  id: "01900100-0000-7000-8000-000000000001", defaultPipelineId: "01900100-0000-7000-8000-000000000002",
  requireQualifiedStageForConversion: true, outboundEmailContentRetentionDays: 730, outboundEmailRetentionPolicyRevision: 1,
  asteriskIntegration: { enabled: false, allowInvalidTlsCertificate: false },
};
const response = (data: unknown) => ({ data, status: 200, statusText: "OK", headers: new Headers() });
beforeEach(() => {
  state.actor = "actor"; state.mutate = true; state.permissions = ["crm.settings.read", "crm.settings.manage"]; state.success.mockClear();
  vi.spyOn(axiosClient, "get").mockResolvedValue(response(loaded));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("CRM settings mutation safety", () => {
  it("hides previous actor values synchronously while the new scope is loading", async () => {
    const seen: (CrmSettings | null)[] = [];
    const { result, rerender } = renderHook(() => { const value = useCrmSettings(); seen.push(value.settings); return value; });
    await waitFor(() => expect(result.current.settings).not.toBeNull());
    act(() => result.current.setDraft({ requireQualifiedStageForConversion: false, outboundEmailContentRetentionDays: 365 }));
    const boundary = seen.length;
    state.actor = "different-actor";
    vi.mocked(axiosClient.get).mockImplementation(() => new Promise(() => {}));
    rerender();
    expect(result.current.settings).toBeNull(); expect(result.current.draft).toBeNull();
    expect(result.current.canManage).toBe(false); expect(result.current.isLoading).toBe(true);
    expect(seen.slice(boundary).every((value) => value === null)).toBe(true);
    await act(async () => {});
  });
  it("fences two same-tick saves until the first validated response settles", async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    const put = vi.spyOn(axiosClient, "put").mockImplementation(() => new Promise((done) => { resolve = done; }));
    const { result } = renderHook(() => useCrmSettings());
    await waitFor(() => expect(result.current.settings).not.toBeNull());
    act(() => result.current.setDraft({ ...loaded, requireQualifiedStageForConversion: false }));
    let first!: Promise<boolean>;
    await act(async () => { first = result.current.saveSettings(); expect(await result.current.saveSettings()).toBe(false); });
    expect(put).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(response({ ...loaded, requireQualifiedStageForConversion: false })); await first; });
    expect(state.success).toHaveBeenCalledTimes(1);
  });
  it("keeps all draft fields after a stale retention rejection and never retries automatically", async () => {
    const put = vi.spyOn(axiosClient, "put").mockRejectedValue(new TenantApiClientError("private", {
      status: 409, statusText: "Conflict", headers: new Headers(), data: { code: "CRM_OUTBOUND_EMAIL_RETENTION_POLICY_STALE" },
    }));
    const { result } = renderHook(() => useCrmSettings());
    await waitFor(() => expect(result.current.settings).not.toBeNull());
    const draft = { requireQualifiedStageForConversion: false, outboundEmailContentRetentionDays: 365,
      asteriskIntegration: { ...loaded.asteriskIntegration, enabled: true, realm: "sales" } };
    act(() => result.current.setDraft(draft));
    await act(async () => { await result.current.saveSettings(); });
    expect(result.current.draft).toEqual(draft);
    vi.mocked(axiosClient.get).mockResolvedValueOnce(response({ ...loaded, outboundEmailRetentionPolicyRevision: 2 }));
    await act(async () => { await result.current.reloadRetentionPolicy(); });
    expect(result.current.draft).toEqual(draft);
    expect(result.current.hasRetentionConflict).toBe(false);
    expect(put).toHaveBeenCalledTimes(1);
  });
  it("retains the draft and requires validated readback plus review after an unknown result", async () => {
    const put = vi.spyOn(axiosClient, "put").mockResolvedValue(response({ malformed: true }));
    const { result } = renderHook(() => useCrmSettings());
    await waitFor(() => expect(result.current.settings).not.toBeNull());
    const draft = { requireQualifiedStageForConversion: false, outboundEmailContentRetentionDays: 365 };
    act(() => result.current.setDraft(draft));
    await act(async () => { await result.current.saveSettings(); });
    expect(result.current.needsReview).toBe(true); expect(result.current.reviewReady).toBe(true);
    expect(result.current.draft).toEqual(draft); expect(state.success).not.toHaveBeenCalled();
    await act(async () => { expect(await result.current.saveSettings()).toBe(false); });
    expect(put).toHaveBeenCalledTimes(1);
    act(() => result.current.acknowledgeReview());
    expect(result.current.needsReview).toBe(false);
    expect(put).toHaveBeenCalledTimes(1);
  });
  it("blocks tenant read-only mode and obsolete update-only authority before a write", async () => {
    const put = vi.spyOn(axiosClient, "put");
    state.mutate = false;
    const { result, rerender } = renderHook(() => useCrmSettings());
    await waitFor(() => expect(result.current.settings).not.toBeNull());
    act(() => result.current.setDraft({ requireQualifiedStageForConversion: false, outboundEmailContentRetentionDays: 730 }));
    await act(async () => { expect(await result.current.saveSettings()).toBe(false); });
    state.mutate = true; state.permissions = ["crm.settings.read", "crm.settings.update"];
    rerender();
    await waitFor(() => expect(result.current.settings).not.toBeNull());
    expect(result.current.canManage).toBe(false); expect(put).not.toHaveBeenCalled();
  });
});
