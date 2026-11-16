import { describe, expect, it } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { InventoryReferenceItem } from "../inventory-reference-contract";
import { EMPTY_MOVEMENT_FORM, EMPTY_MOVEMENT_LINE, EMPTY_OPENING_BALANCE_FORM, EMPTY_RESERVATION_FORM } from "./movements-contract";
import { documentFormErrors, openingFormErrors, reservationFormErrors } from "./movement-form-validation";

const id = "019f2200-0000-7000-8000-000000000001";
const item: InventoryReferenceItem = { id, name: "Scanner", code: "SCAN", profileId: id, profileVersion: 3, baseUomId: id,
  defaultSalesUomId: null, defaultPurchaseUomId: null, trackInventory: true, trackingMode: "SERIAL" };
const opening = { ...EMPTY_OPENING_BALANCE_FORM, nodeId: id, itemId: id, uomId: id, quantity: "2", itemProfileVersion: "3",
  businessEffectiveAt: "2026-11-03T08:42", serialKeys: "SN-1\nSN-2" };
const reservation = { ...EMPTY_RESERVATION_FORM, nodeId: id, itemId: id, uomId: id, quantity: "2", sourceDocumentId: id,
  sourceDocumentVersion: "4", sourceLineId: id, sourceLineVersion: "5", serialKeys: "SN-1\nSN-2" };
const document = { ...EMPTY_MOVEMENT_FORM, nodeId: id, sourceDocumentId: id, sourceDocumentVersion: "4", businessEffectiveAt: "2026-11-03T08:42",
  lines: [{ ...EMPTY_MOVEMENT_LINE, sourceLineId: id, sourceLineVersion: "5", uomId: id, quantity: "2", serialKeys: "SN-1\nSN-2", reservationId: id }] };
describe("local movement field mapping", () => {
  it.each(["", "0", "-1", "1e2", "0.000000001"])("maps unsupported opening quantity %s to its quantity field", quantity => {
    expect(openingFormErrors({ ...opening, quantity }, item, en).quantity).toBe(en.tradeInventory.formQuantityInvalid);
  });
  it("accepts exact decimal quantities and maps missing lot/invalid calendar expiry independently", () => {
    expect(openingFormErrors({ ...opening, quantity: "0.00000001", serialKeys: "" }, { ...item, trackingMode: "NONE" }, en)).toEqual({});
    const errors = openingFormErrors({ ...opening, lotKey: "", serialKeys: "", expiresAt: "2026-02-30" }, { ...item, trackingMode: "LOT" }, en);
    expect(errors.lotKey).toBe(en.tradeInventory.formTrackingInvalid);
    expect(errors.expiresAt).toBe(en.tradeInventory.formDateInvalid);
  });
  it("maps missing required serials and mismatched cardinality to the serial control", () => {
    expect(openingFormErrors({ ...opening, serialKeys: "" }, item, en).serialKeys).toBe(en.tradeInventory.serialSelectionInvalid);
    expect(reservationFormErrors({ ...reservation, serialKeys: "SN-1" }, item, en).serialKeys).toBe(en.tradeInventory.serialSelectionInvalid);
    expect(reservationFormErrors(reservation, item, en)).toEqual({});
  });
  it("maps missing source and optional invalid reservation expiration to separate fields", () => {
    const errors = reservationFormErrors({ ...reservation, sourceDocumentId: "", expiresAt: "invalid" }, item, en);
    expect(errors.sourceDocumentId).toBe(en.tradeInventory.formLinesInvalid);
    expect(errors.expiresAt).toBe(en.tradeInventory.formDateInvalid);
    expect(reservationFormErrors({ ...reservation, expiresAt: "2026-02-30T08:42" }, item, en).expiresAt).toBe(en.tradeInventory.formDateInvalid);
    expect(openingFormErrors({ ...opening, businessEffectiveAt: "2026-02-30T08:42" }, item, en).businessEffectiveAt).toBe(en.tradeInventory.formDateInvalid);
  });
  it("maps each document line's quantity, tracking, unit and reservation without losing line identity", () => {
    const errors = documentFormErrors({ ...document, lines: [{ ...document.lines[0], quantity: "0", uomId: "", serialKeys: "", reservationId: "" }] }, { [id]: item }, true, en);
    expect(errors["lines.0.quantity"]).toBe(en.tradeInventory.formQuantityInvalid);
    expect(errors["lines.0.serialKeys"]).toBe(en.tradeInventory.serialSelectionInvalid);
    expect(errors["lines.0.uomId"]).toBe(en.tradeInventory.formUomInvalid);
    expect(errors["lines.0.reservationId"]).toBe(en.tradeInventory.formLinesInvalid);
    expect(documentFormErrors(document, { [id]: item }, true, en)).toEqual({});
  });
  it("marks duplicate source lines and invalid effective date", () => {
    const errors = documentFormErrors({ ...document, businessEffectiveAt: "", lines: [document.lines[0], document.lines[0]] }, { [id]: item }, false, en);
    expect(errors.businessEffectiveAt).toBe(en.tradeInventory.formDateInvalid);
    expect(errors["lines.0.sourceLineId"]).toBe(en.tradeInventory.formLinesInvalid);
    expect(errors["lines.1.sourceLineId"]).toBe(en.tradeInventory.formLinesInvalid);
  });
});
