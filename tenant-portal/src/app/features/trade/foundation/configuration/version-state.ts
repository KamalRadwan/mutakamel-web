import type { ConfigVersion, EffectiveVersionState } from './configuration.model';

export type ComputedVersionState = EffectiveVersionState;

export type VersionStateTone = 'neutral' | 'brandSoft' | 'successSoft' | 'success' | 'muted';

export const VERSION_STATE_TONE: Record<ComputedVersionState, VersionStateTone> = {
  DRAFT: 'neutral',
  TESTED: 'brandSoft',
  SCHEDULED: 'successSoft',
  LIVE: 'success',
  ENDED: 'muted',
  REPLACED: 'muted',
  RETIRED: 'muted',
};

const BADGE_BASE =
  'inline-flex h-badge shrink-0 items-center justify-center rounded-8 px-8 text-12 font-medium whitespace-nowrap';

export const VERSION_STATE_BADGE: Record<ComputedVersionState, string> = {
  DRAFT: `${BADGE_BASE} bg-neutral-soft text-text`,
  TESTED: `${BADGE_BASE} bg-brand-soft text-on-brand-soft`,
  SCHEDULED: `${BADGE_BASE} bg-success-soft text-on-success-soft`,
  LIVE: `${BADGE_BASE} bg-success text-on-success`,
  ENDED: `${BADGE_BASE} bg-neutral-soft text-text-muted`,
  REPLACED: `${BADGE_BASE} bg-neutral-soft text-text-muted`,
  RETIRED: `${BADGE_BASE} bg-neutral-soft text-text-muted`,
};

function toMillis(value: Date | number | string): number {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  return Date.parse(value);
}

export function versionState(
  v: Pick<ConfigVersion, 'status' | 'effectiveFrom' | 'effectiveTo' | 'supersededAt'>,
  now: Date | number | string = new Date(),
): ComputedVersionState {
  switch (v.status) {
    case 'DRAFT':
    case 'APPROVAL_PENDING':
      return 'DRAFT';
    case 'TESTED':
      return 'TESTED';
    case 'SUPERSEDED':
      return 'REPLACED';
    case 'RETIRED':
      return 'RETIRED';
    case 'PUBLISHED':
    case 'SCHEDULED': {
      const nowMs = toMillis(now);
      if (v.supersededAt !== null && Date.parse(v.supersededAt) <= nowMs) {
        return 'REPLACED';
      }
      if (Date.parse(v.effectiveFrom) > nowMs) {
        return 'SCHEDULED';
      }
      if (v.effectiveTo !== null && Date.parse(v.effectiveTo) <= nowMs) {
        return 'ENDED';
      }
      return 'LIVE';
    }
  }
}

export function isPendingReplacement(
  v: Pick<ConfigVersion, 'effectiveState' | 'supersededAt'>,
  now: Date | number | string = new Date(),
): boolean {
  if ((v.effectiveState !== 'LIVE' && v.effectiveState !== 'REPLACED') || v.supersededAt === null) {
    return false;
  }
  return Date.parse(v.supersededAt) > toMillis(now);
}
