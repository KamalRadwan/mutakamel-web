import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FAKE_TENANT_ME } from '../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../core/auth/auth-session.model';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import { anyGrant, branchGrants, tenantWide } from './trade-access';

describe('tradeAccess', () => {
  const key = 'trade.items.read';
  const me = signal<TenantMe | null>(null);
  const run = <T>(read: () => T) => TestBed.runInInjectionContext(read);

  beforeEach(() => {
    me.set({ ...FAKE_TENANT_ME, isTenantOwner: false, permissions: [], permissionScopes: {} });
    TestBed.configureTestingModule({ providers: [{ provide: TenantScopeState, useValue: { me } }] });
  });

  it('tenant-wide counts scoped variants', () => {
    me.update((value) => ({ ...value!, permissions: [`${key}.team`], permissionScopes: {
      [`${key}.team`]: { tenantWide: true, branchIds: [], companyIds: [] },
    } }));
    expect(run(() => tenantWide(key))).toBe(true);
    expect(run(() => anyGrant(key))).toBe(true);
    expect(run(() => branchGrants(key))).toBe('ALL');
  });

  it('branch grant is not tenant-wide', () => {
    me.update((value) => ({ ...value!, permissions: [`${key}.own`], permissionScopes: {
      [`${key}.own`]: { tenantWide: false, branchIds: ['branch-a'], companyIds: [] },
    } }));
    expect(run(() => tenantWide(key))).toBe(false);
    expect(run(() => anyGrant(key))).toBe(true);
    expect(run(() => branchGrants(key))).toEqual(new Set(['branch-a']));
  });

  it('company grant expands to its branches', () => {
    me.update((value) => ({ ...value!, permissions: [key], permissionScopes: {
      [key]: { tenantWide: false, branchIds: ['branch-a'], companyIds: ['company-a'] },
    }, accessibleBranchCompanies: [
      { branchId: 'branch-a', companyId: 'company-a' },
      { branchId: 'branch-b', companyId: 'company-a' },
      { branchId: 'branch-c', companyId: 'company-b' },
    ] }));
    expect(run(() => branchGrants(key))).toEqual(new Set(['branch-a', 'branch-b']));
  });

  it('owner holds everything', () => {
    me.update((value) => ({ ...value!, isTenantOwner: true }));
    expect(run(() => tenantWide(key))).toBe(true);
    expect(run(() => anyGrant(key))).toBe(true);
    expect(run(() => branchGrants(key))).toBe('ALL');
  });

  it('unions all granted variants without treating a truncated projection as ALL', () => {
    me.update((value) => ({ ...value!, permissions: [key, `${key}.all`], permissionScopes: {
      [key]: { tenantWide: false, branchIds: ['branch-a'], companyIds: [] },
      [`${key}.all`]: { tenantWide: false, branchIds: ['branch-a', 'branch-b'], companyIds: [] },
    }, accessScope: { ...value!.accessScope, branchesTruncated: true } }));
    expect(run(() => tenantWide(key))).toBe(false);
    expect(run(() => branchGrants(key))).toEqual(new Set(['branch-a', 'branch-b']));
  });

  it('does not accept scope metadata without its permission', () => {
    me.update((value) => ({ ...value!, permissionScopes: {
      [key]: { tenantWide: true, branchIds: ['branch-a'], companyIds: ['company-a'] },
    } }));
    expect(run(() => tenantWide(key))).toBe(false);
    expect(run(() => anyGrant(key))).toBe(false);
    expect(run(() => branchGrants(key))).toEqual(new Set());
  });

  it('denies access without an active session and reads permission changes', () => {
    me.set(null);
    expect(run(() => tenantWide(key))).toBe(false);
    expect(run(() => anyGrant(key))).toBe(false);
    expect(run(() => branchGrants(key))).toEqual(new Set());
    me.set({ ...FAKE_TENANT_ME, isTenantOwner: true });
    expect(run(() => tenantWide(key))).toBe(true);
  });
});
