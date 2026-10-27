// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAssignmentOptions, type AssignmentOptions } from "../contracts/assignment-options-contract";
import { useRoleGrantOptions } from "./useRoleGrantOptions";

vi.mock("@/i18n/useLanguage", () => ({ useLanguage: () => "en" }));
vi.mock("../contracts/assignment-options-contract", () => ({ fetchAssignmentOptions: vi.fn() }));
const target = "019f3000-0000-7000-8000-000000000001";
const otherTarget = "019f3000-0000-7000-8000-000000000002";
const roleId = "019f3000-0000-7000-8000-000000000003";
const branchId = "019f3000-0000-7000-8000-000000000004";
const first: AssignmentOptions = {
  choices: [{ roleId, branchId, branchName: "Alpha", roleNameAr: "قارئ", roleNameEn: "Reader" }],
  labels: [{ kind: "branch", id: otherTarget, nameAr: "فرع قديم", nameEn: "Old branch" }],
  hasMore: true,
};

beforeEach(() => { vi.mocked(fetchAssignmentOptions).mockResolvedValue(first); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("role grant options", () => {
  it("skips protected or unauthorized targets", async () => {
    renderHook(() => useRoleGrantOptions(target, false));
    await act(async () => {});
    expect(fetchAssignmentOptions).not.toHaveBeenCalled();
  });
  it("retains names for inactive grants across search and additional pages", async () => {
    const { result } = renderHook(() => useRoleGrantOptions(target, true));
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.labelFor("branch", otherTarget)).toBe("Old branch");
    vi.mocked(fetchAssignmentOptions).mockResolvedValueOnce({ choices: [], labels: first.labels, hasMore: false });
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.hasMore).toBe(false));
    expect(fetchAssignmentOptions).toHaveBeenLastCalledWith(target, "", 2, expect.any(AbortSignal));
    expect(result.current.options).toHaveLength(1);
    vi.mocked(fetchAssignmentOptions).mockResolvedValueOnce({ choices: [], labels: first.labels, hasMore: false });
    act(() => result.current.search("Nobody"));
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.choices).toEqual([]);
    expect(result.current.labelFor("branch", otherTarget)).toBe("Old branch");
  });
  it("blocks choices after failure and restores authoritative values on retry", async () => {
    vi.mocked(fetchAssignmentOptions).mockRejectedValueOnce(new Error("unavailable"));
    const { result } = renderHook(() => useRoleGrantOptions(target, true));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.isReady).toBe(false);
    expect(result.current.options).toEqual([]);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.choices).toEqual(first.choices);
  });
  it("does not expose the previous user's choices while the next target loads", async () => {
    const { result, rerender } = renderHook(({ id }) => useRoleGrantOptions(id, true), { initialProps: { id: target } });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    let resolveNext!: (value: AssignmentOptions) => void;
    vi.mocked(fetchAssignmentOptions).mockReturnValueOnce(new Promise((resolve) => { resolveNext = resolve; }));
    rerender({ id: otherTarget });
    expect(result.current.choices).toEqual([]);
    expect(result.current.labelFor("branch", branchId)).toBeUndefined();
    await waitFor(() => expect(fetchAssignmentOptions).toHaveBeenLastCalledWith(otherTarget, "", 1, expect.any(AbortSignal)));
    await act(async () => { resolveNext({ choices: [], labels: [], hasMore: false }); });
    expect(result.current.isReady).toBe(true);
    expect(result.current.choices).toEqual([]);
  });
});
