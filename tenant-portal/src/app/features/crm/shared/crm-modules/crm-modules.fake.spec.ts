/**
 * Contract spec: the CRM modules fake against crm-app crm/settings
 * (CrmModulesController, CrmModulesService, UpdateCrmModulesDto).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../settings/shared/settings-api';
import {
  fakeCompanyOfBranch,
  fakeCrmModuleEnabled,
  fakeGetCrmModules,
  fakeSyncCrmModuleDefaults,
  fakeUpdateCompanyModules,
} from './crm-modules.fake';
import { CrmModuleOverride } from './crm-modules.model';

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

async function settleError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('expected the call to reject');
}

describe('crm-modules fake: contract', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    fakeSyncCrmModuleDefaults({ leadsEnabled: true, opportunitiesEnabled: true });
    vi.useRealTimers();
  });

  it('returns { revision, defaults, companies[] } with override and effective flags', async () => {
    const state = await settle(fakeGetCrmModules());
    expect(Object.keys(state).sort()).toEqual(['companies', 'defaults', 'revision']);
    expect(Object.keys(state.companies[0]).sort()).toEqual(
      ['code', 'companyId', 'effective', 'name', 'override', 'status'],
    );
  });

  it('answers a stale revision with 409 CRM_MODULE_SETTINGS_STALE and no details', async () => {
    const state = await settle(fakeGetCrmModules());
    const error = await settleError(
      fakeUpdateCompanyModules(state.companies[0].companyId, { leadsEnabled: false }, state.revision + 5),
    );
    expect([error.status, error.code, error.details]).toEqual([409, 'CRM_MODULE_SETTINGS_STALE', undefined]);
  });

  it('answers an unknown company with 404 CRM_COMPANY_NOT_FOUND', async () => {
    const state = await settle(fakeGetCrmModules());
    const error = await settleError(fakeUpdateCompanyModules('missing', {}, state.revision));
    expect([error.status, error.code]).toEqual([404, 'CRM_COMPANY_NOT_FOUND']);
  });

  it('validates the body before the revision with 400 CRM_VALIDATION_FAILED message arrays', async () => {
    const state = await settle(fakeGetCrmModules());
    const patch = { leadsEnabled: 'yes' } as unknown as Partial<CrmModuleOverride>;
    const error = await settleError(fakeUpdateCompanyModules(state.companies[0].companyId, patch, 0));
    expect([error.status, error.code]).toEqual([400, 'CRM_VALIDATION_FAILED']);
    expect(error.details).toEqual({
      expectedRevision: [expect.any(String)],
      leadsEnabled: [expect.any(String)],
    });
  });

  it('applies an override, bumps the revision and recomputes effective flags', async () => {
    const state = await settle(fakeGetCrmModules());
    const companyId = state.companies[0].companyId;
    const next = await settle(fakeUpdateCompanyModules(companyId, { leadsEnabled: false }, state.revision));
    expect(next.revision).toBe(state.revision + 1);
    const company = next.companies.find((item) => item.companyId === companyId)!;
    expect(company.override).toEqual({ leadsEnabled: false, opportunitiesEnabled: null });
    expect(company.effective.leadsEnabled).toBe(false);
    expect(fakeCrmModuleEnabled('leads', companyId)).toBe(false);
    const cleared = await settle(fakeUpdateCompanyModules(companyId, { leadsEnabled: null }, next.revision));
    expect(cleared.companies.find((item) => item.companyId === companyId)!.override.leadsEnabled).toBeNull();
  });

  it('maps a branch to its company and falls back to the defaults', () => {
    expect(fakeCompanyOfBranch('b1')).toBe('c1');
    expect(fakeCompanyOfBranch('b99')).toBeNull();
    fakeSyncCrmModuleDefaults({ leadsEnabled: false });
    expect(fakeCrmModuleEnabled('leads', null)).toBe(false);
  });
});
