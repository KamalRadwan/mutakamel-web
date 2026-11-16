// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { usePricingClock } from "./usePricingClock";
import { useVersionEditorFocus } from "./useVersionEditorFocus";
import { usePriceBookWorkspaceUi } from "./hooks/usePriceBookWorkspaceUi";
import type { DraftValidationIssue } from "../version-draft";

vi.mock("@/hooks/useUnsavedChangesGuard", () => ({
  useUnsavedChangesGuard: (blocked: boolean) => ({ blocked, requestDiscard: (next: () => void) => next() }),
}));
afterEach(() => { cleanup(); vi.useRealTimers(); document.body.replaceChildren(); });

describe("workspace interaction verification", () => {
  it("updates applicability at the exact saved boundary without a network poll", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T10:00:00.000Z"));
    const boundary = "2026-11-01T10:00:05.000Z";
    const { result, unmount } = renderHook(() => usePricingClock([boundary]));
    expect(result.current).toBe(Date.parse("2026-11-01T10:00:00.000Z"));
    act(() => { vi.advanceTimersByTime(5001); });
    expect(result.current).toBeGreaterThanOrEqual(Date.parse(boundary));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reveals the issue's actual page and focuses once without stealing focus while typing", async () => {
    const input = document.createElement("input"); input.id = "entry-last-price"; document.body.append(input);
    const issue: DraftValidationIssue = {
      id: "invalid-last", tab: "matrix", rowKey: "row-119", rowIndex: 119,
      field: "unitPrice", code: "ENTRY_UNIT_PRICE_INVALID", targetDomId: input.id,
    };
    const focus = vi.spyOn(input, "focus");
    const request = { issue, request: 1 };
    const { result, rerender } = renderHook(({ rowKeys }) => {
      const [selected, selectRow] = useState<string | null>(null);
      const [search, setSearch] = useState("unrelated query");
      const [page, setPage] = useState(1);
      useVersionEditorFocus({ request, rowKeys, selectRow, setSearch, setPage });
      return { selected, search, page, setSearch };
    }, { initialProps: { rowKeys: Array.from({ length: 120 }, (_, i) => `row-${i}`) } });
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect(result.current).toMatchObject({ selected: "row-119", search: "", page: 3 });
    act(() => { result.current.setSearch("typed after focus"); });
    rerender({ rowKeys: Array.from({ length: 120 }, (_, i) => `row-${i}`) });
    expect(result.current.search).toBe("typed after focus");
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it("exposes recovery outside writing dialogs and retains the same form session", async () => {
    const { result, rerender } = renderHook(({ unknownWrite }) => usePriceBookWorkspaceUi({
      scopeKey: "book-actor-company", isDirty: false, unknownWrite,
    }), { initialProps: { unknownWrite: false } });
    act(() => { result.current.openCreateDraft(); });
    expect(result.current.createDraftOpen).toBe(true);
    const session = result.current.createSession;
    rerender({ unknownWrite: true });
    await waitFor(() => expect(result.current.createDraftOpen).toBe(false));
    expect(result.current.createSession).toBe(session);
    act(() => { result.current.openCreateDraft(); });
    expect(result.current.createDraftOpen).toBe(false);
  });

  it("does not carry open forms or selected tabs into another actor/company scope", () => {
    const { result, rerender } = renderHook(({ scopeKey }) => usePriceBookWorkspaceUi({
      scopeKey, isDirty: false, unknownWrite: false,
    }), { initialProps: { scopeKey: "first" } });
    act(() => { result.current.openEditBook(); result.current.setActiveTab("activity"); });
    expect(result.current.editBookOpen).toBe(true);
    rerender({ scopeKey: "second" });
    expect(result.current.editBookOpen).toBe(false);
    expect(result.current.activeTab).toBe("prices");
  });
});
