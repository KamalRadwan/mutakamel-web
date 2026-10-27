// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { useAuditLedger } from "./useAuditLedger";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), user: { id: "reader", permissions: ["audit.read"] } }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: mocks.user }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/design-system", () => ({ useRealtimeResync: vi.fn() }));
vi.mock("@/lib/audit/audit-contract", () => ({ fetchAuditLedger: mocks.fetch }));

beforeEach(() => { mocks.fetch.mockReset(); mocks.user.permissions = ["audit.read"]; });
afterEach(cleanup);

describe("cursor ledger state", () => {
  it("resets the cursor on filters and Deleted records, and supports previous", async () => {
    mocks.fetch.mockResolvedValue({ items: [], nextCursor: "next" });
    const { result } = renderHook(useAuditLedger);
    await waitFor(() => expect(result.current.hasNext).toBe(true));
    act(() => result.current.next());
    await waitFor(() => expect(mocks.fetch).toHaveBeenLastCalledWith("next", {}, false, expect.any(AbortSignal)));
    act(() => result.current.previous());
    await waitFor(() => expect(mocks.fetch).toHaveBeenLastCalledWith(null, {}, false, expect.any(AbortSignal)));
    act(() => result.current.applyFilters({ sensitivity: "HIGH" }));
    await waitFor(() => expect(mocks.fetch).toHaveBeenLastCalledWith(null, { sensitivity: "HIGH" }, false, expect.any(AbortSignal)));
    act(() => result.current.changeTab("deleted"));
    await waitFor(() => expect(mocks.fetch).toHaveBeenLastCalledWith(null, { sensitivity: "HIGH" }, true, expect.any(AbortSignal)));
  });
  it("ignores a stale response after changing filters", async () => {
    let finish!: (value: unknown) => void;
    mocks.fetch.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }))
      .mockResolvedValue({ items: [], nextCursor: null });
    const { result } = renderHook(useAuditLedger);
    act(() => result.current.applyFilters({ action: "DELETE" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => finish({ items: [{ id: "stale" }], nextCursor: "stale" }));
    expect(result.current.events).toEqual([]);
    expect(result.current.hasNext).toBe(false);
  });
  it("does not request or retain events when audit access is removed", async () => {
    mocks.user.permissions = ["audit.read.own"];
    mocks.fetch.mockResolvedValue({ items: [{ id: "visible" }], nextCursor: null });
    const { result, rerender } = renderHook(useAuditLedger);
    await waitFor(() => expect(result.current.events).toHaveLength(1));
    mocks.user.permissions = [];
    rerender();
    expect(result.current.events).toEqual([]);
    expect(result.current.canRead).toBe(false);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
});
