import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError as CoreApiError, errorCodeOf as coreErrorCodeOf, errorMessage as coreErrorMessage } from '../../../../core/api/api-errors';
import { newIdempotencyKey as coreNewIdempotencyKey } from '../../../../core/api/idempotency';
import en from '../../../../../../public/i18n/staff/en.json';
import {
  addMembership,
  ApiError,
  errorCodeOf,
  staffErrorMessage,
  createBranch,
  createCompany,
  createRole,
  deleteBranch,
  deleteCompany,
  errorMessage,
  listAllPages,
  listBranches,
  listCompanies,
  listCurrencies,
  listDepartments,
  listMemberships,
  listPermissions,
  listRoles,
  listTeams,
  listUsers,
  newIdempotencyKey,
} from './staff.api';
import { fakeListCurrencies, resetStaffFake, setFakeActor, setFakeSeatCascade } from './staff.fake';

async function rejectsWith(promise: Promise<unknown>, status: number, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ status, code });
}

describe('staff api follows the Core tenant backend', () => {
  beforeEach(() => {
    resetStaffFake();
    setFakeActor('owner');
    setFakeSeatCascade(false);
  });

  afterAll(() => setFakeSeatCascade(false));

  it('GET currencies is paged; listCurrencies reads every page', async () => {
    const onePerPage = await listAllPages((q) => fakeListCurrencies(q), { limit: 1 });
    const all = await listCurrencies();
    expect(all.length).toBeGreaterThan(1);
    expect(all).toEqual(onePerPage);
  });

  it('paged lists arrive as a Core page { data, meta }', async () => {
    const all = await listUsers({ limit: 100 });
    const second = await listUsers({ page: 2, limit: 1 });
    expect(Object.keys(second).sort()).toEqual(['data', 'meta']);
    expect(second.data).toEqual([all.data[1]]);
    expect(second.meta).toEqual({
      page: 2,
      limit: 1,
      total: all.meta.total,
      totalPages: all.meta.total,
      hasNext: all.meta.total > 2,
      hasPrev: true,
    });
    for (const list of [listCompanies, listBranches, listDepartments, listTeams, listPermissions, listRoles]) {
      const page = await list({ limit: 1 });
      expect(Array.isArray(page.data)).toBe(true);
      expect(page.meta.page).toBe(1);
      expect(page.meta.limit).toBe(1);
      expect(page.meta.hasPrev).toBe(false);
    }
  });

  it('POST team-memberships returns the user full membership list', async () => {
    const before = await listMemberships('u-mona');
    const after = await addMembership('u-mona', { teamId: 'tm-alx', role: 'MEMBER' }, newIdempotencyKey());
    expect(after).toHaveLength(before.length + 1);
    expect(after.map((m) => m.id)).toEqual(expect.arrayContaining(before.map((m) => m.id)));
    expect(after.some((m) => m.teamId === 'tm-alx')).toBe(true);
  });

  it('DELETE company asks for the add-on cascade, then succeeds with confirmAddonCascade', async () => {
    const company = await createCompany({ code: 'CASCADE-CO', name: 'Cascade company' }, newIdempotencyKey());
    setFakeSeatCascade(true);
    await rejectsWith(deleteCompany(company.id, newIdempotencyKey()), 409, 'SEAT_ADDON_CASCADE_REQUIRED');
    await expect(deleteCompany(company.id, newIdempotencyKey(), { confirmAddonCascade: true })).resolves.toBeUndefined();
  });

  it('DELETE branch asks for the add-on cascade, then succeeds with confirmAddonCascade', async () => {
    const company = await createCompany({ code: 'CASCADE-BR', name: 'Cascade branches' }, newIdempotencyKey());
    await createBranch({ companyId: company.id, code: 'HQ', name: 'Head office', isHeadquarters: true }, newIdempotencyKey());
    const branch = await createBranch({ companyId: company.id, code: 'BR2', name: 'Second branch' }, newIdempotencyKey());
    setFakeSeatCascade(true);
    await rejectsWith(deleteBranch(branch.id, newIdempotencyKey()), 409, 'SEAT_ADDON_CASCADE_REQUIRED');
    await expect(deleteBranch(branch.id, newIdempotencyKey(), { confirmAddonCascade: true })).resolves.toBeUndefined();
  });

  it('a role created without a description has no description field', async () => {
    const role = await createRole({ name: 'No description role' }, newIdempotencyKey());
    expect(role.description).toBeUndefined();
  });

  it('maps COMMON.GENERIC.VALIDATION_FAILED to the shared validation text', () => {
    const t = (key: string) => (key === 'settings.errors.validation' ? 'Check the fields.' : key);
    expect(errorMessage('COMMON.GENERIC.VALIDATION_FAILED', 'companies', t)).toBe('Check the fields.');
  });
});

describe('Staff shared error plumbing', () => {
  it('re-exports the core helpers', () => {
    expect(ApiError).toBe(CoreApiError);
    expect(errorCodeOf).toBe(coreErrorCodeOf);
    expect(errorMessage).toBe(coreErrorMessage);
    expect(newIdempotencyKey).toBe(coreNewIdempotencyKey);
    expect(newIdempotencyKey()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(errorCodeOf({ status: 409, code: 'ORG_CODE_TAKEN' })).toBeNull();
  });

  const messages: Record<string, string> = {
    'staff.errors.notSaved': 'Not saved. Try again.',
    'staff.errors.generic': 'Something went wrong.',
    'companies.errors.ORG_CODE_TAKEN': 'Company code taken.',
    'staff.errors.ORG_CODE_TAKEN': 'Shared code taken.',
    'apiErrors.session': 'Session ended.',
    'apiErrors.generic': 'Try again.',
  };
  const t = (key: string) => messages[key] ?? key;

  it('staffErrorMessage uses notSaved for a 401 write and the core session fallback for a read', () => {
    const error = new ApiError(401, 'GW.AUTH.SESSION_REVOKED');
    expect(staffErrorMessage(error, 'companies', t, 'write')).toBe('Not saved. Try again.');
    expect(staffErrorMessage(error, 'companies', t)).toBe('Session ended.');
  });

  it.each(['GW.IDEM.MISSING', 'GW.IDEM.BAD_VALUE'])('staffErrorMessage treats %s as a generic bug', (code) => {
    expect(staffErrorMessage(new ApiError(400, code), 'companies', t)).toBe('Something went wrong.');
  });

  it('staffErrorMessage prefers the feature scope and passes details as params', () => {
    const details = { field: ['code'] };
    const translate = vi.fn(t);
    expect(staffErrorMessage(new ApiError(409, 'ORG_CODE_TAKEN', details), 'companies', translate)).toBe('Company code taken.');
    expect(translate).toHaveBeenCalledExactlyOnceWith('companies.errors.ORG_CODE_TAKEN', details);
  });

  it('staffErrorMessage falls back to shared Staff text and accepts a translator service', () => {
    expect(staffErrorMessage(new ApiError(409, 'ORG_CODE_TAKEN'), 'branches', { translate: t })).toBe('Shared code taken.');
  });

  it('staffErrorMessage resolves nested gateway keys from the Staff scope', () => {
    const translate = (key: string) => {
      let value: unknown = { staff: en };
      for (const part of key.split('.')) value = (value as Record<string, unknown> | undefined)?.[part];
      return typeof value === 'string' ? value : key;
    };
    expect(staffErrorMessage(new ApiError(409, 'GW.IDEM.IN_FLIGHT'), 'companies', translate)).toBe('Still saving. Wait a moment.');
  });

  it('staffErrorMessage delegates unknown codes to core fallbacks', () => {
    const error = new ApiError(500, 'UNKNOWN_CODE');
    expect(staffErrorMessage(error, 'companies', t)).toBe(coreErrorMessage(error, 'staff', t));
    expect(staffErrorMessage(error, 'companies', t)).toBe('Try again.');
  });

});
