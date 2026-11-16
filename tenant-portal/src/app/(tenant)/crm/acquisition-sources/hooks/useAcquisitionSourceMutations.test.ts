// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { useAcquisitionSourceMutations } from "./useAcquisitionSourceMutations";

const { post, remove, success } = vi.hoisted(() => ({ post: vi.fn(), remove: vi.fn(), success: vi.fn() }));
vi.mock("@/lib/api/axiosClient", async (original) => ({
  ...await original<typeof import("@/lib/api/axiosClient")>(), axiosClient: { post, delete: remove },
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));
vi.mock("@/design-system", async (original) => ({
  ...await original<typeof import("@/design-system")>(), useToast: () => ({ success }),
}));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const source = {
  id: "01902001-3000-7000-8000-000000000001", nameAr: "الموقع", nameEn: "Website", isActive: true,
  sortOrder: 1, createdAt: "2026-08-25T10:00:00.000Z", updatedAt: "2026-08-25T10:00:00.000Z", iconUrl: null,
};
const failure = (status: number, code?: string) => new TenantApiClientError("backend prose", {
  status, statusText: "Failure", headers: new Headers(), data: { code, message: "backend prose" },
});
function setup(allowed = true, count = 1) {
  const reload = vi.fn().mockResolvedValue(true);
  const created = vi.fn();
  const deleted = vi.fn();
  const hook = renderHook(() => useAcquisitionSourceMutations(allowed, count, reload, created, deleted));
  return { ...hook, reload, created, deleted };
}

describe("source mutations", () => {
  it("fences repeated creation and sends only canonical trimmed non-replayable names", async () => {
    let resolve!: (value: { data: typeof source }) => void;
    post.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const { result, created } = setup();
    let first!: Promise<boolean>;
    act(() => { first = result.current.handleCreate({ nameAr: " الموقع ", nameEn: " Website " }); });
    await act(async () => { expect(await result.current.handleCreate(source)).toBe(false); });
    expect(post).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledWith("/api/tenant/crm/v1/acquisition-sources", { nameAr: "الموقع", nameEn: "Website" },
      expect.objectContaining({ nonReplayable: true, skipAutoIdempotency: true }));
    await act(async () => { resolve({ data: source }); await first; });
    expect(created).toHaveBeenCalledWith(source);
    expect(success).toHaveBeenCalledWith(en.crmAcquisitionSources.created);
  });

  it("keeps duplicate-name creation open with localized recovery", async () => {
    post.mockRejectedValue(failure(409, "CRM_ACQUISITION_SOURCE_NAME_TAKEN"));
    const { result, reload } = setup();
    act(() => result.current.openCreate());
    await act(async () => { await result.current.handleCreate(source); });
    expect(result.current.isCreateOpen).toBe(true);
    expect(result.current.mutationError).toBe(en.crmAcquisitionSources.duplicateName);
    expect(reload).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });

  it.each([false, true])("refuses unauthorized or full catalogue creation (allowed=%s)", async (allowed) => {
    const { result } = setup(allowed, allowed ? 500 : 1);
    await act(async () => { await result.current.handleCreate(source); });
    expect(post).not.toHaveBeenCalled();
    expect(result.current.mutationError).toBe(allowed ? en.crmAcquisitionSources.limitReached : en.crmAcquisitionSources.iconForbidden);
  });

  it("turns an in-use deletion into a guard and never repeats that deletion", async () => {
    remove.mockRejectedValue(failure(409, "CRM_ACQUISITION_SOURCE_IN_USE"));
    const { result, deleted } = setup();
    act(() => result.current.selectForDelete(source));
    await act(async () => { await result.current.handleDelete(); });
    expect(result.current.deleteBlocked).toBe(true);
    expect(result.current.mutationError).toBe(en.crmAcquisitionSources.deleteInUse);
    await act(async () => { await result.current.handleDelete(); });
    expect(remove).toHaveBeenCalledOnce();
    expect(deleted).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });

  it.each(["create", "delete"] as const)("reloads an unknown %s outcome without replay or success", async (operation) => {
    post.mockRejectedValue(failure(0));
    remove.mockRejectedValue(failure(0));
    const { result, reload, created, deleted } = setup();
    act(() => { result.current.openCreate(); result.current.selectForDelete(source); });
    await act(async () => {
      if (operation === "create") await result.current.handleCreate(source);
      else await result.current.handleDelete();
    });
    expect(operation === "create" ? post : remove).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
    expect(result.current.mutationError).toBe(operation === "create" ? en.crmAcquisitionSources.createUncertain : en.crmAcquisitionSources.deleteUncertain);
    expect(result.current.selectedForDelete).toBeNull();
    expect(result.current.isCreateOpen).toBe(false);
    expect(created).not.toHaveBeenCalled();
    expect(deleted).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });

  it("refreshes and closes a deleted target instead of retaining an impossible retry", async () => {
    remove.mockRejectedValue(failure(404, "CRM_ACQUISITION_SOURCE_NOT_FOUND"));
    const { result, reload } = setup();
    act(() => result.current.selectForDelete(source));
    await act(async () => { await result.current.handleDelete(); });
    expect(reload).toHaveBeenCalledOnce();
    expect(result.current.selectedForDelete).toBeNull();
    expect(result.current.mutationError).toBe(en.crmAcquisitionSources.missingSource);
  });
});
