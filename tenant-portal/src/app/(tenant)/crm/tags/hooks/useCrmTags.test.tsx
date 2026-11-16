// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";

const { api, auth, toast } = vi.hoisted(() => ({
  api: { get: vi.fn(), delete: vi.fn() },
  auth: { user: { permissions: ["crm.tags.read", "crm.tags.manage"], accessMode: "FULL" } },
  toast: { success: vi.fn() },
}));
vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: api,
  TenantApiClientError: class extends Error {
    constructor(message: string, public response: { status: number; data: Record<string, unknown> }) { super(message); }
  },
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));
vi.mock("@/design-system", async (original) => ({
  ...await original<typeof import("@/design-system")>(), useToast: () => toast,
}));

import { TenantApiClientError } from "@/lib/api/axiosClient";
import { useCrmTags } from "./useCrmTags";

const TAG = {
  id: "01900100-0000-7000-8000-000000000001", name: "VIP",
  backgroundColor: null, textColor: null,
  createdAt: "2026-11-03T10:00:00Z", updatedAt: "2026-11-03T10:00:00Z",
};
function failure(code: string, details?: unknown) {
  return new TenantApiClientError("API error", { status: 422, statusText: "Unprocessable Entity", headers: new Headers(), data: { errorCode: code, details } });
}
async function loaded() {
  const view = renderHook(useCrmTags);
  await waitFor(() => expect(view.result.current.hasLoaded).toBe(true));
  return view;
}
beforeEach(() => {
  vi.clearAllMocks();
  auth.user.permissions = ["crm.tags.read", "crm.tags.manage"];
  auth.user.accessMode = "FULL";
  api.get.mockResolvedValue({ data: [TAG] });
});
afterEach(cleanup);

describe("Tags catalogue writes", () => {
  it("uses the real tenant-wide list with local search, without fabricated paging", async () => {
    const { result } = await loaded();
    expect(api.get).toHaveBeenCalledWith("/api/tenant/crm/v1/tags", expect.objectContaining({ cache: "no-store" }));
    act(() => result.current.setSearchQuery("  vi  "));
    expect(result.current.items).toEqual([TAG]);
    act(() => result.current.setSearchQuery("premium"));
    expect(result.current.items).toEqual([]);
    expect(result.current.isFiltered).toBe(true);
    expect(result.current.allItems).toHaveLength(1);
  });

  it("blocks creation at 500 while allowing edits of existing tags", async () => {
    api.get.mockResolvedValue({ data: Array.from({ length: 500 }, (_, i) => ({
      ...TAG, id: `01900100-0000-7000-8000-${String(i).padStart(12, "0")}`, name: `Tag ${i}`,
    })) });
    const { result } = await loaded();
    expect(result.current.atCapacity).toBe(true);
    act(() => result.current.openCreate());
    expect(result.current.formTarget).toBeNull();
    act(() => result.current.openEdit(TAG));
    expect(result.current.formTarget?.mode).toBe("edit");
  });

  it("prevents readers from invoking catalogue mutations", async () => {
    auth.user.permissions = ["crm.tags.read"];
    const { result } = await loaded();
    act(() => { result.current.openCreate(); result.current.openEdit(TAG); result.current.selectForDelete(TAG); });
    await act(() => result.current.handleDelete());
    expect(result.current.formTarget).toBeNull();
    expect(result.current.deleteTarget).toBeNull();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("honors a resolved read-only tenant even when the user has manage permission", async () => {
    auth.user.accessMode = "READ_ONLY";
    const { result } = await loaded();
    expect(result.current.canManage).toBe(false);
    act(() => result.current.openCreate());
    expect(result.current.formTarget).toBeNull();
  });

  it("sends one nonreplayable delete even before React commits pending state", async () => {
    let finish!: () => void;
    api.delete.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    const { result } = await loaded();
    act(() => result.current.selectForDelete(TAG));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.handleDelete();
      void result.current.handleDelete();
      result.current.closeDelete();
      result.current.reload();
    });
    expect(api.delete).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(result.current.deleteTarget).toEqual(TAG);
    await act(async () => { finish(); await pending; });
    expect(api.delete).toHaveBeenCalledWith(`/api/tenant/crm/v1/tags/${TAG.id}`,
      expect.objectContaining({ nonReplayable: true, skipAutoIdempotency: true }));
    expect(result.current.allItems).toEqual([]);
    expect(toast.success).toHaveBeenCalledWith(en.crmTags.deleted);
  });

  it.each([127, undefined])("shows the real detach-limit guard, count only when returned (%s)", async (count) => {
    api.delete.mockRejectedValue(failure("CRM_TAG_DETACH_LIMIT_EXCEEDED", count === undefined ? undefined : { count }));
    const { result } = await loaded();
    act(() => result.current.selectForDelete(TAG));
    await act(() => result.current.handleDelete());
    expect(result.current.deleteBlocked).toBe(true);
    expect(result.current.deleteError).toBe(en.crmTags.errors.detachLimit);
    expect(result.current.deleteLeadCount).toBe(count === undefined ? undefined : "127");
    await act(() => result.current.handleDelete());
    expect(api.delete).toHaveBeenCalledTimes(1);
    expect(result.current.allItems).toEqual([TAG]);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("fences all new writes until an uncertain delete is reread, and keeps the fence after failed reconciliation", async () => {
    api.delete.mockRejectedValue(new Error("connection lost"));
    const { result } = await loaded();
    let rejectRead!: (reason: Error) => void;
    api.get.mockReturnValueOnce(new Promise((_, reject) => { rejectRead = reject; }));
    act(() => result.current.selectForDelete(TAG));
    let pending!: Promise<void>;
    act(() => { pending = result.current.handleDelete(); });
    await waitFor(() => expect(result.current.needsReload).toBe(true));
    act(() => { result.current.openCreate(); result.current.openEdit(TAG); });
    expect(result.current.formTarget).toBeNull();
    await act(async () => { rejectRead(new Error("read unavailable")); await pending; });
    expect(result.current.needsReload).toBe(true);
    expect(result.current.writesBlocked).toBe(true);
    expect(result.current.notice).toBe(en.crmTags.errors.uncertainReloadFailed);
    expect(toast.success).not.toHaveBeenCalled();
    api.get.mockResolvedValueOnce({ data: [] });
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.writesBlocked).toBe(false));
    act(() => result.current.openCreate());
    expect(result.current.formTarget?.mode).toBe("create");
  });

  it("ignores a refresh response superseded by a newer refresh", async () => {
    const { result } = await loaded();
    let oldRead!: (data: unknown) => void;
    api.get.mockReturnValueOnce(new Promise((resolve) => { oldRead = resolve; }));
    api.get.mockResolvedValueOnce({ data: [] });
    act(() => { result.current.reload(); result.current.reload(); });
    await waitFor(() => expect(result.current.allItems).toEqual([]));
    await act(async () => oldRead({ data: [TAG] }));
    expect(result.current.allItems).toEqual([]);
  });
});
