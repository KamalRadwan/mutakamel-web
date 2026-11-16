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

const NOW_MS = Date.parse("2026-11-01T12:00:00.000Z");

describe("version-temporal", () => {
  it("treats SCHEDULED whose effectiveFrom <= now as EFFECTIVE_NOW and future SCHEDULED as UPCOMING", () => {
    const dueScheduled = deriveVersionTemporalState(
      {
        id: "0195b5d0-0000-7000-8000-000000000001",
        versionNumber: 2,
        status: "SCHEDULED",
        effectiveFrom: "2026-11-01T08:00:00.000Z",
        effectiveTo: null,
        supersededAt: null,
      },
      NOW_MS,
    );
    expect(dueScheduled.isEffectiveNow).toBe(true);
    expect(dueScheduled.kind).toBe("EFFECTIVE_NOW");

    const futureScheduled = deriveVersionTemporalState(
      {
        id: "0195b5d0-0000-7000-8000-000000000002",
        versionNumber: 3,
        status: "SCHEDULED",
        effectiveFrom: "2026-12-01T00:00:00.000Z",
        effectiveTo: null,
        supersededAt: null,
      },
      NOW_MS,
    );
    expect(futureScheduled.isEffectiveNow).toBe(false);
    expect(futureScheduled.kind).toBe("UPCOMING");
  });

  it("distinguishes WILL_BE_REPLACED, REPLACED, ENDED, and RETIRED using half-open [effectiveFrom, COALESCE(supersededAt, effectiveTo))", () => {
    const willBeReplaced = deriveVersionTemporalState(
      {
        id: "v1",
        versionNumber: 1,
        status: "PUBLISHED",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
        effectiveTo: null,
        supersededAt: "2026-12-01T00:00:00.000Z",
      },
      NOW_MS,
    );
    expect(willBeReplaced.isEffectiveNow).toBe(true);
    expect(willBeReplaced.kind).toBe("WILL_BE_REPLACED");
    expect(willBeReplaced.willBeReplacedAt).toBe("2026-12-01T00:00:00.000Z");

    // Exact cutoff timestamp is half-open exclusive: now === supersededAt means REPLACED
    const replacedAtBoundary = deriveVersionTemporalState(
      {
        id: "v1",
        versionNumber: 1,
        status: "PUBLISHED",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
        effectiveTo: null,
        supersededAt: "2026-11-01T12:00:00.000Z",
      },
      NOW_MS,
    );
    expect(replacedAtBoundary.isEffectiveNow).toBe(false);
    expect(replacedAtBoundary.kind).toBe("REPLACED");

    const ended = deriveVersionTemporalState(
      {
        id: "v0",
        versionNumber: 0,
        status: "PUBLISHED",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
        effectiveTo: "2026-10-01T00:00:00.000Z",
        supersededAt: null,
      },
      NOW_MS,
    );
    expect(ended.kind).toBe("ENDED");

    const retired = deriveVersionTemporalState(
      {
        id: "v-ret",
        versionNumber: 4,
        status: "RETIRED",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
        effectiveTo: null,
      },
      NOW_MS,
    );
    expect(retired.isEffectiveNow).toBe(false);
    expect(retired.kind).toBe("RETIRED");
  });

  it("selects effective-now version by default before newer drafts", () => {
    const versions: TemporalVersionInput[] = [
      {
        id: "v1-pub",
        versionNumber: 1,
        status: "PUBLISHED",
        effectiveFrom: "2026-06-01T00:00:00.000Z",
        effectiveTo: null,
      },
      {
        id: "v2-draft",
        versionNumber: 2,
        status: "DRAFT",
        effectiveFrom: "2026-12-01T00:00:00.000Z",
        effectiveTo: null,
      },
    ];
    expect(selectDefaultTimelineVersion(versions, NOW_MS)?.id).toBe("v1-pub");
  });

  it("blocks retroactive supersession when target effectiveFrom < now and resolves overlap when supersedesVersionId is chosen", () => {
    const activeV1: TemporalVersionInput = {
      id: "0195b5d0-0000-7000-8000-000000000010",
      versionNumber: 1,
      status: "PUBLISHED",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      effectiveTo: null,
      supersededAt: null,
    };

    const retroactiveCheck = eligiblePredecessorVersions(
      [activeV1],
      { id: "target-past", effectiveFrom: "2026-10-15T00:00:00.000Z" },
      NOW_MS,
    );
    expect(retroactiveCheck.retroactiveBlocked).toBe(true);
    expect(retroactiveCheck.candidates).toHaveLength(1);
    expect(retroactiveCheck.eligible).toHaveLength(0);

    const futureTarget = {
      id: "target-future",
      effectiveFrom: "2026-12-01T00:00:00.000Z",
      effectiveTo: null,
    };
    const futureCheck = eligiblePredecessorVersions([activeV1], futureTarget, NOW_MS);
    expect(futureCheck.retroactiveBlocked).toBe(false);
    expect(futureCheck.eligible.map((v) => v.id)).toEqual([activeV1.id]);

    expect(findOverlappingActiveVersions([activeV1], futureTarget, null)).toHaveLength(1);
    expect(findOverlappingActiveVersions([activeV1], futureTarget, activeV1.id)).toHaveLength(0);
  });

  it("extracts publisher and retirement metadata from governance auditTrail", () => {
    const auditTrail: GovernanceAuditEvent[] = [
      {
        id: "ev-2",
        resourceVersion: 1, evidence: {},
        action: "RETIRE",
        resourceType: "PRICE_BOOK_VERSION",
        resourceId: "ver-1",
        actorUserId: "u-2",
        actorDisplayName: "Lina Checker",
        actorEmail: "lina@example.com",
        reason: "Replaced by Q4 tariff",
        occurredAt: "2026-11-01T11:00:00.000Z",
      },
      {
        id: "ev-1",
        resourceVersion: 1, evidence: {},
        action: "SOLO_OWNER_PUBLISH",
        resourceType: "PRICE_BOOK_VERSION",
        resourceId: "ver-1",
        actorUserId: "u-1",
        actorDisplayName: "Omar Owner",
        actorEmail: "omar@example.com",
        reason: "Solo owner verified",
        occurredAt: "2026-10-01T09:00:00.000Z",
      },
    ];
    expect(resolveVersionPublisher("ver-1", auditTrail)?.actorDisplayName).toBe("Omar Owner");
    expect(resolveVersionRetirement("ver-1", auditTrail)?.reason).toBe("Replaced by Q4 tariff");
  });
});
