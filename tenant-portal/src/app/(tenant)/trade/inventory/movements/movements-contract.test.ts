import { describe, expect, it } from "vitest";
import {
  buildDeliveryRequest, buildOpeningBalanceRequest, buildReceiptRequest,
  buildReservationRequest, parseReservation, buildReleaseRequest, buildReversalRequest,
  parseMovementLines, parseMovementStatus,
} from "./movements-contract";
import { inventoryFormMessage } from "../inventory-messages";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";

const reservation = {
  id: "01902001-3000-7000-8000-000000000001",
  fulfillmentNodeId: "01902001-3000-7000-8000-000000000002",
  status: "PARTIALLY_RELEASED",
  version: 8,
  quantity: "10.00000000",
  releasedQuantity: "3.00000000",
  consumedQuantity: "0.00000000",
};

const base = {
  nodeId: reservation.fulfillmentNodeId, itemId: reservation.id, uomId: reservation.id,
  itemProfileVersion: "1", businessEffectiveAt: "2026-10-24T12:00:00.000Z",
  sourceDocumentId: reservation.id, sourceLineId: reservation.id,
  sourceDocumentVersion: "1", sourceLineVersion: "1",
};

describe("serial-array movement requests", () => {
  const builders = [
    { name: "opening balance", build: (quantity: string, serialKeys: string) => {
      const request = buildOpeningBalanceRequest({ ...base, quantity, serialKeys });
      return { quantity: request.quantity, tracking: request.tracking };
    } },
    { name: "reservation", build: (quantity: string, serialKeys: string) => {
      const request = buildReservationRequest({ ...base, quantity, serialKeys });
      return { quantity: request.quantity, tracking: request.tracking };
    } },
    ...[buildReceiptRequest, buildDeliveryRequest].map((builder, index) => ({
      name: index === 0 ? "receipt" : "delivery",
      build: (quantity: string, serialKeys: string) => {
        const request = builder({ ...base, lines: [{ ...base, quantity, serialKeys }] });
        return { quantity: request.lines[0].quantity, tracking: request.lines[0].tracking };
      },
    })),
  ];

  describe.each(builders)("$name", ({ build }) => {
    it("sends trimmed serial arrays without changing the quantity", () => {
      expect(build("1", " SN001 ")).toEqual({ quantity: "1", tracking: { serialKeys: ["SN001"] } });
      expect(build("1.00000000", "SN001").quantity).toBe("1.00000000");
      expect(build("3.00000000", " SN001 \n SN 002 \nSN003 ")).toEqual({
        quantity: "3.00000000", tracking: { serialKeys: ["SN001", "SN 002", "SN003"] },
      });
    });

    it.each(["2", "0.5", "1.00000001", "0", "-1"])("blocks serial quantity %s", (quantity) => {
      expect(() => build(quantity, "SN001")).toThrow("INVENTORY_FORM_SERIAL_SELECTION");
    });

    it.each(["SN001\nSN001", " SN001 \nSN001 ", "SN001\n\nSN002", "none\nSN002", `${"A".repeat(121)}\nSN002`])("rejects invalid serial input %s", (serials) => {
      expect(() => build("2", serials)).toThrow("INVENTORY_FORM_SERIAL_SELECTION");
    });

    it("rejects count mismatches and accepts the maximum identity length", () => {
      expect(() => build("3", "SN001\nSN002")).toThrow("INVENTORY_FORM_SERIAL_SELECTION");
      expect(build("1", "A".repeat(120)).tracking).toEqual({ serialKeys: ["A".repeat(120)] });
    });

    it("preserves non-serial decimal quantities and omits empty tracking", () => {
      expect(build("12.50000000", " ")).toEqual({ quantity: "12.50000000", tracking: undefined });
    });
  });

  it("preserves stock expiry as a calendar date, without timezone conversion", () => {
    expect(buildOpeningBalanceRequest({ ...base, quantity: "2", lotKey: "LOT1", expiresAt: "2027-01-01" }).tracking)
      .toEqual({ lotKey: "LOT1", expiryDate: "2027-01-01" });
    expect(buildReceiptRequest({ ...base, lines: [{ ...base, quantity: "2", expiresAt: "2027-01-01" }] }).lines[0].tracking)
      .toEqual({ expiryDate: "2027-01-01" });
  });

  it.each(["2027-02-30", "2027-13-01", "2027-01-01T00:00:00Z"])("rejects invalid stock expiry %s", (expiresAt) => {
    expect(() => buildOpeningBalanceRequest({ ...base, quantity: "1", expiresAt })).toThrow("INVENTORY_FORM_DATE");
  });

  it("keeps reservation expiration outside tracking as an instant", () => {
    expect(buildReservationRequest({ ...base, quantity: "1", serialKeys: "SN001", expiresAt: "2027-01-01T12:00:00Z" }))
      .toMatchObject({ expiresAt: "2027-01-01T12:00:00.000Z", tracking: { serialKeys: ["SN001"] } });
  });

  it.each([ar, en])("translates the local serial guard", (t) => {
    expect(inventoryFormMessage(new Error("INVENTORY_FORM_SERIAL_SELECTION"), t)).toBe(t.tradeInventory.serialSelectionInvalid);
  });
});

describe("explicit serial subsets", () => {
  it("sends release serials at the top level with optional quantity", () => {
    expect(buildReleaseRequest("2.00000000", "CUSTOMER_CANCELLED", " SN002 \nSN003")).toEqual({
      quantity: "2.00000000", reasonCode: "CUSTOMER_CANCELLED", serialKeys: ["SN002", "SN003"],
    });
    expect(buildReleaseRequest("", "", "SN003")).toEqual({ serialKeys: ["SN003"] });
    expect(buildReleaseRequest("", "")).toEqual({});
    expect(() => buildReleaseRequest("2", "", "SN003")).toThrow("INVENTORY_FORM_SERIAL_SELECTION");
    expect(() => buildReleaseRequest("", "", "SN003\n SN003 ")).toThrow("INVENTORY_FORM_SERIAL_SELECTION");
  });

  it("sends reversal subsets against movement line IDs and omits lines for a full reversal", () => {
    expect(buildReversalRequest("DATA_ENTRY_CORRECTION", base.businessEffectiveAt, [{
      lineId: reservation.id, quantity: "2", serialKeys: "SN002\nSN003",
    }])).toEqual({
      reasonCode: "DATA_ENTRY_CORRECTION", businessEffectiveAt: base.businessEffectiveAt,
      lines: [{ lineId: reservation.id, quantity: "2", serialKeys: ["SN002", "SN003"] }],
    });
    expect(buildReversalRequest("DATA_ENTRY_CORRECTION", base.businessEffectiveAt)).not.toHaveProperty("lines");
    expect(() => buildReversalRequest("DATA_ENTRY_CORRECTION", base.businessEffectiveAt, [{
      lineId: reservation.id, quantity: "3", serialKeys: "SN002\nSN003",
    }])).toThrow("INVENTORY_FORM_SERIAL_SELECTION");
    expect(() => buildReversalRequest("DATA_ENTRY_CORRECTION", base.businessEffectiveAt, [
      { lineId: reservation.id, quantity: "1", serialKeys: "SN002" },
      { lineId: reservation.id, quantity: "1", serialKeys: "SN003" },
    ])).toThrow("INVENTORY_FORM_LINES");
  });

  it("validates the returned line identities and preserves partial reversal status", () => {
    expect(parseMovementLines({ lines: [{ id: reservation.id, quantity: "2", tracking: { serialKeys: ["SN001", "SN002"] } }] }))
      .toEqual([{ id: reservation.id, quantity: "2", serialKeys: ["SN001", "SN002"] }]);
    expect(() => parseMovementLines({ lines: [{ id: "bad", quantity: "2", tracking: {} }] })).toThrow();
    expect(() => parseMovementLines({ lines: [{ id: reservation.id, quantity: "2", tracking: { serialKeys: [7] } }] })).toThrow();
    expect(parseMovementStatus({ status: "PARTIALLY_REVERSED" })).toBe("PARTIALLY_REVERSED");
    expect(() => parseMovementStatus({ status: "UNKNOWN" })).toThrow();
  });
});

describe("reservation response", () => {
  it("preserves the server status, quantities and version after releasing 3 of 10", () => {
    expect(parseReservation(reservation, reservation.id)).toEqual({
      ...reservation, remainingQuantity: "7.00000000",
    });
  });

  it.each([
    ["RELEASED", "10", "0"],
    ["CLOSED", "8", "2"],
    ["CONSUMED", "0", "10"],
  ])("preserves the terminal status %s", (status, releasedQuantity, consumedQuantity) => {
    expect(parseReservation({ ...reservation, status, releasedQuantity, consumedQuantity }))
      .toMatchObject({ status, remainingQuantity: "0.00000000" });
  });

  it("subtracts consumed stock without losing any of the eight decimal places", () => {
    expect(parseReservation({
      ...reservation,
      status: "PARTIALLY_CONSUMED",
      quantity: "9999999999999999.99999999",
      releasedQuantity: "0.00000001",
      consumedQuantity: "0.00000001",
    }).remainingQuantity).toBe("9999999999999999.99999997");
  });

  it.each([
    { status: "UNKNOWN" }, { version: undefined }, { version: 0 },
    { releasedQuantity: 3 }, { releasedQuantity: "-1" },
    { consumedQuantity: "8" }, { quantity: "1.123456789" },
    { fulfillmentNodeId: "invalid" },
  ])("rejects malformed or inconsistent response fields: %j", (fields) => {
    expect(() => parseReservation({ ...reservation, ...fields })).toThrow("Invalid Trade inventory response.");
  });

  it("rejects a response for a different reservation", () => {
    expect(() => parseReservation(reservation, reservation.fulfillmentNodeId)).toThrow();
  });
});
