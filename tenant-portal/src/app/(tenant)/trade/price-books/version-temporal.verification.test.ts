import { describe, expect, it } from "vitest";
import type { GovernanceAuditEvent } from "./pricing-contract";
import {
  deriveVersionTemporalState,
  eligiblePredecessorVersions,
  findOverlappingActiveVersions,
  resolveVersionPublisher,
  resolveVersionRetirement,
  selectDefaultTimelineVersion,
  type TemporalVersionInput,
} from "./version-temporal";

const NOW = Date.parse("2026-11-01T12:00:00.000Z");
const START = "2026-01-01T00:00:00.000Z";
const NEXT = "2026-11-15T00:00:00.000Z";
function version(overrides: Partial<TemporalVersionInput> = {}): TemporalVersionInput {
  return { id: "v1", versionNumber: 1, status: "PUBLISHED", effectiveFrom: START, effectiveTo: null, ...overrides };
}
function event(resourceId: string, action: string, actorDisplayName: string): GovernanceAuditEvent {
  return { id: `${resourceId}-${action}`, resourceId, resourceType: "PRICE_BOOK_VERSION", resourceVersion: 1,
    action, actorUserId: actorDisplayName, actorDisplayName, actorEmail: null, reason: null,
    occurredAt: START, evidence: {} };
}

describe("price book temporal contract regression", () => {
  it("keeps a predecessor effective until the exclusive future replacement boundary", () => {
    const old = version({ supersededAt: NEXT });
    expect(deriveVersionTemporalState(old, NOW)).toMatchObject({ isEffectiveNow: true, kind: "WILL_BE_REPLACED" });
    expect(deriveVersionTemporalState(old, Date.parse(NEXT))).toMatchObject({ isEffectiveNow: false, kind: "REPLACED" });
  });
  it("recognizes scheduled content at the inclusive start without requiring a worker status change", () => {
    const scheduled = version({ status: "SCHEDULED", effectiveFrom: NEXT });
    expect(deriveVersionTemporalState(scheduled, Date.parse(NEXT) - 1).kind).toBe("UPCOMING");
    expect(deriveVersionTemporalState(scheduled, Date.parse(NEXT)).isEffectiveNow).toBe(true);
  });
  it("uses the exclusive end and excludes retired and untested versions", () => {
    expect(deriveVersionTemporalState(version({ effectiveTo: NEXT }), Date.parse(NEXT)).kind).toBe("ENDED");
    for (const status of ["RETIRED", "DRAFT", "TESTED"]) {
      expect(deriveVersionTemporalState(version({ status }), NOW).isEffectiveNow).toBe(false);
    }
  });
  it("selects current prices before newer authoring or upcoming versions", () => {
    const current = version({ supersededAt: NEXT });
    const upcoming = version({ id: "v2", versionNumber: 2, status: "SCHEDULED", effectiveFrom: NEXT });
    const draft = version({ id: "v3", versionNumber: 3, status: "DRAFT" });
    expect(selectDefaultTimelineVersion([draft, upcoming, current], NOW)?.id).toBe("v1");
    expect(selectDefaultTimelineVersion([current, upcoming], Date.parse(NEXT))?.id).toBe("v2");
    expect(selectDefaultTimelineVersion([], NOW)).toBeNull();
  });
  it("permits adjacent publication intervals and cannot hide an unrelated overlap", () => {
    const target = version({ id: "v2", effectiveFrom: NEXT });
    expect(findOverlappingActiveVersions([version({ effectiveTo: NEXT })], target)).toEqual([]);
    const unrelated = version({ id: "other", versionNumber: 3 });
    expect(findOverlappingActiveVersions([version(), unrelated], target, "v1").map(v => v.id)).toEqual(["other"]);
  });
  it("offers only eligible predecessors and blocks a retroactive replacement", () => {
    const target = { id: "v2", effectiveFrom: NEXT };
    const candidates = [version(), version({ id: "retired", status: "RETIRED" }), version({ id: "replaced", supersededAt: NEXT })];
    expect(eligiblePredecessorVersions(candidates, target, NOW).eligible.map(v => v.id)).toEqual(["v1"]);
    expect(eligiblePredecessorVersions(candidates, target, Date.parse(NEXT) + 1)).toMatchObject({ eligible: [], retroactiveBlocked: true });
  });
  it("attributes evidence to the selected version and does not infer a missing publisher", () => {
    const audit = [event("v2", "PUBLISH", "New publisher"), event("v1", "RETIRE", "Retirer"), event("v1", "PUBLISH", "Original publisher")];
    expect(resolveVersionPublisher("v1", audit)?.actorDisplayName).toBe("Original publisher");
    expect(resolveVersionRetirement("v1", audit)?.actorDisplayName).toBe("Retirer");
    expect(resolveVersionPublisher("missing", audit)).toBeNull();
  });
});
