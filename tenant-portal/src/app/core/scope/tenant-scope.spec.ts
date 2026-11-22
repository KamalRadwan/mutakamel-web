import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
    for (const id of ['staff-a', 'staff-b']) sessionStorage.removeItem('tenant-staff-scope:' + id);
    status.set('signed-in');
    me.set(account('staff-a'));
    TestBed.configureTestingModule({
      providers: [{ provide: AuthSession, useValue: { status, me } }],
    });
    scope = TestBed.inject(TenantScopeState);
  });
  afterEach(() => {
    for (const id of ['staff-a', 'staff-b']) sessionStorage.removeItem('tenant-staff-scope:' + id);
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
});
