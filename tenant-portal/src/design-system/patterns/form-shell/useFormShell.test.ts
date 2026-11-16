// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFormShell } from "./useFormShell";

afterEach(cleanup);
describe("pending form dismissal", () => {
  it.each([false, true])("does not close or show discard while pending (dirty=%s)", (isDirty) => {
    const close = vi.fn();
    const { result } = renderHook(() => useFormShell({ body: null, open: true, isSubmitting: true, isDirty, onSubmit: vi.fn(), onOpenChange: close }));
    act(() => result.current.requestClose());
    act(() => result.current.confirmDiscard());
    expect(close).not.toHaveBeenCalled();
    expect(result.current.confirmingDiscard).toBe(false);
  });

  it("also fences an already-open discard confirmation until the request settles", () => {
    const close = vi.fn();
    const { result, rerender } = renderHook(({ pending }) => useFormShell({ body: null, open: true, isSubmitting: pending, isDirty: true, onSubmit: vi.fn(), onOpenChange: close }), { initialProps: { pending: false } });
    act(() => result.current.requestClose());
    expect(result.current.confirmingDiscard).toBe(true);
    rerender({ pending: true });
    act(() => result.current.confirmDiscard());
    expect(close).not.toHaveBeenCalled();
    rerender({ pending: false });
    act(() => result.current.confirmDiscard());
    expect(close).toHaveBeenCalledWith(false);
  });
});
