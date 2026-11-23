import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import { AuthSession } from '../../../../core/auth/auth-session';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { sessionBranch } from './session-branch';

const companyId = '019f0000-0000-7000-8000-000000000010';
const branchId = '019f0000-0000-7000-8000-000000000011';
const otherCompanyId = '019f0000-0000-7000-8000-000000000012';

describe.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('%s / %s', (lang, theme) => {
  describe('sessionBranch', () => {
    const me = signal<TenantMe | null>(null);
    const run = () => TestBed.runInInjectionContext(sessionBranch);
    let htmlAttributes: (string | null)[];

    beforeEach(() => {
      htmlAttributes = ['lang', 'dir', 'data-theme'].map((name) => document.documentElement.getAttribute(name));
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.dataset['theme'] = theme;
      sessionStorage.removeItem('tenant-staff-scope:xr-lk');
      me.set({ ...FAKE_TENANT_ME, id: 'xr-lk', accessibleCompanies: [companyId], accessibleBranches: [branchId],
        accessibleBranchCompanies: [{ branchId, companyId }] });
      TestBed.configureTestingModule({ providers: [{ provide: AuthSession, useValue: { me, status: () => 'signed-in' } }] });
    });

    afterEach(() => {
      ['lang', 'dir', 'data-theme'].forEach((name, i) => htmlAttributes[i] === null
        ? document.documentElement.removeAttribute(name) : document.documentElement.setAttribute(name, htmlAttributes[i]!));
      sessionStorage.removeItem('tenant-staff-scope:xr-lk');
    });

    it('no branch selected', () => {
      me.update((value) => ({ ...value!, accessibleBranches: [], accessibleBranchCompanies: [] }));
      expect(TestBed.inject(TenantScopeState).selection()).toEqual({ companyId, branchId: null });
      expect(run()).toBeNull();
    });

    it('ambiguous branch', () => {
      me.update((value) => ({ ...value!, accessibleBranchCompanies: [{ branchId, companyId }, { branchId, companyId: otherCompanyId }] }));
      expect(TestBed.inject(TenantScopeState).branchCompanies().has(branchId)).toBe(false);
      expect(run()).toBeNull();
    });

    it('returns the current branch and rejects non-v7 scope IDs', () => {
      expect(run()).toEqual({ companyId, branchId });
      me.update((value) => ({ ...value!, accessibleCompanies: ['fake-company'], accessibleBranches: ['fake-branch'],
        accessibleBranchCompanies: [{ branchId: 'fake-branch', companyId: 'fake-company' }] }));
      expect(run()).toBeNull();
    });
  });
});
