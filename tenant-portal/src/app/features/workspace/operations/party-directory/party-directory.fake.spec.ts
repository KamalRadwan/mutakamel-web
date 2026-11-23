import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { fakeActorMe, setFakeActorOverride } from '../shared/fake-actor';


import { resetDirectorySettingsFake } from '../directory-settings/directory-settings.fake';
import {
  fakeAddContactMethod,
  fakeAddRole,
  fakeCreateParty,
  fakeGetPartyRules,
  fakeGetParty,
  fakeListOrgContacts,
  fakeListParties,
  fakeUpdateParty,
} from './party-directory.fake';
import type { CreatePartyBody, ListPartiesQuery } from './party-directory.model';

type Me = ReturnType<typeof fakeActorMe>;

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

function branchScope(...branchIds: string[]) {
  return { tenantWide: false, companyIds: [], branchIds };
}

const NILE_DELTA_ID = '018f1000-0000-7000-8000-000000000001';
const SHARED_ORG_ID = '018f1000-0000-7000-8000-000000000011';

describe('party directory fake (Core directory contract)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setFakeActorOverride(null);
    resetDirectorySettingsFake();
  });

  afterEach(() => {
    vi.useRealTimers();
    setFakeActorOverride(null);
  });

  it('returns lists in the { data, meta } envelope', async () => {
    const page = await settle(fakeListParties({ page: 1, limit: 5 }));
    expect(Object.keys(page).sort()).toEqual(['data', 'meta']);
    expect(page.data.length).toBeLessThanOrEqual(5);
    expect(page.meta).toMatchObject({ page: 1, limit: 5, hasPrev: false });
    expect(page.meta.totalPages).toBe(Math.ceil(page.meta.total / 5));

    const contacts = await settle(fakeListOrgContacts(NILE_DELTA_ID));
    expect(Object.keys(contacts).sort()).toEqual(['data', 'meta']);
    const ids = contacts.data.map((row) => row.partyId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('rejects query fields the DTO does not declare, such as unknownFilter', async () => {
    const error = await failure(fakeListParties({ unknownFilter: true } as unknown as ListPartiesQuery));
    expect([error.status, error.code, error.details]).toEqual([
      400,
      'CORE_VALIDATION_FAILED',
      { unknownFilter: ['whitelist_validation'] },
    ]);
  });

  it('validates pagination instead of clamping it', async () => {
    const error = await failure(fakeListParties({ limit: 500, page: 0 }));
    expect(error.details).toEqual({ page: ['min'], limit: ['max'] });
  });

  it('keys body validation details by field path', async () => {
    const error = await failure(
      fakeCreateParty({
        partyType: 'PERSON',
        displayName: '   ',
        contactMethods: [{ methodType: 'EMAIL', value: '' }],
      } as CreatePartyBody),
    );
    expect(error.status).toBe(400);
    expect(error.code).toBe('CORE_VALIDATION_FAILED');
    expect(error.details).toEqual({
      displayName: ['is_not_empty'],
      'contactMethods.0.value': ['is_not_empty'],
    });
  });

  it('returns contact-value format errors as PARTY_CONTACT_VALUE_INVALID after the DTO passes', async () => {
    const error = await failure(fakeAddContactMethod(NILE_DELTA_ID, { methodType: 'EMAIL', value: 'not-an-email' }));
    expect([error.status, error.code]).toEqual([400, 'PARTY_CONTACT_VALUE_INVALID']);
  });

  it('sends MISSING_REQUIRED_PERMISSIONS with the permission list when no grant exists', async () => {
    setFakeActorOverride(scopedActor({}));
    const error = await failure(fakeGetParty(NILE_DELTA_ID));
    expect([error.status, error.code, error.details]).toEqual([
      403,
      'MISSING_REQUIRED_PERMISSIONS',
      { permissions: ['directory.party.read'] },
    ]);
  });

  it('needs tenant-wide manage for a shared party and branch manage for a branch party', async () => {
    setFakeActorOverride(scopedActor({
      'directory.party.read': branchScope('br-cai'),
      'directory.party.manage': branchScope('br-alx'),
    }));
    const shared = await failure(fakeUpdateParty(SHARED_ORG_ID, { displayName: 'Renamed' }));
    expect([shared.status, shared.code]).toEqual([403, 'TENANT_WIDE_PERMISSION_REQUIRED']);
    const branch = await failure(fakeUpdateParty(NILE_DELTA_ID, { displayName: 'Renamed' }));
    expect([branch.status, branch.code]).toEqual([403, 'BRANCH_PERMISSION_DENIED']);
  });

  it('checks the party write scope before the role branch when adding a role', async () => {
    setFakeActorOverride(scopedActor({
      'directory.role.manage': branchScope('br-alx'),
    }));
    const error = await failure(fakeAddRole(NILE_DELTA_ID, { roleType: 'SUPPLIER', branchId: 'br-alx' }));
    expect([error.status, error.code]).toEqual([403, 'BRANCH_PERMISSION_DENIED']);
  });

  it('stores role metadata as {} when none is sent', async () => {
    const created = await settle(
      fakeCreateParty({
        partyType: 'ORGANIZATION',
        displayName: `Spec Org ${Date.now()}`,
        roles: [{ roleType: 'SUPPLIER' }],
      }),
    );
    expect(created.roles[0]?.metadata).toEqual({});
    expect(created.roles[0]?.appSource).toBe('core-app');
  });

  it('reads the public party rules projection', async () => {
    const settings = await settle(fakeGetPartyRules());
    expect(settings.version).toBe(1);
    expect(settings.maxContactMethodsPerParty).toBeGreaterThan(0);
    expect(settings).not.toHaveProperty('id');
  });
});
