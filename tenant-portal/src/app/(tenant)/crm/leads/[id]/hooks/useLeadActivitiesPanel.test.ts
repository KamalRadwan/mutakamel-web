// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLeadActivities } from "../../hooks/useLeadActivities";
import { useLeadActivitiesPanel } from "./useLeadActivitiesPanel";

vi.mock("../../hooks/useLeadActivities", () => ({ useLeadActivities: vi.fn() }));
const row = { id: "activity", subject: "Call buyer", type: "CALL", priority: "NORMAL",
  dueAt: "2026-10-07T10:00:00Z", description: "Discuss offer", version: 3 };
const state = {
  canRead: true, canCreate: true, canUpdate: true, canComplete: true, canCancel: true,
  activities: [row], isLoading: false, loadError: null, reload: vi.fn(), isSubmitting: false,
  writeError: null, fieldErrors: {}, pendingActivityId: null, create: vi.fn(), update: vi.fn(),
  complete: vi.fn(), cancel: vi.fn(),
};
beforeEach(() => {
  vi.resetAllMocks();
  state.cancel.mockResolvedValue(true);
  vi.mocked(useLeadActivities).mockReturnValue(state);
});
afterEach(cleanup);

describe("lead activity rail actions", () => {
  it("edits the selected row only and uses the existing complete/cancel writes", async () => {
    const { result } = renderHook(() => useLeadActivitiesPanel("lead", false));
    act(() => result.current.edit(row));
    expect(result.current.editing).toBe(row);
    await act(() => result.current.complete(row));
    expect(state.complete).toHaveBeenCalledWith(row);
    act(() => result.current.discard(row));
    expect(state.cancel).not.toHaveBeenCalled();
    await act(() => result.current.confirmDiscard());
    expect(state.cancel).toHaveBeenCalledWith(row);
    expect(result.current.discarding).toBeNull();
  });
  it("does not permit mutations in read-only mode", async () => {
    const { result } = renderHook(() => useLeadActivitiesPanel("lead", true));
    act(() => { result.current.edit(row); result.current.discard(row); });
    await act(() => result.current.complete(row));
    await act(() => result.current.confirmDiscard());
    expect(result.current.editing).toBeNull();
    expect(result.current.discarding).toBeNull();
    expect(state.complete).not.toHaveBeenCalled();
    expect(state.cancel).not.toHaveBeenCalled();
  });
  it("keeps the confirmation open when cancel fails", async () => {
    state.cancel.mockResolvedValue(false);
    const { result } = renderHook(() => useLeadActivitiesPanel("lead", false));
    act(() => result.current.discard(row));
    await act(() => result.current.confirmDiscard());
    expect(result.current.discarding).toBe(row);
  });
});
