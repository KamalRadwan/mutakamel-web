import { describe, expect, it } from 'vitest';
import type { TenantMe } from './auth-session.model';
import { hasTenantWidePermission } from './tenant-wide-permission';

describe('hasTenantWidePermission', () => {
  const key = 'branding.manage';
  const me: TenantMe = {
    id: 'user-1',
    email: 'user@example.com',
    firstName: 'Test',
    lastName: 'User',
    hasAvatar: false,
    workspace: { timezone: 'UTC', defaultLanguage: 'en' },
    isTenantOwner: false,
    mfaEnabled: false,
    mfaUpdatedAt: null,
    status: 'ACTIVE',
    accessibleBranches: [],
    accessibleCompanies: [],
    accessibleBranchCompanies: [],
    permissions: [],
    seats: [],
    permissionScopes: {},
    teamMemberships: [],
    accessScope: {
      mode: 'FULL',
      branchesTruncated: false,
      companiesTruncated: false,
      teamMembershipsTruncated: false,
      teamMembershipsTotal: 0,
    },
    featureEntitlements: {},
  };
  const tenantWideScope = { tenantWide: true, companyIds: [], branchIds: [] };

  it.each([null, undefined])('denies a %s session', (session) => {
    expect(hasTenantWidePermission(session, key)).toBe(false);
  });

  it('grants the owner without the permission key', () => {
    expect(hasTenantWidePermission({ ...me, isTenantOwner: true }, key)).toBe(true);
  });

  it('grants a non-owner with the key and a tenant-wide scope', () => {
    const session = { ...me, permissions: [key], permissionScopes: { [key]: tenantWideScope } };
    expect(hasTenantWidePermission(session, key)).toBe(true);
  });

  it.each([
    { tenantWide: false, companyIds: ['company-1'], branchIds: [] },
    { tenantWide: false, companyIds: [], branchIds: ['branch-1'] },
  ])('denies a non-owner with only company or branch scope: %j', (scope) => {
    const session = { ...me, permissions: [key], permissionScopes: { [key]: scope } };
    expect(hasTenantWidePermission(session, key)).toBe(false);
  });

  it('denies a tenant-wide scope without the permission key', () => {
    expect(hasTenantWidePermission({ ...me, permissionScopes: { [key]: tenantWideScope } }, key)).toBe(false);
  });

  it('denies a non-owner without the permission key', () => {
    expect(hasTenantWidePermission(me, key)).toBe(false);
  });

  it('denies the permission key without its scope', () => {
    expect(hasTenantWidePermission({ ...me, permissions: [key] }, key)).toBe(false);
  });

  it('does not leak another permission key\'s tenant-wide scope', () => {
    const session = {
      ...me,
      permissions: [key, 'branding.read'],
      permissionScopes: { [key]: tenantWideScope },
    };
    expect(hasTenantWidePermission(session, 'branding.read')).toBe(false);
  });
});
