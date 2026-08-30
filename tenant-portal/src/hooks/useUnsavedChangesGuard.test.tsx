// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const { useUnsavedChangesGuard } = await import("./useUnsavedChangesGuard");

afterEach(() => {
  cleanup();
  push.mockReset();
});

describe("useUnsavedChangesGuard", () => {
  it("lets a navigation through untouched when the page is clean", () => {
    const navigate = vi.fn();
    const { result } = renderHook(() => useUnsavedChangesGuard(false));

    act(() => result.current.guard(navigate));

    expect(navigate).toHaveBeenCalledOnce();
    expect(result.current.isPrompting).toBe(false);
  });

  it("holds a navigation and asks, rather than losing the edits silently", () => {
    const navigate = vi.fn();
    const { result } = renderHook(() => useUnsavedChangesGuard(true));

    act(() => result.current.guard(navigate));

    expect(navigate).not.toHaveBeenCalled();
    expect(result.current.isPrompting).toBe(true);
  });

  it("runs the held navigation exactly once when the user confirms", () => {
    const navigate = vi.fn();
    const { result } = renderHook(() => useUnsavedChangesGuard(true));

    act(() => result.current.guard(navigate));
    act(() => result.current.confirmLeave());
    act(() => result.current.confirmLeave());

    expect(navigate).toHaveBeenCalledOnce();
    expect(result.current.isPrompting).toBe(false);
  });

  it("drops the held navigation when the user chooses to stay", () => {
    const navigate = vi.fn();
    const { result } = renderHook(() => useUnsavedChangesGuard(true));

    act(() => result.current.guard(navigate));
    act(() => result.current.cancelLeave());
    act(() => result.current.confirmLeave());

    expect(navigate).not.toHaveBeenCalled();
    expect(result.current.isPrompting).toBe(false);
  });

  it("cancels a dirty Link navigation and replays it through the router on confirm", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(true));
    const preventDefault = vi.fn();

    act(() => result.current.linkGuard("/crm/leads")({ preventDefault }));

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();

    act(() => result.current.confirmLeave());
    expect(push).toHaveBeenCalledWith("/crm/leads");
  });

  it("does not touch a Link navigation while the page is clean", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(false));
    const preventDefault = vi.fn();

    act(() => result.current.linkGuard("/crm/leads")({ preventDefault }));

    expect(preventDefault).not.toHaveBeenCalled();
    expect(result.current.isPrompting).toBe(false);
  });

  it("registers beforeunload only while dirty, and removes it when the page is saved", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");

    const { rerender, unmount } = renderHook(
      ({ dirty }: { dirty: boolean }) => useUnsavedChangesGuard(dirty),
      { initialProps: { dirty: false } },
    );
    expect(add.mock.calls.some(([type]) => type === "beforeunload")).toBe(false);

    rerender({ dirty: true });
    expect(add.mock.calls.some(([type]) => type === "beforeunload")).toBe(true);

    rerender({ dirty: false });
    expect(remove.mock.calls.some(([type]) => type === "beforeunload")).toBe(true);

    unmount();
    add.mockRestore();
    remove.mockRestore();
  });

  it("reads the dirty flag at navigation time, not at the time the guard was created", () => {
    const navigate = vi.fn();
    const { result, rerender } = renderHook(
      ({ dirty }: { dirty: boolean }) => useUnsavedChangesGuard(dirty),
      { initialProps: { dirty: true } },
    );

    rerender({ dirty: false });
    act(() => result.current.guard(navigate));

    expect(navigate).toHaveBeenCalledOnce();
    expect(result.current.isPrompting).toBe(false);
  });
});
