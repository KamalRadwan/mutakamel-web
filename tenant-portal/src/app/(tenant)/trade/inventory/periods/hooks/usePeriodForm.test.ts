// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { usePeriodForm } from "./usePeriodForm";
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
afterEach(cleanup);
describe("period form validation", () => {
  it("rejects impossible calendar dates, overlaps within its own range and the storage code bound", async () => {
    const submit = vi.fn();
    const { result } = renderHook(() => usePeriodForm(submit));
    act(() => result.current.set({ code: `I${"X".repeat(40)}`, startsOn: "2026-02-30", endsOn: "2026-02-01", maxBackdateDays: "367" }));
    await act(() => result.current.submit());
    expect(submit).not.toHaveBeenCalled();
    expect(result.current.errors).toEqual({ code: en.tradeInventory.formCodeInvalid, startsOn: en.tradeInventory.formDateInvalid, endsOn: en.tradeInventory.formDateInvalid, maxBackdateDays: en.tradeInventory.formBackdateInvalid });
  });
  it("submits a valid range without changing string dates and keeps a failed draft", async () => {
    const submit = vi.fn().mockResolvedValue(false);
    const { result } = renderHook(() => usePeriodForm(submit));
    const values = { code: "INV-2026-12", startsOn: "2026-12-01", endsOn: "2026-12-31", maxBackdateDays: "7" };
    act(() => result.current.set(values));
    await act(() => result.current.submit());
    expect(submit).toHaveBeenCalledWith(values);
    expect(result.current.values).toEqual(values);
    expect(result.current.isDirty).toBe(true);
  });
});
