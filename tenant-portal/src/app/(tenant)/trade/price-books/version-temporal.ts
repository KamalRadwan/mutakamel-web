import type { GovernanceAuditEvent } from "./pricing-contract";

export interface TemporalVersionInput {
  id: string;
  versionNumber: number;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  supersededAt?: string | null;
}

type VersionTemporalKind =
  | "EFFECTIVE_NOW"
  | "WILL_BE_REPLACED"
  | "UPCOMING"
  | "PLANNED_START"
  | "AUTHORING"
  | "REPLACED"
  | "ENDED"
  | "RETIRED";

export interface VersionTemporalState {
  isEffectiveNow: boolean;
  kind: VersionTemporalKind;
  cutoffAt: string | null;
  willBeReplacedAt: string | null;
}

/**
 * Mirrors `PricingService` temporal applicability (`pricing.service.ts` lines 222–226):
 * `[effectiveFrom, COALESCE(supersededAt, effectiveTo))` across both `PUBLISHED` and
 * `SCHEDULED` versions, because no background job flips `SCHEDULED` to `PUBLISHED`.
 */
export function deriveVersionTemporalState(
  version: TemporalVersionInput,
  nowMs: number = Date.now(),
): VersionTemporalState {
  const cutoffAt = version.supersededAt ?? version.effectiveTo ?? null;
  if (version.status === "RETIRED") {
    return {
      isEffectiveNow: false,
      kind: "RETIRED",
      cutoffAt,
      willBeReplacedAt: null,
    };
  }

  const startsAtMs = Date.parse(version.effectiveFrom);
  const cutoffMs = cutoffAt ? Date.parse(cutoffAt) : null;

  if (version.status === "PUBLISHED" || version.status === "SCHEDULED") {
    const isEffectiveNow =
      !Number.isNaN(startsAtMs) &&
      startsAtMs <= nowMs &&
      (cutoffMs === null || (!Number.isNaN(cutoffMs) && nowMs < cutoffMs));

    if (isEffectiveNow) {
      const supMs = version.supersededAt ? Date.parse(version.supersededAt) : NaN;
      if (version.supersededAt && !Number.isNaN(supMs) && supMs > nowMs) {
        return {
          isEffectiveNow: true,
          kind: "WILL_BE_REPLACED",
          cutoffAt,
          willBeReplacedAt: version.supersededAt,
        };
      }
      return {
        isEffectiveNow: true,
        kind: "EFFECTIVE_NOW",
        cutoffAt,
        willBeReplacedAt: null,
      };
    }

    if (!Number.isNaN(startsAtMs) && startsAtMs > nowMs) {
      return {
        isEffectiveNow: false,
        kind: "UPCOMING",
        cutoffAt,
        willBeReplacedAt: null,
      };
    }

    return {
      isEffectiveNow: false,
      kind: version.supersededAt ? "REPLACED" : "ENDED",
      cutoffAt,
      willBeReplacedAt: null,
    };
  }

  return {
    isEffectiveNow: false,
    kind: !Number.isNaN(startsAtMs) && startsAtMs > nowMs ? "PLANNED_START" : "AUTHORING",
    cutoffAt,
    willBeReplacedAt: null,
  };
}

export function selectDefaultTimelineVersion<T extends TemporalVersionInput>(
  versions: readonly T[],
  nowMs: number = Date.now(),
): T | null {
  if (versions.length === 0) return null;
  const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

  const effectiveNow = sorted.find((v) => deriveVersionTemporalState(v, nowMs).isEffectiveNow);
  if (effectiveNow) return effectiveNow;

  const actionable = sorted.find(
    (v) => v.status === "TESTED" || v.status === "DRAFT" || v.status === "SCHEDULED",
  );
  return actionable ?? sorted[0] ?? null;
}

export interface PredecessorEligibilityResult<T extends TemporalVersionInput> {
  candidates: T[];
  eligible: T[];
  retroactiveBlocked: boolean;
}

/**
 * Mirrors `PricingService.publishVersion` (`pricing.service.ts` lines 1590–1606).
 */
export function eligiblePredecessorVersions<T extends TemporalVersionInput>(
  versions: readonly T[],
  target: Pick<TemporalVersionInput, "id" | "effectiveFrom">,
  nowMs: number = Date.now(),
): PredecessorEligibilityResult<T> {
  const targetStartMs = Date.parse(target.effectiveFrom);
  if (Number.isNaN(targetStartMs)) {
    return { candidates: [], eligible: [], retroactiveBlocked: false };
  }
  const retroactiveBlocked = targetStartMs < nowMs;
  const candidates = versions.filter((candidate) => {
    if (candidate.id === target.id) return false;
    if (candidate.status !== "PUBLISHED" && candidate.status !== "SCHEDULED") return false;
    if (candidate.supersededAt != null) return false;
    const candidateStartMs = Date.parse(candidate.effectiveFrom);
    if (Number.isNaN(candidateStartMs) || candidateStartMs >= targetStartMs) return false;
    if (candidate.effectiveTo != null) {
      const candidateEndMs = Date.parse(candidate.effectiveTo);
      if (!Number.isNaN(candidateEndMs) && candidateEndMs < targetStartMs) return false;
    }
    return true;
  });

  return {
    candidates,
    eligible: retroactiveBlocked ? [] : candidates,
    retroactiveBlocked,
  };
}

/**
 * Mirrors overlap query in `PricingService.publishVersion` (`pricing.service.ts` lines 1612–1626).
 */
export function findOverlappingActiveVersions<T extends TemporalVersionInput>(
  versions: readonly T[],
  target: Pick<TemporalVersionInput, "id" | "effectiveFrom" | "effectiveTo">,
  supersedesVersionId?: string | null,
): T[] {
  const targetStartMs = Date.parse(target.effectiveFrom);
  if (Number.isNaN(targetStartMs)) return [];
  const targetEndMs = target.effectiveTo ? Date.parse(target.effectiveTo) : Number.POSITIVE_INFINITY;

  return versions.filter((candidate) => {
    if (candidate.id === target.id) return false;
    if (candidate.status !== "PUBLISHED" && candidate.status !== "SCHEDULED") return false;
    const candidateStartMs = Date.parse(candidate.effectiveFrom);
    if (Number.isNaN(candidateStartMs)) return false;

    const effectiveCutoffIso =
      supersedesVersionId && candidate.id === supersedesVersionId
        ? target.effectiveFrom
        : (candidate.supersededAt ?? candidate.effectiveTo ?? null);
    const candidateEndMs = effectiveCutoffIso
      ? Date.parse(effectiveCutoffIso)
      : Number.POSITIVE_INFINITY;

    return candidateStartMs < targetEndMs && candidateEndMs > targetStartMs;
  });
}

export interface AuditActorSnapshot {
  action: string;
  actorDisplayName: string | null;
  actorEmail: string | null;
  occurredAt: string;
  reason: string | null;
}

const PUBLISH_ACTIONS = new Set([
  "PUBLISH",
  "SOLO_OWNER_PUBLISH",
  "SCHEDULE",
  "SOLO_OWNER_SCHEDULE",
]);

export function resolveVersionPublisher(
  versionId: string,
  auditTrail: readonly GovernanceAuditEvent[] | undefined,
): AuditActorSnapshot | null {
  if (!auditTrail) return null;
  const match = auditTrail.find(
    (ev) => ev.resourceId === versionId && PUBLISH_ACTIONS.has(ev.action),
  );
  if (!match) return null;
  return {
    action: match.action,
    actorDisplayName: match.actorDisplayName,
    actorEmail: match.actorEmail,
    occurredAt: match.occurredAt,
    reason: match.reason,
  };
}

export function resolveVersionRetirement(
  versionId: string,
  auditTrail: readonly GovernanceAuditEvent[] | undefined,
): AuditActorSnapshot | null {
  if (!auditTrail) return null;
  const match = auditTrail.find(
    (ev) => ev.resourceId === versionId && ev.action === "RETIRE",
  );
  if (!match) return null;
  return {
    action: match.action,
    actorDisplayName: match.actorDisplayName,
    actorEmail: match.actorEmail,
    occurredAt: match.occurredAt,
    reason: match.reason,
  };
}
