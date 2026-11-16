// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuotationComposerState } from "./useQuotationComposer";
import { useQuotationFieldEditor } from "./useQuotationFieldEditor";
import { CREATED_HEADER } from "./quotation-composer.test-fixtures";
import { quotationDatePickerText, quotationDatePickerValue } from "../quotation-editor-values";
import { validQuotationDate } from "../quotation-composer-draft";

function fixture() {
  const setters = {
    setCurrencyCode: vi.fn<(value: string) => void>(), setDraftReference: vi.fn<(value: string) => void>(),
    setValidUntil: vi.fn<(value: string) => void>(), setPaymentTermCode: vi.fn<(value: string) => void>(),
    setIncotermCode: vi.fn<(value: string) => void>(), setDeliveryDays: vi.fn<(value: string) => void>(),
    setWarrantyMonths: vi.fn<(value: string) => void>(),
  };
  const value = {
    currencyCode: "EGP", draftReference: "RFQ-1184", validUntil: "2026-11-18",
    paymentTermCode: "NET_30", incotermCode: "EXW", deliveryDays: "14", warrantyMonths: "12",
    partialHeader: null as QuotationComposerState["partialHeader"],
    savingStep: "idle" as QuotationComposerState["savingStep"],
    write: { isWriting: false, isBlocked: false, ambiguous: null, writeError: null,
      clearWriteError: vi.fn(), runWrite: vi.fn(async () => true) },
    currencies: { currencies: [
      { code: "EGP", name: "Egyptian pound", isDefault: true },
      { code: "SAR", name: "Saudi riyal", isDefault: false },
    ], options: [], canRead: true, loading: false, error: null, retry: vi.fn(), defaultCode: "EGP" },
    ...setters,
  };
  return { value, setters };
}
function editor(input: ReturnType<typeof fixture>, kind: "document" | "terms") {
  // This hook consumes only local field values, admission state and their setters.
  return renderHook(() => useQuotationFieldEditor(input.value as unknown as QuotationComposerState, kind));
}
function expectUnchanged(input: ReturnType<typeof fixture>) {
  for (const setter of Object.values(input.setters)) expect(setter).not.toHaveBeenCalled();
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-04T10:00:00Z")); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("quotation document field editor", () => {
  it("keeps changes local until Apply and discards them on cancel/reopen", () => {
    const input = fixture(); const { result } = editor(input, "document");
    act(() => result.current.show());
    act(() => result.current.change({ currencyCode: "SAR", draftReference: "RFQ changed", validUntil: "2026-12-01" }));
    expectUnchanged(input); expect(result.current.draft.currencyCode).toBe("SAR");
    act(() => result.current.setOpen(false));
    expectUnchanged(input); expect(result.current.open).toBe(false);
    act(() => result.current.show());
    expect(result.current.draft).toMatchObject({ currencyCode: "EGP", draftReference: "RFQ-1184", validUntil: "2026-11-18" });
  });

  it("commits only the selected document values when Apply is valid", () => {
    const input = fixture(); const { result } = editor(input, "document");
    act(() => result.current.show());
    act(() => result.current.change({ currencyCode: "SAR", draftReference: "RFQ changed", validUntil: "2026-12-01", deliveryDays: "99" }));
    expect(result.current.canApply).toBe(true); expectUnchanged(input);
    act(() => result.current.apply());
    expect(input.setters.setCurrencyCode).toHaveBeenCalledExactlyOnceWith("SAR");
    expect(input.setters.setDraftReference).toHaveBeenCalledExactlyOnceWith("RFQ changed");
    expect(input.setters.setValidUntil).toHaveBeenCalledExactlyOnceWith("2026-12-01");
    expect(input.setters.setDeliveryDays).not.toHaveBeenCalled(); expect(input.setters.setPaymentTermCode).not.toHaveBeenCalled();
    expect(result.current.open).toBe(false);
  });

  it("refuses a non-workspace currency and rechecks a currency removed while editing", () => {
    const input = fixture(); const { result, rerender } = editor(input, "document");
    act(() => result.current.show()); act(() => result.current.change({ currencyCode: "USD" }));
    expect(result.current.canApply).toBe(false); act(() => result.current.apply()); expectUnchanged(input);
    expect(result.current.draft.currencyCode).toBe("USD"); expect(result.current.open).toBe(true);
    act(() => result.current.change({ currencyCode: "SAR" })); expect(result.current.canApply).toBe(true);
    input.value.currencies.currencies = input.value.currencies.currencies.filter((currency) => currency.code !== "SAR");
    rerender(); expect(result.current.canApply).toBe(false); act(() => result.current.apply()); expectUnchanged(input);
    expect(result.current.draft.currencyCode).toBe("SAR");
  });

  it("keeps a confirmed header's currency/reference immutable while allowing revision validity", () => {
    const input = fixture(); input.value.partialHeader = CREATED_HEADER;
    const { result } = editor(input, "document");
    act(() => result.current.show());
    act(() => result.current.change({ currencyCode: "USD", draftReference: "Cannot replace header", validUntil: "2026-12-01" }));
    expect(result.current.headerLocked).toBe(true); expect(result.current.canApply).toBe(true);
    act(() => result.current.apply());
    expect(input.setters.setCurrencyCode).not.toHaveBeenCalled(); expect(input.setters.setDraftReference).not.toHaveBeenCalled();
    expect(input.setters.setValidUntil).toHaveBeenCalledExactlyOnceWith("2026-12-01");
  });

  it.each(["2026-11-03", "2026-02-30", "2027-02-29", "2026-13-01", "2026-11-00", "2026-11-4"])("retains rejected validity %s without committing", (validUntil) => {
    const input = fixture(); const { result } = editor(input, "document");
    act(() => result.current.show()); act(() => result.current.change({ validUntil }));
    expect(result.current.dateValid).toBe(false); expect(result.current.canApply).toBe(false);
    act(() => result.current.apply());
    expectUnchanged(input); expect(result.current.draft.validUntil).toBe(validUntil); expect(result.current.open).toBe(true);
  });

  it("blocks an overlong reference without truncating the user's entry", () => {
    const input = fixture(); const { result } = editor(input, "document"); const reference = "R".repeat(81);
    act(() => result.current.show()); act(() => result.current.change({ draftReference: reference }));
    expect(result.current.canApply).toBe(false); act(() => result.current.apply());
    expectUnchanged(input); expect(result.current.draft.draftReference).toBe(reference);
  });
});

describe("quotation commercial terms editor", () => {
  it("commits all four terms only on Apply and leaves document fields untouched", () => {
    const input = fixture(); const { result } = editor(input, "terms");
    act(() => result.current.show());
    act(() => result.current.change({ paymentTermCode: "NET_45", incotermCode: "FCA", deliveryDays: "21", warrantyMonths: "3", currencyCode: "SAR" }));
    expectUnchanged(input); expect(result.current.canApply).toBe(true);
    act(() => result.current.apply());
    expect(input.setters.setPaymentTermCode).toHaveBeenCalledExactlyOnceWith("NET_45");
    expect(input.setters.setIncotermCode).toHaveBeenCalledExactlyOnceWith("FCA");
    expect(input.setters.setDeliveryDays).toHaveBeenCalledExactlyOnceWith("21");
    expect(input.setters.setWarrantyMonths).toHaveBeenCalledExactlyOnceWith("3");
    expect(input.setters.setCurrencyCode).not.toHaveBeenCalled(); expect(input.setters.setValidUntil).not.toHaveBeenCalled();
  });

  it("cancels terms without applying any composer setter", () => {
    const input = fixture(); const { result } = editor(input, "terms");
    act(() => result.current.show()); act(() => result.current.change({ paymentTermCode: "PREPAID", deliveryDays: "7" }));
    act(() => result.current.setOpen(false)); expectUnchanged(input);
    act(() => result.current.show()); expect(result.current.draft.paymentTermCode).toBe("NET_30"); expect(result.current.draft.deliveryDays).toBe("14");
  });

  it.each([
    { field: "deliveryDays" as const, value: "-1" }, { field: "deliveryDays" as const, value: "1.5" },
    { field: "deliveryDays" as const, value: "1e3" }, { field: "warrantyMonths" as const, value: "-2" },
    { field: "warrantyMonths" as const, value: "2.25" }, { field: "warrantyMonths" as const, value: "9007199254740992" },
  ])("retains invalid $field=$value and blocks Apply", ({ field, value }) => {
    const input = fixture(); const { result } = editor(input, "terms");
    act(() => result.current.show()); act(() => result.current.change({ [field]: value }));
    expect(result.current.canApply).toBe(false); act(() => result.current.apply());
    expectUnchanged(input); expect(result.current.draft[field]).toBe(value); expect(result.current.open).toBe(true);
  });

  it("accepts explicit zero and the documented blank defaults", () => {
    const input = fixture(); const { result } = editor(input, "terms");
    act(() => result.current.show()); act(() => result.current.change({ deliveryDays: "0", warrantyMonths: "0" }));
    expect(result.current.canApply).toBe(true);
    act(() => result.current.change({ deliveryDays: "", warrantyMonths: "" }));
    expect(result.current.deliveryValid).toBe(true); expect(result.current.warrantyValid).toBe(true);
  });

  it.each(["paymentTermCode", "incotermCode"] as const)("blocks an overlong %s while keeping its value", (field) => {
    const input = fixture(); const { result } = editor(input, "terms"); const value = "X".repeat(81);
    act(() => result.current.show()); act(() => result.current.change({ [field]: value }));
    expect(result.current.canApply).toBe(false); act(() => result.current.apply());
    expectUnchanged(input); expect(result.current.draft[field]).toBe(value);
  });
});

describe("editor write fences and real-day calendar values", () => {
  it.each(["document", "terms"] as const)("fences %s Apply when a write becomes unresolved", (kind) => {
    const input = fixture(); const { result, rerender } = editor(input, kind);
    act(() => result.current.show()); act(() => result.current.change({ validUntil: "2026-12-01", deliveryDays: "21" }));
    input.value.write.isBlocked = true; rerender();
    expect(result.current.canApply).toBe(false); act(() => result.current.apply()); expectUnchanged(input);
    expect(result.current.open).toBe(true); expect(result.current.draft.deliveryDays).toBe("21");
  });

  it("does not open an editor during a pending revision write", () => {
    const input = fixture(); input.value.savingStep = "revision"; const { result } = editor(input, "document");
    act(() => result.current.show()); expect(result.current.open).toBe(false); expect(result.current.canApply).toBe(false); expectUnchanged(input);
  });

  it("round-trips a real leap day and keeps a calendar selection local until Apply", () => {
    const date = quotationDatePickerValue("2028-02-29");
    expect(date?.getFullYear()).toBe(2028); expect(date?.getMonth()).toBe(1); expect(date?.getDate()).toBe(29);
    expect(quotationDatePickerText(date)).toBe("2028-02-29"); expect(validQuotationDate("2028-02-29")).toBe(true);
    const input = fixture(); const { result } = editor(input, "document");
    act(() => result.current.show()); act(() => result.current.selectDate(date)); expectUnchanged(input);
    expect(result.current.draft.validUntil).toBe("2028-02-29");
    act(() => result.current.apply()); expect(input.setters.setValidUntil).toHaveBeenCalledExactlyOnceWith("2028-02-29");
  });

  it.each(["2027-02-29", "2100-02-29", "2026-04-31", "2026-00-10", "2026-11-00"])("does not normalize the impossible calendar day %s", (value) => {
    expect(quotationDatePickerValue(value)).toBeUndefined(); expect(validQuotationDate(value)).toBe(false);
  });

  it("keeps a cleared calendar selection invalid without replacing it with today's date", () => {
    const input = fixture(); const { result } = editor(input, "document");
    act(() => result.current.show()); act(() => result.current.selectDate(undefined));
    expect(result.current.draft.validUntil).toBe(""); expect(result.current.dateValue).toBeUndefined(); expect(result.current.canApply).toBe(false);
    act(() => result.current.apply()); expectUnchanged(input);
  });
});
