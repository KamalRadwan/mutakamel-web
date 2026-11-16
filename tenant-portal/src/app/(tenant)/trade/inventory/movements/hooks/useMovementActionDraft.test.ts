// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import type { SessionMovementEntry } from "../movements-contract";
import type { useInventoryMovements } from "./useInventoryMovements";
import { useMovementActionDraft } from "./useMovementActionDraft";

let language: "ar" | "en" = "en";
const dictionaries = { ar, en };
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionaries[language], lang: language }) }));
const id = "019f2200-0000-7000-8000-000000000001";
const target: SessionMovementEntry = { id, nodeId: id, kind: "delivery", status: "POSTED", version: 4,
  recordedAt: "2026-11-03T08:00:00Z", businessEffectiveAt: "2026-11-03T08:00:00Z", summary: "2 serials",
  lines: [{ id, quantity: "2", serialKeys: ["SN-001", "SN-002"], reversedQuantity: "0" }] };
const reverse = vi.fn().mockResolvedValue(false);
const controller = { reverseDelivery: reverse } as unknown as ReturnType<typeof useInventoryMovements>;
afterEach(() => { cleanup(); language = "en"; vi.clearAllMocks(); });
describe.each(["ar", "en"] as const)("partial reversal validation (%s)", locale => {
  it("blocks excess quantities and missing serial subsets, then submits the corrected exact selection", async () => {
    language = locale;
    const { result } = renderHook(() => useMovementActionDraft(target, "reverse", controller, vi.fn()));
    act(() => { result.current.setReason("CUSTOMER_RETURN"); result.current.setEffectiveAt("2027-01-01T10:00"); result.current.add(id); });
    act(() => result.current.change(id, { quantity: "3", serialKeys: "SN-001" }));
    await act(async () => result.current.submit());
    expect(reverse).not.toHaveBeenCalled();
    expect(result.current.fieldErrors.lines[id].quantity).toBe(dictionaries[locale].tradeInventory.formQuantityInvalid);
    act(() => result.current.change(id, { quantity: "1", serialKeys: "" }));
    await act(async () => result.current.submit());
    expect(result.current.fieldErrors.lines[id].serials).toBe(dictionaries[locale].tradeInventory.serialSelectionInvalid);
    act(() => result.current.change(id, { serialKeys: "SN-002" }));
    await act(async () => result.current.submit());
    expect(reverse).toHaveBeenCalledWith(id, 4, "CUSTOMER_RETURN", "2027-01-01T10:00", [{ lineId: id, quantity: "1", serialKeys: "SN-002" }]);
  });
  it("rejects calendar rollover and an instant before the original movement", async () => {
    language = locale;
    const { result } = renderHook(() => useMovementActionDraft(target, "reverse", controller, vi.fn()));
    act(() => { result.current.setReason("CUSTOMER_RETURN"); result.current.setEffectiveAt("2027-02-30T10:00"); });
    await act(async () => result.current.submit());
    expect(result.current.fieldErrors.effectiveAt).toBe(dictionaries[locale].tradeInventory.formDateInvalid);
    act(() => result.current.setEffectiveAt("2025-01-01T10:00"));
    await act(async () => result.current.submit());
    expect(reverse).not.toHaveBeenCalled();
  });
});
