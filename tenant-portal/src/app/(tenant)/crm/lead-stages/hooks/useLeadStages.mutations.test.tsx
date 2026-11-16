// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { LeadStageItem } from "../lead-stage-contract";

const { api, auth, success, ApiError } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  auth: { user: { permissions: ["crm.lead_stages.read", "crm.lead_stages.manage"], accessMode: "FULL" } },
  success: vi.fn(),
  ApiError: class extends Error {
    response: { status: number; data: { code: string } };
    constructor(status: number, code: string) { super(code); this.response = { status, data: { code } }; }
  },
}));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: api, TenantApiClientError: ApiError }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/design-system", async (original) => ({
  ...await original<Record<string, unknown>>(), useToast: () => ({ success }),
}));

import { I18nProvider } from "@/i18n/I18nContext";
import { useLeadStages } from "./useLeadStages";

const NEW: LeadStageItem = { id: "01900100-0000-7000-8000-000000000001", nameAr: "جديد", nameEn: "New", flag: "NEW", category: "IN_PROGRESS", sortOrder: 1, isDefault: true, isActive: true };
const CUSTOM: LeadStageItem = { ...NEW, id: "01900100-0000-7000-8000-000000000002", nameAr: "تم التواصل", nameEn: "Contacted", flag: "CONTACTED", sortOrder: 2, isDefault: false };
const DISQUALIFIED: LeadStageItem = { ...CUSTOM, id: "01900100-0000-7000-8000-000000000003", flag: "DISQUALIFIED", category: "NEGATIVE", sortOrder: 3 };
const CONVERTED: LeadStageItem = { ...CUSTOM, id: "01900100-0000-7000-8000-000000000004", flag: "CONVERTED", category: "POSITIVE", sortOrder: 4 };
const CATALOGUE = [NEW, CUSTOM, DISQUALIFIED, CONVERTED];
const CREATE = { nameAr: "متابعة", nameEn: "Follow up", flag: "NURTURING" as const, category: "IN_PROGRESS" as const, isDefault: false };
const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>;
async function loaded() {
  const view = renderHook(() => useLeadStages(), { wrapper });
  await waitFor(() => expect(view.result.current.isLoading).toBe(false));
  return view;
}
beforeEach(() => {
  vi.clearAllMocks();
  auth.user.accessMode = "FULL";
  window.localStorage.setItem("tenant_lang", "en");
  api.get.mockResolvedValue({ data: CATALOGUE });
});
afterEach(cleanup);

describe("Lead-stage writes and reconciliation", () => {
  it("rereads the complete order after creation shifts the protected terminal ranks", async () => {
    const created = { ...CUSTOM, ...CREATE, id: "01900100-0000-7000-8000-000000000005", sortOrder: 3 };
    api.post.mockResolvedValue({ data: created });
    const { result } = await loaded();
    api.get.mockResolvedValue({ data: [NEW, CUSTOM, created, { ...DISQUALIFIED, sortOrder: 4 }, { ...CONVERTED, sortOrder: 5 }] });
    await act(() => result.current.handleCreate(CREATE));
    expect(result.current.items.map((stage) => stage.sortOrder)).toEqual([1, 2, 3, 4, 5]);
    expect(result.current.items.at(-1)?.flag).toBe("CONVERTED");
    expect(success).toHaveBeenCalledWith(en.crmLeadStages.stageCreated);
    expect(api.post.mock.calls[0][2]).toMatchObject({ nonReplayable: true, skipAutoIdempotency: true });
  });

  it("blocks further writes after an uncertain create until a successful explicit reload", async () => {
    const { result } = await loaded();
    api.post.mockRejectedValue(new Error("connection lost after send"));
    api.get.mockRejectedValue(new Error("offline"));
    await act(() => result.current.handleCreate(CREATE));
    expect(result.current.needsReload).toBe(true);
    expect(result.current.error).toBe(en.crmLeadStages.createAmbiguousStale);
    await act(() => result.current.handleCreate(CREATE));
    await act(() => result.current.handleSetDefault(CUSTOM));
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(success).not.toHaveBeenCalled();
    api.get.mockResolvedValue({ data: CATALOGUE });
    await act(() => result.current.fetchStages());
    expect(result.current.needsReload).toBe(false);
    expect(result.current.writesBlocked).toBe(false);
  });

  it("prevents duplicate and competing writes before pending state commits", async () => {
    let finish!: (response: unknown) => void;
    api.post.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { result } = await loaded();
    await act(async () => {
      const first = result.current.handleSetDefault(CUSTOM);
      const second = result.current.handleSetDefault(CUSTOM);
      const create = result.current.handleCreate(CREATE);
      expect(api.post).toHaveBeenCalledTimes(1);
      finish({ data: { ...CUSTOM, isDefault: true } });
      await Promise.all([first, second, create]);
    });
    expect(result.current.items.filter((stage) => stage.isDefault).map((stage) => stage.id)).toEqual([CUSTOM.id]);
    expect(success).toHaveBeenCalledTimes(1);
  });

  it("treats a response for another stage as an unknown default change, never successful", async () => {
    api.post.mockResolvedValue({ data: NEW });
    const { result } = await loaded();
    await act(() => result.current.handleSetDefault(CUSTOM));
    expect(result.current.error).toBe(en.crmLeadStages.defaultAmbiguousReloaded);
    expect(result.current.items.find((stage) => stage.isDefault)?.id).toBe(NEW.id);
    expect(success).not.toHaveBeenCalled();
  });

  it("shows the exact in-use deletion blocker and reconciles without removing the row", async () => {
    api.delete.mockRejectedValue(new ApiError(409, "LEAD_STAGE_IN_USE"));
    const { result } = await loaded();
    act(() => result.current.openDelete(CUSTOM));
    await act(() => result.current.handleDelete());
    expect(result.current.deleteBlocked).toBe(true);
    expect(result.current.deleteError).toBe(en.crmLeadStages.errors.LEAD_STAGE_IN_USE);
    expect(result.current.items.some((stage) => stage.id === CUSTOM.id)).toBe(true);
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(success).not.toHaveBeenCalled();
  });

  it("rejects programmatic writes as well as controls in read-only access mode", async () => {
    auth.user.accessMode = "READ_ONLY";
    const { result } = await loaded();
    act(() => { result.current.openCreate(); result.current.openEdit(CUSTOM); result.current.openDelete(CUSTOM); });
    await act(() => result.current.handleCreate(CREATE));
    await act(() => result.current.handleSetDefault(CUSTOM));
    expect(result.current.isCreateOpen).toBe(false);
    expect(result.current.selectedForEdit).toBeNull();
    expect(result.current.selectedForDelete).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
    expect(api.patch).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("closes a stale delete confirmation when another user already removed the stage", async () => {
    api.delete.mockRejectedValue(new ApiError(404, "LEAD_STAGE_NOT_FOUND"));
    const { result } = await loaded();
    act(() => result.current.openDelete(CUSTOM));
    api.get.mockResolvedValue({ data: [NEW, { ...DISQUALIFIED, sortOrder: 2 }, { ...CONVERTED, sortOrder: 3 }] });
    await act(() => result.current.handleDelete());
    expect(result.current.selectedForDelete).toBeNull();
    expect(result.current.error).toBe(en.crmLeadStages.errors.LEAD_STAGE_NOT_FOUND);
    expect(success).not.toHaveBeenCalled();
  });
});
