import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import type { Me } from '../../staff/shared/staff.model';
import { setFakeActorOverride } from '../shared/fake-actor';


import { newIdempotencyKey } from '../../staff/shared/staff.api';
import { resetStaffFake } from '../../staff/shared/staff.fake';
import {
  fakeAssignAddon,
  fakeListAddonAssignments,
  fakeListAddonOptions,
  fakeRemoveAddon,
  resetAddonSeatsFake,
  setFakeAddonLocalState,
} from './addon-seats.fake';

async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected an ApiError');
}

function scopedActor(scopes: Me['permissionScopes']): Me {
  return {
    id: 'u-test',
    firstName: 'Test',
    lastName: 'Actor',
    isTenantOwner: false,
    permissions: Object.keys(scopes),
    permissionScopes: scopes,
  };
}

const HOMES_SELECTION = '0195a000-0000-7000-8000-000000000201';

describe('addon seats fake (Core application-access contract)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setFakeActorOverride(null);
    resetStaffFake();
    resetAddonSeatsFake();
  });

  afterEach(() => {
    vi.useRealTimers();
    setFakeActorOverride(null);
  });

  it('returns the paged envelope { data, meta } with totalPages 0 for an empty list', async () => {
    const page = await settle(fakeListAddonAssignments('u-hany', 1, 20));
    expect(Object.keys(page).sort()).toEqual(['data', 'meta']);
    if (page.data.length === 0) {
      expect(page.meta).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false });
    } else {
      expect(page.meta.totalPages).toBe(Math.ceil(page.meta.total / 20));
    }
  });

  it('rejects page/limit outside the bounds with a detail-less CORE_VALIDATION_FAILED', async () => {
    const error = await failure(fakeListAddonOptions('u-mona', 1, 101));
    expect([error.status, error.code, error.details]).toEqual([400, 'CORE_VALIDATION_FAILED', undefined]);
  });

  it('answers an unknown target with 403 ACCESS_POLICY_BLOCKED, not 404', async () => {
    const error = await failure(fakeListAddonAssignments('u-missing'));
    expect([error.status, error.code]).toEqual([403, 'ACCESS_POLICY_BLOCKED']);
  });

  it('sends MISSING_REQUIRED_PERMISSIONS when the actor has no addon seat grant', async () => {
    setFakeActorOverride(scopedActor({}));
    const error = await failure(fakeListAddonAssignments('u-mona'));
    expect([error.status, error.code]).toEqual([403, 'MISSING_REQUIRED_PERMISSIONS']);
    expect(error.details).toEqual({
      anyPermissions: ['applications.addon_seats.read', 'applications.addon_seats.manage'],
    });
  });

  it('blocks a branch-only grant with ACCESS_POLICY_BLOCKED', async () => {
    setFakeActorOverride(scopedActor({
      'applications.addon_seats.read': { tenantWide: false, companyIds: [], branchIds: ['br-cai'] },
    }));
    const error = await failure(fakeListAddonOptions('u-mona'));
    expect([error.status, error.code]).toEqual([403, 'ACCESS_POLICY_BLOCKED']);
  });

  it('requires a UUIDv7 idempotency key on writes', async () => {
    const error = await failure(
      fakeAssignAddon(
        'u-mona',
        { addonSelectionId: HOMES_SELECTION, expectedAllowanceRevision: '1', expectedParentAssignmentRevision: '1' },
        'not-a-key',
      ),
    );
    expect([error.status, error.code]).toEqual([400, 'INVALID_IDEMPOTENCY_KEY']);
  });

  it('treats an unknown addon selection as 409 APPLICATION_ALLOWANCE_NOT_READY', async () => {
    const error = await failure(
      fakeAssignAddon(
        'u-mona',
        {
          addonSelectionId: '0195a000-0000-7000-8000-00000000ffff',
          expectedAllowanceRevision: '1',
          expectedParentAssignmentRevision: '1',
        },
        newIdempotencyKey(),
      ),
    );
    expect([error.status, error.code]).toEqual([409, 'APPLICATION_ALLOWANCE_NOT_READY']);
  });

  it('checks allowance readiness before the CAS revisions', async () => {
    setFakeAddonLocalState('crm.homes', { addonDenied: true });
    const error = await failure(
      fakeAssignAddon(
        'u-mona',
        { addonSelectionId: HOMES_SELECTION, expectedAllowanceRevision: '999', expectedParentAssignmentRevision: '1' },
        newIdempotencyKey(),
      ),
    );
    expect(error.code).toBe('APPLICATION_ALLOWANCE_NOT_READY');
  });

  it('replays a receipt for the same key and rejects a different body with 422', async () => {
    const options = await settle(fakeListAddonOptions('u-mona'));
    const option = options.data.find((item) => item.assignment !== null);
    expect(option).toBeDefined();
    if (!option || !option.parentAssignment) return;
    const key = newIdempotencyKey();
    const body = {
      addonSelectionId: option.addonSelectionId,
      expectedAllowanceRevision: option.allowanceRevision,
      expectedParentAssignmentRevision: option.parentAssignment.revision,
    };
    const first = await settle(fakeAssignAddon('u-mona', body, key));
    expect(first).toMatchObject({ state: 'COMMITTED', operationKind: 'ASSIGN_ADDON', changed: false });
    const replay = await settle(fakeAssignAddon('u-mona', body, key));
    expect(replay).toEqual(first);
    const mismatch = await failure(fakeAssignAddon('u-mona', { ...body, expectedAllowanceRevision: '7' }, key));
    expect([mismatch.status, mismatch.code]).toEqual([422, 'IDEMPOTENCY_BODY_MISMATCH']);
  });

  it('compares the post-removal revision when the assignment is already removed', async () => {
    const assignments = await settle(fakeListAddonAssignments('u-mona'));
    const row = assignments.data[0];
    expect(row).toBeDefined();
    if (!row) return;
    const query = {
      expectedAssignmentRevision: row.assignmentRevision,
      expectedAllowanceRevision: row.allowanceRevision,
    };
    const removed = await settle(fakeRemoveAddon('u-mona', row.assignmentId, query, newIdempotencyKey()));
    expect(removed).toMatchObject({ changed: true, resourceRevision: '2' });

    const stale = await failure(fakeRemoveAddon('u-mona', row.assignmentId, query, newIdempotencyKey()));
    expect([stale.status, stale.code]).toEqual([409, 'ADDON_ASSIGNMENT_REVISION_STALE']);

    const again = await settle(
      fakeRemoveAddon(
        'u-mona',
        row.assignmentId,
        { ...query, expectedAssignmentRevision: '2' },
        newIdempotencyKey(),
      ),
    );
    expect(again).toMatchObject({ changed: false, resourceRevision: '2' });
  });
});
