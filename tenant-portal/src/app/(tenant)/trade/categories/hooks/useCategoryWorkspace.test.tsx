// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { parseCategoryDetail, parseCategoryTreePage } from "../category-contract";
import { useCategoryWorkspace } from "./useCategoryWorkspace";

const mock = vi.hoisted(() => ({ read: vi.fn(), tree: vi.fn(), list: vi.fn(), submit: vi.fn(),
  search: "", listeners: new Set<() => void>(), canWrite: true,
  toast: { success: vi.fn(), warning: vi.fn(), errorFromApi: vi.fn(), outcomeFromApi: vi.fn(() => false) },
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { isTenantOwner: true, permissions: ["trade.items.read", "trade.catalog_master.manage"] } }) }));
vi.mock("@/hooks/useAccessMode", () => ({ useAccessMode: () => ({ mode: null, canRead: true, canMutate: mock.canWrite }) }));
vi.mock("@/lib/api/errors", () => ({ normalizeApiError: (value: unknown) => value instanceof Error ? { status: 0, message: value.message } : value }));
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  return { useSearchParams: () => new URLSearchParams(useSyncExternalStore((listener) => {
    mock.listeners.add(listener); return () => mock.listeners.delete(listener);
  }, () => mock.search)) };
});
vi.mock("@/design-system", async (original) => ({
  ...await original<typeof import("@/design-system")>(), useToast: () => mock.toast,
  useConnectivity: () => ({ status: "online" }), useRealtimeResync: vi.fn(),
  replaceSearchParams: (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(mock.search);
    for (const [key, value] of Object.entries(updates)) { if (value === null) params.delete(key); else params.set(key, value); }
    mock.search = params.toString(); for (const listener of mock.listeners) listener();
  },
}));
vi.mock("../category-api", async (original) => ({
  ...await original<typeof import("../category-api")>(), readCategory: mock.read,
  readCategoryTree: mock.tree, readCategories: mock.list, submitCategory: mock.submit,
}));
const id = "019f0000-0000-7000-8000-000000000001";
const now = "2026-09-27T10:00:00.000Z";
const node = parseCategoryDetail({ id, code: "ROOT", name: "Root", displayName: "Root", parentId: null,
  status: "ACTIVE", effectiveActive: true, inactiveAncestorId: null, sortOrder: 1024, depth: 1, version: 2,
  treeVersion: 4, path: [{ id, code: "ROOT", name: "Root", siblingPosition: 1, siblingTotal: 1 }],
  hasChildren: false, childCount: 0, localizedNames: { en: "Root" }, subtreeHeight: 1, createdAt: now, updatedAt: now,
  usage: { directItemCount: 0, subtreeItemCount: 0, descendantCount: 0, hasRetainedItemReferences: false,
    canDelete: false, deleteBlockers: ["ACTIVE"], asOf: now } });
const page = parseCategoryTreePage({ items: [node], parentId: null, page: 1, limit: 50, total: 1, treeVersion: 4, asOf: now });
beforeEach(() => {
  vi.clearAllMocks(); mock.search = ""; mock.listeners.clear(); mock.canWrite = true;
  mock.read.mockReset().mockResolvedValue(node); mock.tree.mockReset().mockResolvedValue(page);
  mock.list.mockReset().mockResolvedValue(page);
  mock.submit.mockReset().mockResolvedValue({ receipt: { id, version: 3, treeVersion: 5, changed: true }, replayed: false });
});
afterEach(cleanup);

describe("Category workspace save/read boundary", () => {
  it("returns focus to the page heading when deleting the final root removes the action trigger", async () => {
    const heading = document.createElement("h1"); heading.tabIndex = -1; document.body.append(heading);
    try {
      const { result } = renderHook(() => useCategoryWorkspace(id));
      result.current.headingRef.current = heading;
      await waitFor(() => expect(result.current.detail.data?.id).toBe(id));
      act(() => result.current.openEditor("delete"));
      mock.submit.mockResolvedValueOnce({ receipt: { id, version: 3, treeVersion: 5, deleted: true }, replayed: false });
      mock.tree.mockResolvedValueOnce({ ...page, items: [], total: 0, treeVersion: 5 });
      await act(async () => { await result.current.submit({ action: "delete", id, version: 2, body: { expectedTreeVersion: 4, reason: "Remove unused category" } }); });
      expect(result.current.editor).toBeNull();
      expect(result.current.tree.nodes).toEqual([]);
      expect(document.activeElement).toBe(heading);
    } finally { heading.remove(); }
  });
  it("keeps a confirmed save and retries only reads when detail refresh fails", async () => {
    const { result } = renderHook(() => useCategoryWorkspace(id));
    await waitFor(() => expect(result.current.detail.data?.id).toBe(id));
    act(() => result.current.openEditor("update"));
    mock.read.mockRejectedValueOnce(new Error("Refresh disconnected"));
    await act(async () => { await result.current.submit({ action: "update", id, version: 2, body: { displayName: "New name" } }); });
    expect(result.current.command.kind).toBe("saved");
    expect(result.current.savedRefreshFailed).toBe(true);
    expect(result.current.editor).toBeNull();
    await act(async () => { await result.current.reload(); });
    expect(mock.submit).toHaveBeenCalledTimes(1);
    expect(result.current.savedRefreshFailed).toBe(false);
  });
  it("keeps the editor open after unknown outcomes and recovers using the captured key", async () => {
    mock.submit.mockRejectedValueOnce(new Error("No acknowledgement"));
    const { result } = renderHook(() => useCategoryWorkspace(id));
    await waitFor(() => expect(result.current.detail.data?.id).toBe(id));
    act(() => result.current.openEditor("update"));
    await act(async () => { await result.current.submit({ action: "update", id, version: 2, body: { displayName: "Name" } }); });
    act(() => result.current.closeEditor());
    expect(result.current.editor?.action).toBe("update");
    expect(result.current.uncertain).toBe(true);
    await act(async () => { await result.current.retry(); });
    expect(mock.submit.mock.calls[0][0]).toBe(mock.submit.mock.calls[1][0]);
    expect(result.current.editor).toBeNull();
  });
  it("requires explicit review before replacing stale command preconditions", async () => {
    mock.submit.mockRejectedValueOnce({ status: 409, code: "TRADE.CONCURRENCY.STALE_VERSION" });
    const { result } = renderHook(() => useCategoryWorkspace(id));
    await waitFor(() => expect(result.current.detail.data?.id).toBe(id));
    act(() => result.current.openEditor("update"));
    mock.read.mockResolvedValue({ ...node, version: 3, treeVersion: 5, name: "Changed by another actor" });
    await act(async () => { await result.current.submit({ action: "update", id, version: 2, body: { displayName: "Name" } }); });
    await waitFor(() => expect(result.current.conflictCurrent?.version).toBe(3));
    expect(result.current.editor?.source?.version).toBe(2);
    await act(async () => { await result.current.reviewConflict(); });
    expect(result.current.editor?.source?.version).toBe(3);
    expect(result.current.conflict).toBe(false);
    expect(mock.submit).toHaveBeenCalledTimes(1);
  });
  it("rechecks current write access when an old recovery toast action is clicked", async () => {
    mock.submit.mockRejectedValueOnce(new Error("No acknowledgement"));
    const { result, rerender } = renderHook(() => useCategoryWorkspace(id));
    await waitFor(() => expect(result.current.detail.data?.id).toBe(id));
    act(() => result.current.openEditor("update"));
    await act(async () => { await result.current.submit({ action: "update", id, version: 2, body: { displayName: "Name" } }); });
    const action = mock.toast.warning.mock.calls.at(-1)?.[3] as { onClick: () => void };
    expect(action).toBeDefined();
    mock.canWrite = false; rerender();
    await act(async () => action.onClick());
    expect(mock.submit).toHaveBeenCalledTimes(1);
    mock.canWrite = true; rerender();
    await act(async () => action.onClick());
    await waitFor(() => expect(result.current.editor).toBeNull());
    await act(async () => action.onClick());
    expect(mock.submit).toHaveBeenCalledTimes(2);
  });

  it("clears flat-list filters when switching back to the tree", async () => {
    mock.search = "view=list&status=INACTIVE&search=name&page=2";
    const { result } = renderHook(() => useCategoryWorkspace());
    act(() => result.current.setMode("tree"));
    expect(new URLSearchParams(mock.search).get("view")).toBe("tree");
    for (const key of ["status", "search", "page"]) expect(new URLSearchParams(mock.search).has(key)).toBe(false);
  });
  it("allows browsing but refuses mutation in read-only mode", async () => {
    mock.canWrite = false;
    const { result } = renderHook(() => useCategoryWorkspace(id));
    await waitFor(() => expect(result.current.detail.data?.id).toBe(id));
    act(() => result.current.openEditor("update"));
    expect(result.current.editor).toBeNull();
    await act(async () => { await result.current.submit({ action: "update", id, version: 2, body: { displayName: "Name" } }); });
    expect(mock.submit).not.toHaveBeenCalled();
  });
});
