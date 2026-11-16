import { describe, expect, it } from "vitest";
import { parseOpportunityStageHistory } from "./opportunity-stage-history-contract";
const id = "01900100-0000-7000-8000-000000000001";
const historyId = "01900100-0000-7000-8000-000000000002";
const stageId = "01900100-0000-7000-8000-000000000003";
const snapshot = { membershipId: stageId, stageNameEn: "Proposal", stageNameAr: "عرض", pipelineNameEn: "Sales", pipelineNameAr: "مبيعات" };
const row = { id: historyId, opportunityId: id, fromStageId: null, toStageId: stageId, fromStatus: null, toStatus: "IN_PROGRESS", changedAt: "2026-11-04T10:15:00.123Z", changedByUserId: null, reason: "Initial placement", fromStageSnapshot: null, toStageSnapshot: snapshot };
describe("Opportunity stage history read contract", () => {
  it("retains authoritative historical names and opaque cursors", () => {
    const page = parseOpportunityStageHistory({ items: [row], nextCursor: "opaque-history-cursor" }, id);
    expect(page.items[0]?.toStageSnapshot?.stageNameEn).toBe("Proposal");
    expect(page.nextCursor).toBe("opaque-history-cursor");
  });
  it("accepts access-redacted stage snapshots without exposing their identifiers", () => {
    const page = parseOpportunityStageHistory({ items: [{ ...row, toStageId: null, toStageSnapshot: null }], nextCursor: null }, id);
    expect(page.items[0]?.toStageId).toBeNull();
    expect(page.items[0]?.toStageSnapshot).toBeNull();
  });
  it("rejects unrelated records and mismatched membership snapshots", () => {
    expect(() => parseOpportunityStageHistory({ items: [{ ...row, opportunityId: historyId }], nextCursor: null }, id)).toThrow();
    expect(() => parseOpportunityStageHistory({ items: [{ ...row, toStageSnapshot: { ...snapshot, membershipId: historyId } }], nextCursor: null }, id)).toThrow();
  });
});
