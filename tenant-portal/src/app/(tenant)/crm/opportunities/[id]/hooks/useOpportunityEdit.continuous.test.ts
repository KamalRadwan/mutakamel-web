// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import type { OpportunityDetail } from "../../opportunity-contract";
import { useOpportunityEdit } from "./useOpportunityEdit";
const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock("@/lib/api/axiosClient", async (original) => ({ ...(await original<typeof import("@/lib/api/axiosClient")>()), axiosClient: api }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
const item = {
  id: "01900100-0000-7000-8000-000000000001", branchId: "01900100-0000-7000-8000-000000000002", customerProfileId: "01900100-0000-7000-8000-000000000003",
  pipelineId: "01900100-0000-7000-8000-000000000004", stageId: "01900100-0000-7000-8000-000000000005", title: "Renew contract", status: "IN_PROGRESS", stageFlag: "NEW", importance: 2,
  amount: "1000.00", currencyCode: "EGP", expectedCloseDate: null, probabilityPercent: 50, description: null, ownerUserId: null,
  contactPartyId: "01900100-0000-7000-8000-000000000006", customerPartyId: null, leadId: null, cardColor: "BLUE",
  createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-02T00:00:00.000Z", wonAt: null, lostAt: null, lostReason: null,
} as OpportunityDetail;
function response(data: unknown) { return { data, status: 200, statusText: "OK", headers: new Headers() }; }
function refused(status: number) { return new TenantApiClientError("Refused", { status, statusText: "Refused", headers: new Headers(), data: {} }); }
beforeEach(() => { vi.clearAllMocks(); api.get.mockImplementation(async (path: string) => response(path.includes("custom-fields") ? [] : item)); api.patch.mockResolvedValue(response(item)); });
afterEach(cleanup);

describe("Direct saved opportunity editing", () => {
  it("hydrates the saved form as pristine and sends nothing until edited", async () => {
    const { result } = renderHook(() => useOpportunityEdit(item, vi.fn(), { continuous: true }));
    await waitFor(() => expect(result.current.form?.title).toBe(item.title));
    expect(result.current.isDirty).toBe(false);
    await act(async () => { await result.current.submit(); });
    expect(api.patch).not.toHaveBeenCalled();
    expect(result.current.form).not.toBeNull();
  });
  it("collects contact, owner, color and zero stars into one snapshot-protected ordinary update", async () => {
    const { result } = renderHook(() => useOpportunityEdit(item, vi.fn(), { continuous: true }));
    await waitFor(() => expect(result.current.form).not.toBeNull());
    act(() => { result.current.setField("importance", "0"); result.current.setField("contactPartyId", ""); result.current.setField("cardColor", null); result.current.setField("ownerUserId", "01900100-0000-7000-8000-000000000007"); });
    expect(api.patch).not.toHaveBeenCalled();
    await act(async () => { await result.current.submit(); });
    expect(api.patch.mock.calls[0]?.[1]).toEqual({ importance: 0, contactPartyId: null, cardColor: null, ownerUserId: "01900100-0000-7000-8000-000000000007", expectedUpdatedAt: item.updatedAt });
  });
  it("retains the original baseline and dirty draft after a concurrent refresh", async () => {
    const { result, rerender } = renderHook(({ current }) => useOpportunityEdit(current, vi.fn(), { continuous: true }), { initialProps: { current: item } });
    await waitFor(() => expect(result.current.form).not.toBeNull());
    act(() => result.current.setField("title", "My draft"));
    rerender({ current: { ...item, title: "Other editor", updatedAt: "2026-11-03T00:00:00.000Z" } });
    expect(result.current.form?.title).toBe("My draft");
    expect(result.current.form?.expectedUpdatedAt).toBe(item.updatedAt);
    expect(result.current.stale).toBe(true);
  });
  it("reads the known record after an uncertain PATCH and preserves the draft and lock when that read fails", async () => {
    api.patch.mockRejectedValueOnce(refused(503));
    const reconcile = vi.fn();
    const { result } = renderHook(() => useOpportunityEdit(item, reconcile, { continuous: true }));
    await waitFor(() => expect(result.current.form).not.toBeNull());
    act(() => result.current.setField("title", "My uncertain draft"));
    await act(async () => { await result.current.submit(); });
    expect(result.current.ambiguity).not.toBeNull();
    api.get.mockImplementation(async (path: string) => { if (!path.includes("custom-fields")) throw refused(503); return response([]); });
    await act(async () => { await result.current.ambiguity?.replay(); });
    expect(result.current.form?.title).toBe("My uncertain draft");
    expect(result.current.locked).toBe(true);
    expect(api.patch).toHaveBeenCalledOnce();
    api.get.mockImplementation(async (path: string) => response(path.includes("custom-fields") ? [] : { ...item, title: "Saved title", updatedAt: "2026-11-03T00:00:00.000Z" }));
    await act(async () => { await result.current.ambiguity?.replay(); });
    expect(result.current.ambiguity).toBeNull();
    expect(result.current.form?.title).toBe("My uncertain draft");
    expect(api.patch).toHaveBeenCalledOnce();
    expect(reconcile).toHaveBeenCalledOnce();
  });
  it("does not discard an editable draft before a requested latest-version read succeeds", async () => {
    const { result } = renderHook(() => useOpportunityEdit(item, vi.fn(), { continuous: true }));
    await waitFor(() => expect(result.current.form).not.toBeNull());
    act(() => result.current.setField("title", "Keep this draft"));
    api.get.mockImplementation(async (path: string) => { if (!path.includes("custom-fields")) throw refused(503); return response([]); });
    await act(async () => { await result.current.reconcile(); });
    expect(result.current.form?.title).toBe("Keep this draft");
    expect(result.current.isDirty).toBe(true);
  });
});
