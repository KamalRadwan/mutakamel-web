// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseCategoryOptions, type CategoryIntent } from "../category-contract";
import { useCategoryPicker } from "./useCategoryPicker";
const { read, scope } = vi.hoisted(() => ({ read: vi.fn(), scope: vi.fn() }));
vi.mock("../category-api", () => ({ readCategoryOptions: read }));
vi.mock("../../useTradeScope", () => ({ useTradeScopeRequest: scope }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: "en" }) }));
const id = "019f0000-0000-7000-8000-000000000001";
const option = { id, code: "ROOT", name: "Root", path: [{ id, code: "ROOT", name: "Root" }], depth: 1 };
const page = () => parseCategoryOptions({ items: [option], page: 1, limit: 50, total: 1, treeVersion: 1, asOf: "2026-09-27T10:00:00.000Z" });
const noIntent: CategoryIntent = { kind: "unresolved" };
beforeEach(() => { read.mockReset(); scope.mockReset(); scope.mockReturnValue({ headers: {} }); read.mockResolvedValue(page()); });
afterEach(cleanup);

describe("Category picker request state", () => {
  it("keeps an unavailable request distinct from an explicit no-category choice", async () => {
    read.mockRejectedValue(new Error("Disconnected"));
    const { result } = renderHook(() => useCategoryPicker(noIntent, true, "TENANT"));
    await waitFor(() => expect(result.current.error?.status).toBe(0));
    expect(result.current.items).toEqual([]);
    expect(noIntent).toEqual({ kind: "unresolved" });
  });
  it("retains the current inactive assignment while choices are unavailable", async () => {
    read.mockRejectedValue(new Error("Disconnected"));
    const summary = { ...option, effectiveActive: false, treeVersion: 1 };
    const { result } = renderHook(() => useCategoryPicker({ kind: "selected", id }, true, "TENANT", summary));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.selected).toBe(summary);
  });
  it("ignores a late search response after the next query finishes", async () => {
    let complete!: (value: ReturnType<typeof page>) => void;
    const { result } = renderHook(() => useCategoryPicker(noIntent, true, "TENANT"));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    read.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    let old!: Promise<void>;
    act(() => { old = result.current.search("old"); });
    read.mockResolvedValueOnce({ ...page(), items: [], total: 0 });
    await act(async () => { await result.current.search("new"); });
    await act(async () => { complete(page()); await old; });
    expect(result.current.items).toEqual([]);
    expect(result.current.total).toBe(0);
  });
  it("does not fetch for a closed form and uses the explicit scope contract when opened", async () => {
    const { rerender } = renderHook(({ enabled }) => useCategoryPicker(noIntent, enabled, "OPERATING_CONTEXT"), { initialProps: { enabled: false } });
    await act(async () => {});
    expect(read).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    expect(scope).toHaveBeenCalledWith("OPERATING_CONTEXT");
  });
});
