import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { setFakeActorOverride } from '../shared/fake-actor';


import { fakeGetDirectorySettings, fakeUpdateDirectorySettings, resetDirectorySettingsFake } from './directory-settings.fake';
import type { DirectorySettingsPatch } from './directory-settings.model';

type Actor = NonNullable<Parameters<typeof setFakeActorOverride>[0]>;

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

function scopedActor(scopes: Actor['permissionScopes']): Actor {
  return {
    id: 'u-test',
    firstName: 'Test',
    lastName: 'Actor',
    isTenantOwner: false,
    permissions: Object.keys(scopes),
    permissionScopes: scopes,
  };
}

describe('directory settings fake (Core directory contract)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setFakeActorOverride(null);
    resetDirectorySettingsFake();
  });

  afterEach(() => {
    vi.useRealTimers();
    setFakeActorOverride(null);
  });

  it('returns exactly the DirectorySettingsView fields', async () => {
    const settings = await settle(fakeGetDirectorySettings());
    expect(Object.keys(settings).sort()).toEqual(
      [
        'createdAt',
        'duplicateScope',
        'id',
        'maxAddressesPerParty',
        'maxContactMethodsPerParty',
        'preventDuplicateEmail',
        'preventDuplicatePhone',
        'preventDuplicateWhatsapp',
        'updatedAt',
        'version',
      ].sort(),
    );
  });

  it('keys validation details by field with snake_case constraints', async () => {
    const tooMany = await failure(fakeUpdateDirectorySettings({ maxContactMethodsPerParty: 201 }, '"1"'));
    expect([tooMany.status, tooMany.code, tooMany.details]).toEqual([
      400,
      'CORE_VALIDATION_FAILED',
      { maxContactMethodsPerParty: ['max'] },
    ]);
    const notInt = await failure(fakeUpdateDirectorySettings({ maxAddressesPerParty: 1.5 }, '"1"'));
    expect(notInt.details).toEqual({ maxAddressesPerParty: ['is_int'] });
    const notBool = await failure(
      fakeUpdateDirectorySettings({ preventDuplicateEmail: 'yes' } as unknown as DirectorySettingsPatch, '"1"'),
    );
    expect(notBool.details).toEqual({ preventDuplicateEmail: ['is_boolean'] });
    const unknown = await failure(
      fakeUpdateDirectorySettings({ version: 3 } as unknown as DirectorySettingsPatch, '"1"'),
    );
    expect(unknown.details).toEqual({ version: ['whitelist_validation'] });
  });

  it('sends MISSING_REQUIRED_PERMISSIONS without any grant and TENANT_WIDE_PERMISSION_REQUIRED for a branch grant', async () => {
    setFakeActorOverride(scopedActor({}));
    const missing = await failure(fakeGetDirectorySettings());
    expect([missing.status, missing.code, missing.details]).toEqual([
      403,
      'MISSING_REQUIRED_PERMISSIONS',
      { permissions: ['directory.settings.manage'] },
    ]);
    setFakeActorOverride(scopedActor({
      'directory.settings.manage': { tenantWide: false, companyIds: [], branchIds: ['br-cai'] },
    }));
    const branchOnly = await failure(fakeUpdateDirectorySettings({ preventDuplicatePhone: false }, '"1"'));
    expect([branchOnly.status, branchOnly.code]).toEqual([403, 'TENANT_WIDE_PERMISSION_REQUIRED']);
  });

  it('requires a version and rejects stale writes without changing the singleton', async () => {
    const missing = await failure(fakeUpdateDirectorySettings({}, undefined as unknown as string));
    expect([missing.status, missing.code]).toEqual([428, 'DIRECTORY_SETTINGS_VERSION_REQUIRED']);
    await settle(fakeUpdateDirectorySettings({ maxAddressesPerParty: 5 }, '"1"'));
    const stale = await failure(fakeUpdateDirectorySettings({ maxAddressesPerParty: 3 }, '"1"'));
    expect([stale.status, stale.code]).toEqual([409, 'DIRECTORY_SETTINGS_VERSION_CONFLICT']);
    expect(await settle(fakeGetDirectorySettings())).toMatchObject({ maxAddressesPerParty: 5, version: 2 });
  });

  it('saves a valid patch', async () => {
    const saved = await settle(fakeUpdateDirectorySettings({ duplicateScope: 'BRANCH', maxAddressesPerParty: 5 }, '"1"'));
    expect(saved).toMatchObject({ duplicateScope: 'BRANCH', maxAddressesPerParty: 5, version: 2 });
  });
});
