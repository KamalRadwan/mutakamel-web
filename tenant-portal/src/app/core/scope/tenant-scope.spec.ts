import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthSession } from '../auth/auth-session';
import { FAKE_TENANT_ME } from '../auth/auth-session.fake';
import type { SessionStatus, TenantMe } from '../auth/auth-session.model';
import { TenantScopeState } from './tenant-scope';

describe('Staff selector isolation', () => {
  const company = '019f0000-0000-7000-8000-000000000010';
  const branchA = '019f0000-0000-7000-8000-000000000011';
  const branchB = '019f0000-0000-7000-8000-000000000012';
  const me = signal<TenantMe | null>(null);
  const status = signal<SessionStatus>('signed-in');
  let scope: TenantScopeState;
  function account(id: string, branches = [branchA, branchB]): TenantMe {
    return {
      ...FAKE_TENANT_ME,
      id,
      isTenantOwner: false,
      permissions: [],
      permissionScopes: {},
      accessibleCompanies: [company],
      accessibleBranches: branches,
      accessibleBranchCompanies: branches.map((branchId) => ({ branchId, companyId: company })),
    };
  }
  beforeEach(() => {
    for (const id of ['staff-a', 'staff-b']) {
      sessionStorage.removeItem('tenant-staff-scope:' + id);
      localStorage.removeItem('tenant-staff-scope:' + id);
    }
    status.set('signed-in');
    me.set(account('staff-a'));
    TestBed.configureTestingModule({
      providers: [{ provide: AuthSession, useValue: { status, me } }],
    });
    scope = TestBed.inject(TenantScopeState);
    TestBed.tick();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    for (const id of ['staff-a', 'staff-b']) {
      sessionStorage.removeItem('tenant-staff-scope:' + id);
      localStorage.removeItem('tenant-staff-scope:' + id);
    }
  });

  it('restores the selected branch only for the same account and drops a revoked selection', () => {
    scope.selectBranch(branchB);
    expect(scope.selection()).toEqual({ companyId: company, branchId: branchB });
    const restored = TestBed.runInInjectionContext(() => new TenantScopeState());
    expect(restored.selection()).toEqual(scope.selection());
    me.set(account('staff-b'));
    expect(restored.selection()?.branchId).toBeNull();
    me.set(account('staff-a', [branchA]));
    expect(restored.selection()?.branchId).not.toBe(branchB);
    scope.selectBranch(branchB);
    expect(scope.selection()?.branchId).not.toBe(branchB);
  });

  it('excludes inaccessible or ambiguously parented branches in a partial /me response', () => {
    const partial = account('staff-a', [branchA]);
    me.set({
      ...partial,
      accessScope: { ...partial.accessScope, branchesTruncated: true },
      accessibleBranchCompanies: [
        { branchId: branchA, companyId: company },
        { branchId: branchA, companyId: 'other-company' },
        { branchId: branchB, companyId: company },
      ],
    });
    expect(scope.branchCompanies().has(branchA)).toBe(false);
    expect(scope.branchCompanies().has(branchB)).toBe(false);
    status.set('signed-out');
    expect(scope.selection()).toBeNull();
    expect(scope.selectorCompanyIds()).toEqual([]);
  });

  it('remembers each company branch without accepting a branch from another company', () => {
    const companyB = '019f0000-0000-7000-8000-000000000020';
    const branchC = '019f0000-0000-7000-8000-000000000021';
    const current = account('staff-a');
    me.set({
      ...current,
      accessibleCompanies: [company, companyB],
      accessibleBranches: [branchA, branchB, branchC],
      accessibleBranchCompanies: [
        ...current.accessibleBranchCompanies, { companyId: companyB, branchId: branchC },
      ],
    });
    scope.selectCompany(company);
    scope.selectBranch(branchB);
    scope.selectCompany(companyB);
    expect(scope.selection()).toEqual({ companyId: companyB, branchId: branchC });
    scope.selectBranch(branchB);
    expect(scope.selection()?.branchId).toBe(branchC);
    scope.selectCompany(company);
    expect(scope.selection()).toEqual({ companyId: company, branchId: branchB });
    scope.selectCompany('unavailable-company');
    expect(scope.selection()?.companyId).toBe(company);
  });

  it('copies the account preference once and keeps the current tab independent', () => {
    scope.selectBranch(branchA);
    localStorage.setItem('tenant-staff-scope:staff-a', JSON.stringify({ companyId: company, branchId: branchB }));
    const otherTabPreference = TestBed.runInInjectionContext(() => new TenantScopeState());
    expect(otherTabPreference.selection()?.branchId).toBe(branchA);
    sessionStorage.removeItem('tenant-staff-scope:staff-a');
    const freshTab = TestBed.runInInjectionContext(() => new TenantScopeState());
    expect(freshTab.selection()?.branchId).toBe(branchB);
    localStorage.setItem('tenant-staff-scope:staff-a', JSON.stringify({ companyId: company, branchId: branchA }));
    me.set({ ...account('staff-a') });
    expect(freshTab.selection()?.branchId).toBe(branchB);
    expect(scope.selection()?.branchId).toBe(branchA);
  });

  it('removes revoked selections so a later grant does not resurrect them', () => {
    scope.selectBranch(branchB);
    me.set(account('staff-a', [branchA]));
    expect(scope.selection()).toBeNull();
    TestBed.tick();
    me.set(account('staff-a'));
    expect(scope.selection()?.branchId).not.toBe(branchB);
    const restored = TestBed.runInInjectionContext(() => new TenantScopeState());
    expect(restored.selection()?.branchId).not.toBe(branchB);
  });

  it('clears the old account on logout and never restores it during another account session', () => {
    scope.selectBranch(branchB);
    status.set('signed-out');
    TestBed.tick();
    expect(scope.selection()).toBeNull();
    expect(sessionStorage.getItem('tenant-staff-scope:staff-a')).toBeNull();
    expect(localStorage.getItem('tenant-staff-scope:staff-a')).toBeNull();
    status.set('signed-in');
    me.set(account('staff-b'));
    TestBed.tick();
    expect(scope.selection()?.branchId).toBeNull();
    me.set(account('staff-a'));
    TestBed.tick();
    expect(scope.selection()?.branchId).toBeNull();
  });

  it('preserves a new account selection made before the old account cleanup runs', () => {
    scope.selectBranch(branchB);
    me.set(account('staff-b'));
    scope.selectBranch(branchA);
    TestBed.tick();
    expect(scope.selection()).toEqual({ companyId: company, branchId: branchA });
    expect(sessionStorage.getItem('tenant-staff-scope:staff-a')).toBeNull();
    expect(localStorage.getItem('tenant-staff-scope:staff-a')).toBeNull();
    expect(JSON.parse(sessionStorage.getItem('tenant-staff-scope:staff-b') ?? '{}').branchId).toBe(branchA);
  });

  it.each(['{invalid', 'null', '[]', '{"companyId":1,"branchId":null}', '{"companyId":"other","branchId":null}'])(
    'rejects malformed or inaccessible storage: %s', (value) => {
      sessionStorage.setItem('tenant-staff-scope:staff-b', value);
      me.set(account('staff-b'));
      expect(scope.selection()?.branchId).not.toBe(branchB);
      TestBed.tick();
      expect(scope.selectorCompanyIds()).toEqual([company]);
      expect(scope.selection()?.companyId).toBe(company);
    },
  );

  it('keeps a valid selection in memory when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    scope.selectBranch(branchB);
    expect(scope.selection()).toEqual({ companyId: company, branchId: branchB });
    status.set('signed-out');
    expect(() => TestBed.tick()).not.toThrow();
    expect(scope.selection()).toBeNull();
  });
});
