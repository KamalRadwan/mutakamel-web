import { describe, expect, it } from "vitest";
import { readSuppressionLift, readSuppressionLookup } from "./email-suppression-contract";

const envelope = (data: unknown) => ({ success: true, data });
describe("email suppression response boundary", () => {
  it.each(["HARD_BOUNCE", "COMPLAINT"])("reads %s and projects only safe fields", (reasonCode) => {
    const details = { suppressed: true, reasonCode, firstOccurredAt: "2026-10-23T10:00:00.000Z", lastOccurredAt: "2026-10-23T11:00:00.000Z" };
    expect(readSuppressionLookup(envelope({ ...details, address: "private@example.com", recipientHash: "secret" }))).toEqual(details);
  });
  it("reads absence and both lift outcomes", () => {
    expect(readSuppressionLookup(envelope({ suppressed: false }))).toEqual({ suppressed: false });
    for (const lifted of [true, false]) expect(readSuppressionLift(envelope({ suppressed: false, lifted }))).toEqual({ suppressed: false, lifted });
  });
  it.each([
    null, { suppressed: false }, { success: false, data: { suppressed: false } },
    envelope({ suppressed: "false" }),
    envelope({ suppressed: true, reasonCode: "SOFT_BOUNCE" }),
    envelope({ suppressed: true, reasonCode: "COMPLAINT", firstOccurredAt: "invalid", lastOccurredAt: "2026-10-23T10:00:00Z" }),
    envelope({ suppressed: true, reasonCode: "COMPLAINT", firstOccurredAt: "2026-10-23T10:00:00Z" }),
  ])("rejects malformed lookups", (value) => {
    expect(() => readSuppressionLookup(value)).toThrow("INVALID_SUPPRESSION_RESPONSE");
  });
  it.each([envelope({ suppressed: true, lifted: true }), envelope({ suppressed: false, lifted: "true" })])("rejects malformed lifts", (value) => {
    expect(() => readSuppressionLift(value)).toThrow("INVALID_SUPPRESSION_RESPONSE");
  });
});

