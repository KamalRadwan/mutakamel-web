import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthSession } from '../../../../core/auth/auth-session';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type {
  SessionStatus,
  TenantMe,
  TenantPermissionScope,
} from '../../../../core/auth/auth-session.model';
import { StaffSession } from './staff-session';

const companyA = '019f0000-0000-7000-8000-000000000010';
const companyB = '019f0000-0000-7000-8000-000000000020';
const branchA = '019f0000-0000-7000-8000-000000000011';
const branchB = '019f0000-0000-7000-8000-000000000012';
const branchC = '019f0000-0000-7000-8000-000000000021';
const tenant: TenantPermissionScope = { tenantWide: true, companyIds: [], branchIds: [] };

function identity(
  scopes: TenantMe['permissionScopes'],
  overrides: Partial<TenantMe> = {},
): TenantMe {
  return {
    ...FAKE_TENANT_ME,
    isTenantOwner: false,
    permissions: Object.keys(scopes),
    permissionScopes: scopes,
    accessibleCompanies: [companyA, companyB],
    accessibleBranches: [branchA, branchB, branchC],
    accessibleBranchCompanies: [
      { companyId: companyA, branchId: branchA },
      { companyId: companyA, branchId: branchB },
      { companyId: companyB, branchId: branchC },
    ],
    ...overrides,
  };
}

describe('StaffSession policy from the current /me', () => {
  const me = signal<TenantMe | null>(null);
  const status = signal<SessionStatus>('unknown');
  let staff: StaffSession;

  beforeEach(() => {
    me.set(null);
    status.set('signed-in');
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSession, useValue: { me, status, ensureLoaded: async () => status() } },
      ],
    });
    staff = TestBed.inject(StaffSession);
  });

  it.each(['unknown', 'loading', 'failed', 'signed-out'] as const)(
    'denies stale owner data while auth is %s',
    (state) => {
      me.set(identity({ 'org.company.manage': tenant }, { isTenantOwner: true }));
      status.set(state);
      expect(staff.isOwner()).toBe(false);
      expect(staff.can('roles.role.read')).toBe(false);
      expect(staff.isTenantWide('org.company.manage')).toBe(false);
    },
  );

  it('keeps owner-only decisions separate from tenant-wide grants and permits a verified owner', () => {
    me.set(identity({ 'org.company.read': tenant }));
    expect(staff.isOwner()).toBe(false);
    expect(staff.isTenantWide('org.company.read')).toBe(true);
    expect(staff.can('org.company.manage', { companyId: companyA })).toBe(false);
    me.set(identity({ 'org.company.manage': tenant }, { isTenantOwner: true }));
    expect(staff.isOwner()).toBe(true);
    expect(staff.can('org.company.manage', { companyId: companyB })).toBe(true);
  });

  it('separates branch and company records and never borrows a scope from another key', () => {
    me.set(
      identity({
        'org.branch.read': { tenantWide: false, companyIds: [], branchIds: [branchA] },
        'org.branch.manage': { tenantWide: false, companyIds: [companyB], branchIds: [branchC] },
      }),
    );
    expect(staff.can('org.branch.read', { companyId: companyA, branchId: branchA })).toBe(true);
    expect(staff.can('org.branch.read', { companyId: companyA, branchId: branchB })).toBe(false);
    expect(staff.can('org.branch.read', { companyId: companyA })).toBe(false);
    expect(staff.isTenantWide('org.branch.read')).toBe(false);
    expect(staff.canCreateBranch(companyB)).toBe(true);
    expect(staff.canCreateBranch(companyA)).toBe(false);
    expect(staff.can('org.branch.read', { companyId: companyB })).toBe(false);
    expect(staff.can('org.branch.manage', { companyId: companyA, branchId: branchA })).toBe(false);
  });

  it('replaces grants on a fresh /me and clears access across an account change', () => {
    me.set(
      identity({
        'org.branch.manage': { tenantWide: false, companyIds: [], branchIds: [branchA] },
      }),
    );
    const canEdit = (branchId: string) =>
      staff.can('org.branch.manage', { companyId: companyA, branchId });
    expect(canEdit(branchA)).toBe(true);
    expect(canEdit(branchB)).toBe(false);
    me.set(
      identity({
        'org.branch.manage': { tenantWide: false, companyIds: [], branchIds: [branchB] },
      }),
    );
    expect(canEdit(branchA)).toBe(false);
    expect(canEdit(branchB)).toBe(true);
    status.set('signed-out');
    me.set(null);
    expect(canEdit(branchB)).toBe(false);
    status.set('signed-in');
    me.set(identity({ 'org.branch.read': tenant }, { id: 'new-account' }));
    expect(staff.me()?.id).toBe('new-account');
    expect(canEdit(branchB)).toBe(false);
  });

  it('uses the individually projected branches for a company grant and rejects a different branch under that company', () => {
    me.set(
      identity({
        'org.branch.manage': { tenantWide: false, companyIds: [companyA], branchIds: [branchA] },
      }),
    );
    expect(staff.canCreateBranch(companyA)).toBe(true);
    expect(staff.can('org.branch.manage', { companyId: companyA, branchId: branchA })).toBe(true);
    expect(staff.can('org.branch.manage', { companyId: companyA, branchId: branchB })).toBe(false);
    expect(staff.can('org.branch.manage', { companyId: companyB, branchId: branchC })).toBe(false);
    expect(staff.isTenantWide('org.branch.manage')).toBe(false);
    me.set(
      identity({
        'org.branch.manage': { tenantWide: false, companyIds: [], branchIds: [branchA] },
      }),
    );
    expect(staff.canCreateBranch(companyA)).toBe(false);
    expect(staff.can('org.branch.manage', { companyId: companyA, branchId: branchA })).toBe(true);
  });

  it('rejects an inactive owner even when the last /me still carries grants', () => {
    me.set(identity({ 'roles.role.read': tenant }, { isTenantOwner: true, status: 'INACTIVE' }));
    expect(staff.isOwner()).toBe(false);
    expect(staff.can('roles.role.read')).toBe(false);
  });

  it('requires both a current key and a usable scope for that same key', () => {
    me.set(identity({ 'roles.role.read': tenant }, { permissions: ['users.user.read'] }));
    expect(staff.can('roles.role.read')).toBe(false);
    expect(staff.can('users.user.read')).toBe(false);
    me.set(identity({ 'users.user.read': { tenantWide: false, branchIds: [], companyIds: [] } }));
    expect(staff.can('users.user.read')).toBe(false);
  });

  it('allows a known read grant to open a list when the navigation projection is truncated', () => {
    const actor = identity({
      'users.user.read': { tenantWide: false, companyIds: [], branchIds: [branchA] },
    });
    me.set({
      ...actor,
      accessibleBranches: [],
      accessibleBranchCompanies: [],
      accessScope: { ...actor.accessScope, branchesTruncated: true },
    });
    expect(staff.can('users.user.read')).toBe(true);
    expect(staff.can('users.user.read', { branchId: branchB })).toBe(false);
  });

  it('recognizes a readable parent company without granting authority to mutate it or its other branches', () => {
    me.set(
      identity({ 'org.company.read': { tenantWide: false, companyIds: [], branchIds: [branchA] } }),
    );
    expect(staff.can('org.company.read', { companyId: companyA })).toBe(true);
    expect(staff.can('org.company.read', { companyId: companyB })).toBe(false);
    expect(staff.isTenantWide('org.company.manage')).toBe(false);
    expect(staff.can('org.branch.manage', { companyId: companyA, branchId: branchB })).toBe(false);
  });
});
