import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { ActivityError } from '../../../../shared/widgets/activities/activities.model';
import { ActivityActor, canActOnActivity, isForbiddenError } from './operations-activities.model';

type Grants = Record<string, { all?: boolean; branchIds?: string[] }>;

function actorWith(grants: Grants, meId: string | null = 'u-me', isOwner = false): ActivityActor {
  return {
    meId,
    isOwner,
    can: (permission, scope) => {
      const grant = grants[permission];
      if (!grant) return false;
      if (!scope?.branchId) return true;
      return grant.all === true || (grant.branchIds ?? []).includes(scope.branchId);
    },
  };
}

const ownActivity = { branchId: 'br-1', assigneeUserId: 'u-me', createdByUserId: 'u-x' };
const othersActivity = { branchId: 'br-1', assigneeUserId: 'u-x', createdByUserId: 'u-y' };

describe('canActOnActivity (activity-authorizer assertActivityPermission + permission guard)', () => {
  it('lets the tenant owner act on anything and nobody act without a session', () => {
    expect(canActOnActivity(actorWith({}, 'u-me', true), 'complete', othersActivity)).toBe(true);
    expect(canActOnActivity(actorWith({ 'activities.complete': { all: true } }, null), 'complete', ownActivity)).toBe(false);
  });

  it('needs the base permission to pass the guard, even with <base>.all at the branch', () => {
    const onlyAll = actorWith({ 'activities.complete.all': { branchIds: ['br-1'] } });
    expect(canActOnActivity(onlyAll, 'complete', othersActivity)).toBe(false);
  });

  it('with <base>.all at the branch, acts on any activity there', () => {
    const grants = actorWith({ 'activities.cancel': { branchIds: ['br-9'] }, 'activities.cancel.all': { branchIds: ['br-1'] } });
    expect(canActOnActivity(grants, 'cancel', othersActivity)).toBe(true);
  });

  it('with only the base permission at the branch, acts on own (assigned or created) activities', () => {
    const grants = actorWith({ 'activities.complete': { branchIds: ['br-1'] } });
    expect(canActOnActivity(grants, 'complete', ownActivity)).toBe(true);
    expect(canActOnActivity(grants, 'complete', { ...othersActivity, createdByUserId: 'u-me' })).toBe(true);
    expect(canActOnActivity(grants, 'complete', othersActivity)).toBe(false);
    expect(canActOnActivity(grants, 'complete', { ...ownActivity, branchId: 'br-2' })).toBe(false);
  });
});

describe('isForbiddenError', () => {
  it('is true for any 403: MISSING_REQUIRED_PERMISSIONS and ACTIVITY_ACCESS_DENIED', () => {
    expect(isForbiddenError(new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS', { permissions: ['activities.read'] }))).toBe(true);
    expect(isForbiddenError(new ActivityError('ACTIVITY_ACCESS_DENIED'))).toBe(true);
  });

  it('is false for other errors', () => {
    expect(isForbiddenError(new ActivityError('ACTIVITY_NOT_FOUND'))).toBe(false);
    expect(isForbiddenError(new ApiError(503, 'ACTIVITY_TARGET_RESOLVER_UNAVAILABLE'))).toBe(false);
    expect(isForbiddenError(null)).toBe(false);
  });
});
