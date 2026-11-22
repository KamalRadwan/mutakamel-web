import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, fieldErrorsOf } from '../../../../core/api/api-errors';
import { getPolicy, putBranch, putCompany, putDefaults } from './duplicates.api';
import { BranchPatch, CompanyPatch, DefaultsPatch } from './duplicates.model';
import { resetsFromDetails } from './duplicates.policy';

/** Runs the fake timers to completion and returns (or rethrows) the settled result. */
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

async function errorOf(promise: Promise<unknown>): Promise<ApiError | undefined> {
  try {
    await settle(promise);
    return undefined;
  } catch (error) {
    return error instanceof ApiError ? error : undefined;
  }
}

async function revision(): Promise<number> {
  return (await settle(getPolicy())).revision;
}

const EG = '01950000-0000-7000-8000-000000000501';
const GT = '01950000-0000-7000-8000-000000000503';
const CAIRO_HQ = '01950000-0000-7000-8000-000000000601';
const ALEX = '01950000-0000-7000-8000-000000000602';
const MISSING = '01950000-0000-7000-8000-0000000009ff';

describe('duplicate policy contract (crm settings/duplicate-policy)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe('GET settings/duplicate-policy', () => {
    it('returns the bare policy tree', async () => {
      const tree = await settle(getPolicy());
      expect(tree).toEqual({
        revision: 1,
        truncated: false,
        defaults: {
          allowAcrossUsers: false,
          allowAcrossBranches: false,
          allowAcrossCompanies: false,
          checkEmail: true,
          checkPhone: true,
          checkWhatsapp: true,
        },
        companies: expect.any(Array),
      });
      const eg = tree.companies.find((company) => company.companyId === EG)!;
      expect(eg).toEqual({
        companyId: EG,
        code: 'EG',
        name: 'Mutakamel Egypt',
        status: 'ACTIVE',
        override: { allowAcrossUsers: null, allowAcrossBranches: true, allowAcrossCompanies: true },
        effective: { u: false, b: true, c: true },
        limits: {},
        branches: expect.any(Array),
      });
      const cairo = eg.branches.find((branch) => branch.branchId === CAIRO_HQ)!;
      expect(cairo.override).toEqual({ allowAcrossUsers: true, allowAcrossBranches: null });
      expect(cairo.effective).toEqual({ u: true, b: true, c: true });
    });

    it('returns a copy, so editing the result never changes the store', async () => {
      const first = await settle(getPolicy());
      first.defaults.checkEmail = false;
      first.companies.length = 0;
      const second = await settle(getPolicy());
      expect(second.defaults.checkEmail).toBe(true);
      expect(second.companies.length).toBeGreaterThan(0);
    });
  });

  describe('PUT settings/duplicate-policy/defaults', () => {
    it('saves the patch, bumps the revision and returns the tree with no resets', async () => {
      const current = await revision();
      const result = await settle(putDefaults({ checkEmail: false }, current));
      expect(result.revision).toBe(current + 1);
      expect(result.defaults.checkEmail).toBe(false);
      expect(result.resets).toEqual([]);
      expect(await revision()).toBe(current + 1);
    });

    it('answers a stale revision with 409 CRM_DUPLICATE_POLICY_STALE', async () => {
      const current = await revision();
      const error = await errorOf(putDefaults({ checkPhone: false }, current + 3));
      expect(error?.status).toBe(409);
      expect(error?.code).toBe('CRM_DUPLICATE_POLICY_STALE');
      expect(await revision()).toBe(current);
    });

    // Backend duplicate-policy.service.ts: ConflictException({ code: 'CRM_DUPLICATE_POLICY_STALE' }) has no details.
    it('the stale 409 carries no details', async () => {
      const error = await errorOf(putDefaults({ checkPhone: false }, (await revision()) + 3));
      expect(error?.details).toBeUndefined();
    });

    it('answers a non-positive expectedRevision with 400 CRM_VALIDATION_FAILED', async () => {
      const error = await errorOf(putDefaults({ checkPhone: false }, 0));
      expect(error?.status).toBe(400);
      expect(error?.code).toBe('CRM_VALIDATION_FAILED');
    });

    it('the expectedRevision 400 has details keyed by expectedRevision', async () => {
      const error = await errorOf(putDefaults({ checkPhone: false }, 0));
      expect(Object.keys(fieldErrorsOf(error))).toEqual(['expectedRevision']);
    });

    it('answers a non-boolean switch with 400 CRM_VALIDATION_FAILED naming the field', async () => {
      const error = await errorOf(
        putDefaults({ checkPhone: null } as unknown as DefaultsPatch, await revision()),
      );
      expect(error?.status).toBe(400);
      expect(error?.code).toBe('CRM_VALIDATION_FAILED');
      expect(Object.keys(fieldErrorsOf(error))).toEqual(['checkPhone']);
    });

    // AGENTS.md: details are keyed by field path with string-array messages.
    it('validation details are keyed by field path with string arrays', async () => {
      const error = await errorOf(
        putDefaults({ checkPhone: null } as unknown as DefaultsPatch, await revision()),
      );
      expect(error?.details).toEqual({ checkPhone: expect.arrayContaining([expect.any(String)]) });
    });

    it('answers a switch that breaks U => B => C with 422 CRM_DUPLICATE_POLICY_CONFLICT', async () => {
      const error = await errorOf(putDefaults({ allowAcrossBranches: true }, await revision()));
      expect(error?.status).toBe(422);
      expect(error?.code).toBe('CRM_DUPLICATE_POLICY_CONFLICT');
    });

    // Backend: details { switch: [key], reason: ['chain'] } (string arrays, lowercase reason).
    it('the conflict details are { switch: ["b"], reason: ["chain"] }', async () => {
      const error = await errorOf(putDefaults({ allowAcrossBranches: true }, await revision()));
      expect(error?.details).toEqual({ switch: ['b'], reason: ['chain'] });
    });
  });

  describe('PUT settings/duplicate-policy/branches/:branchId', () => {
    it('saves a branch override and recomputes its effective switches', async () => {
      const current = await revision();
      const result = await settle(putBranch(ALEX, { allowAcrossUsers: true }, current));
      expect(result.revision).toBe(current + 1);
      expect(result.resets).toEqual([]);
      const branch = result.companies.flatMap((company) => company.branches).find((item) => item.branchId === ALEX)!;
      expect(branch.override).toEqual({ allowAcrossUsers: true, allowAcrossBranches: null });
      expect(branch.effective).toEqual({ u: true, b: true, c: true });
    });

    it('rejects allowAcrossCompanies on a branch with 400 CRM_VALIDATION_FAILED', async () => {
      const error = await errorOf(
        putBranch(ALEX, { allowAcrossCompanies: true } as unknown as BranchPatch, await revision()),
      );
      expect(error?.status).toBe(400);
      expect(error?.code).toBe('CRM_VALIDATION_FAILED');
      expect(Object.keys(fieldErrorsOf(error))).toEqual(['allowAcrossCompanies']);
    });

    it('answers an unknown branch with 404 CRM_BRANCH_NOT_FOUND', async () => {
      const error = await errorOf(putBranch(MISSING, { allowAcrossUsers: null }, await revision()));
      expect(error?.status).toBe(404);
      expect(error?.code).toBe('CRM_BRANCH_NOT_FOUND');
    });
  });

  describe('PUT settings/duplicate-policy/companies/:companyId', () => {
    it('answers an unknown company with 404 CRM_COMPANY_NOT_FOUND', async () => {
      const error = await errorOf(putCompany(MISSING, { allowAcrossUsers: null }, await revision()));
      expect(error?.status).toBe(404);
      expect(error?.code).toBe('CRM_COMPANY_NOT_FOUND');
    });

    it('answers a value that is not true, false or null with 400 CRM_VALIDATION_FAILED', async () => {
      const error = await errorOf(
        putCompany(EG, { allowAcrossUsers: 'yes' } as unknown as CompanyPatch, await revision()),
      );
      expect(error?.status).toBe(400);
      expect(error?.code).toBe('CRM_VALIDATION_FAILED');
      expect(Object.keys(fieldErrorsOf(error))).toEqual(['allowAcrossUsers']);
    });

    it('answers a company switch that breaks the chain with 422 CRM_DUPLICATE_POLICY_CONFLICT', async () => {
      const error = await errorOf(putCompany(GT, { allowAcrossBranches: true }, await revision()));
      expect(error?.status).toBe(422);
      expect(error?.code).toBe('CRM_DUPLICATE_POLICY_CONFLICT');
    });

    it('asks to confirm child resets with 409 CRM_DUPLICATE_POLICY_RESETS_REQUIRED, then applies them', async () => {
      const current = await revision();
      const ask = await errorOf(putCompany(EG, { allowAcrossBranches: false }, current));
      expect(ask?.status).toBe(409);
      expect(ask?.code).toBe('CRM_DUPLICATE_POLICY_RESETS_REQUIRED');
      expect(await revision()).toBe(current);

      const result = await settle(putCompany(EG, { allowAcrossBranches: false }, current, true));
      expect(result.revision).toBe(current + 1);
      expect(result.resets).toEqual(
        expect.arrayContaining([{ scopeType: 'BRANCH', id: CAIRO_HQ, name: 'Cairo HQ', switch: 'u' }]),
      );
      const eg = result.companies.find((company) => company.companyId === EG)!;
      expect(eg.override.allowAcrossBranches).toBe(false);
      expect(eg.effective.b).toBe(false);
      const cairo = eg.branches.find((branch) => branch.branchId === CAIRO_HQ)!;
      expect(cairo.override.allowAcrossUsers).toBeNull();
      expect(cairo.effective.u).toBe(false);
    });

    // Backend: details are parallel string arrays scopeType (lowercase), id, name and switch.
    it('the resets 409 details are parallel string arrays', async () => {
      const current = await revision();
      await settle(putCompany(EG, { allowAcrossBranches: true }, current, true));
      await settle(putBranch(CAIRO_HQ, { allowAcrossUsers: true }, current + 1));
      const error = await errorOf(putCompany(EG, { allowAcrossBranches: false }, current + 2));
      expect(error?.code).toBe('CRM_DUPLICATE_POLICY_RESETS_REQUIRED');
      expect(error?.details).toEqual({
        scopeType: expect.arrayContaining(['branch']),
        id: expect.arrayContaining([CAIRO_HQ]),
        name: expect.arrayContaining(['Cairo HQ']),
        switch: expect.arrayContaining(['u']),
      });
    });
  });
  describe('backend order and wire shapes', () => {
    it('sends exact path-keyed constraint names', async () => {
      const current = await revision();
      const nullDefault = await errorOf(putDefaults({ checkPhone: null } as unknown as DefaultsPatch, current));
      expect(nullDefault?.details).toEqual({ checkPhone: ['is_boolean'] });
      const revisionZero = await errorOf(putDefaults({ checkPhone: false }, 0));
      expect(revisionZero?.details).toEqual({ expectedRevision: ['min'] });
      const branchC = await errorOf(putBranch(ALEX, { allowAcrossCompanies: true } as unknown as BranchPatch, current));
      expect(branchC?.details).toEqual({ allowAcrossCompanies: ['whitelist_validation'] });
    });

    it('runs the validation pipe before the revision check', async () => {
      const error = await errorOf(putCompany(MISSING, { allowAcrossUsers: 'x' } as unknown as CompanyPatch, 9999));
      expect(error?.status).toBe(400);
    });

    it('checks the revision before the company or branch lookup', async () => {
      const current = await revision();
      const company = await errorOf(putCompany(MISSING, { allowAcrossUsers: null }, current + 5));
      expect(company?.code).toBe('CRM_DUPLICATE_POLICY_STALE');
      const branch = await errorOf(putBranch(MISSING, { allowAcrossUsers: null }, current + 5));
      expect(branch?.code).toBe('CRM_DUPLICATE_POLICY_STALE');
    });

    it('accepts an inherit (null) on a company switch and treats undefined as untouched', async () => {
      const current = await revision();
      const result = await settle(putCompany(GT, { allowAcrossUsers: null, allowAcrossBranches: undefined }, current));
      const gt = result.companies.find((company) => company.companyId === GT)!;
      expect(gt.override).toEqual({ allowAcrossUsers: null, allowAcrossBranches: null, allowAcrossCompanies: null });
    });
  });

  describe('resetsFromDetails', () => {
    it('zips the parallel arrays and uppercases the scope type', () => {
      expect(
        resetsFromDetails({
          scopeType: ['company', 'branch'],
          id: [EG, CAIRO_HQ],
          name: ['Mutakamel Egypt', 'Cairo HQ'],
          switch: ['b', 'u'],
        }),
      ).toEqual([
        { scopeType: 'COMPANY', id: EG, name: 'Mutakamel Egypt', switch: 'b' },
        { scopeType: 'BRANCH', id: CAIRO_HQ, name: 'Cairo HQ', switch: 'u' },
      ]);
    });

    it('skips unknown entries and returns [] without details', () => {
      expect(resetsFromDetails(undefined)).toEqual([]);
      expect(
        resetsFromDetails({ scopeType: ['tenant', 'branch'], id: ['a', 'b'], name: ['A', 'B'], switch: ['b', 'c'] }),
      ).toEqual([]);
      expect(resetsFromDetails({ resets: [{ scopeType: 'BRANCH' }] })).toEqual([]);
    });
  });
});
