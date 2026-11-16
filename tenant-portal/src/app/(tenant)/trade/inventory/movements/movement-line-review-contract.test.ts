import { describe, expect, it } from "vitest";
import { parseMovementLines } from "./movements-contract";

const id = "019f2200-0000-7000-8000-000000000001";
const line = { id, quantity: "9999999999999999.99999999", uomId: id, normalizedUomId: id,
  normalizedQuantity: "9999999999999999.99999999", reversedQuantity: "0", normalizedReversedQuantity: "0",
  descriptionSnapshot: "Named order line", reservationId: id, tracking: { lotKey: "LOT-01", expiryDate: "2027-01-01", serialKeys: [] } };
describe("returned movement line review projection", () => {
  it("preserves exact original/base/reversal quantities and proven tracking fields", () => {
    expect(parseMovementLines({ lines: [line] })[0]).toEqual({
      id, quantity: line.quantity, uomId: id, normalizedUomId: id, normalizedQuantity: line.normalizedQuantity,
      reversedQuantity: "0", normalizedReversedQuantity: "0", descriptionSnapshot: "Named order line", reservationId: id,
      lotKey: "LOT-01", expiryDate: "2027-01-01", serialKeys: [],
    });
  });
  it.each([
    { uomId: "not-an-id" }, { normalizedUomId: "not-an-id" }, { normalizedQuantity: "NaN" },
    { normalizedReversedQuantity: "NaN" }, { reservationId: "not-an-id" }, { descriptionSnapshot: 4 },
    { tracking: { lotKey: " " } }, { tracking: { expiryDate: "2027-02-30" } },
  ])("rejects malformed supplied review fields: %j", patch => {
    expect(() => parseMovementLines({ lines: [{ ...line, ...patch }] })).toThrow();
  });
});
