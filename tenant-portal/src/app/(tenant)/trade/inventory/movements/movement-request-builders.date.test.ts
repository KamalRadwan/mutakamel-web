import { describe, expect, it } from "vitest";
import { buildOpeningBalanceRequest, buildReceiptRequest, buildDeliveryRequest,
  buildReservationRequest, buildReversalRequest } from "./movement-request-builders";

const id = "01902001-3000-7000-8000-000000000001";
const base = { nodeId: id, itemId: id, uomId: id, quantity: "1", itemProfileVersion: "1",
  sourceDocumentId: id, sourceLineId: id, sourceDocumentVersion: "1", sourceLineVersion: "1" };
const builders = [
  (businessEffectiveAt: string) => buildOpeningBalanceRequest({ ...base, businessEffectiveAt }),
  (businessEffectiveAt: string) => buildReceiptRequest({ ...base, businessEffectiveAt, lines: [{ ...base }] }),
  (businessEffectiveAt: string) => buildDeliveryRequest({ ...base, businessEffectiveAt, lines: [{ ...base }] }),
  (expiresAt: string) => buildReservationRequest({ ...base, expiresAt }),
  (businessEffectiveAt: string) => buildReversalRequest("DATA_ENTRY_CORRECTION", businessEffectiveAt),
];

describe("movement calendar instants", () => {
  it.each(["2026-02-30T12:00", "2026-02-29T12:00:00Z", "2026-13-01T12:00:00+02:00"])("rejects %s without normalizing to another date", value => {
    builders.forEach(build => expect(() => build(value)).toThrow("INVENTORY_FORM_DATE"));
  });
  it("keeps valid leap days and interprets an explicit timezone exactly", () => {
    expect(buildOpeningBalanceRequest({ ...base, businessEffectiveAt: "2028-02-29T12:00:00+02:00" }).businessEffectiveAt)
      .toBe("2028-02-29T10:00:00.000Z");
  });
});
