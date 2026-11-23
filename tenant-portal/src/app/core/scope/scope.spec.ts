import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthSession } from '../auth/auth-session';
import { FAKE_TENANT_ME } from '../auth/auth-session.fake';
import type { SessionStatus, TenantMe } from '../auth/auth-session.model';
import { ScopeState } from './scope';
import { TenantScopeState } from './tenant-scope';

describe('Authenticated scope compatibility facade', () => {
  const companyId = '019f0000-0000-7000-8000-000000000010';
  const branchA = '019f0000-0000-7000-8000-000000000011';
  const branchB = '019f0000-0000-7000-8000-000000000012';
  const storageKey = 'tenant-staff-scope:scope-facade-user';
  const status = signal<SessionStatus>('signed-in');
  const me = signal<TenantMe | null>(null);
  let scope: ScopeState;
  let tenant: TenantScopeState;

  beforeEach(() => {
    sessionStorage.removeItem(storageKey);
    localStorage.removeItem(storageKey);
    status.set('signed-in');
    me.set({
      ...FAKE_TENANT_ME,
      id: 'scope-facade-user',
      permissions: [],
      permissionScopes: {},
      accessibleCompanies: [companyId],
      accessibleBranches: [branchA, branchB],
      accessibleBranchCompanies: [branchA, branchB].map((branchId) => ({ branchId, companyId })),
    });
    TestBed.configureTestingModule({ providers: [{ provide: AuthSession, useValue: { status, me } }] });
    scope = TestBed.inject(ScopeState);
    tenant = TestBed.inject(TenantScopeState);
    TestBed.tick();
  });

  afterEach(() => {
    sessionStorage.removeItem(storageKey);
    localStorage.removeItem(storageKey);
    sessionStorage.removeItem('scope');
    localStorage.removeItem('scope');
  });

  it('shares the real company and branch selection in both directions', () => {
    expect(scope.company().id).toBe(companyId);
    expect(scope.branch().id).toBe('');
    scope.selectBranch(branchB);
    expect(tenant.selection()).toEqual({ companyId, branchId: branchB });
    tenant.selectBranch(branchA);
    expect(scope.branch().id).toBe(branchA);
    expect(scope.company().branches.map((branch) => branch.id)).toEqual([branchA, branchB]);
    scope.selectCompany('c1');
    scope.selectBranch('b1');
    expect(tenant.selection()).toEqual({ companyId, branchId: branchA });
  });

  it('ignores unowned legacy storage and leaves labels, currency and named options unavailable', () => {
    const legacy = JSON.stringify({ companyId: 'c1', branchByCompany: { c1: 'b1' } });
    sessionStorage.setItem('scope', legacy);
    localStorage.setItem('scope', legacy);
    const fresh = TestBed.runInInjectionContext(() => new ScopeState());
    expect(fresh.company().id).toBe(companyId);
    expect(fresh.company().nameEn).toBe('');
    expect(fresh.company().nameAr).toBe('');
    expect(fresh.company().currencyCode).toBeUndefined();
    expect(fresh.companies()).toEqual([]);
    expect(fresh.branches()).toEqual([]);
  });

  it('clears facade IDs immediately when access or the session is removed', () => {
    scope.selectBranch(branchB);
    const current = me();
    if (!current) throw new Error('Missing test identity');
    me.set({ ...current, accessibleBranches: [branchA] });
    expect(scope.branch().id).toBe('');
    expect(scope.company().id).toBe('');
    TestBed.tick();
    expect(scope.branch().id).not.toBe(branchB);
    status.set('signed-out');
    expect(scope.company().id).toBe('');
    expect(scope.branch().id).toBe('');
    expect(scope.company().branches).toEqual([]);
    expect(scope.hasChoice()).toBe(false);
  });

  it('does not silently choose a different company in a multiple-company projection', () => {
    const current = me();
    if (!current) throw new Error('Missing test identity');
    sessionStorage.removeItem(storageKey);
    localStorage.removeItem(storageKey);
    me.set({ ...current, id: 'scope-facade-multiple', accessibleCompanies: [companyId, 'other-company'] });
    expect(scope.company().id).toBe('');
    expect(tenant.selection()).toBeNull();
    scope.selectCompany(companyId);
    expect(tenant.selection()?.companyId).toBe(companyId);
    expect(scope.company().id).toBe(companyId);
    sessionStorage.removeItem('tenant-staff-scope:scope-facade-multiple');
    localStorage.removeItem('tenant-staff-scope:scope-facade-multiple');
  });
});
