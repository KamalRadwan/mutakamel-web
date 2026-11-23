import { describe, expect, it } from 'vitest';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { canManageTax, taxCompanyOptions, taxPermissions, taxScopeRevision } from './taxes.model';

function session(overrides: Partial<TenantMe> = {}): TenantMe {
  return { id: 'user', isTenantOwner: false, permissions: ['taxes.tax.manage'], accessibleCompanies: ['company'],
    permissionScopes: { 'taxes.tax.manage': { tenantWide: false, companyIds: ['company'], branchIds: [] } },
    ...overrides } as TenantMe;
}

describe('Taxes scope model', () => {
  it('manageable rows follow permissionScopes', () => {
    const scoped = taxPermissions(session());
    expect(canManageTax({ companyId: 'company' }, scoped)).toBe(true);
    expect(canManageTax({ companyId: 'other' }, scoped)).toBe(false);
    expect(canManageTax({ companyId: null }, scoped)).toBe(false);
    const tenantWide = taxPermissions(session({ permissionScopes: {
      'taxes.tax.manage': { tenantWide: true, companyIds: [], branchIds: [] },
    } }));
    expect(canManageTax({ companyId: null }, tenantWide)).toBe(true);
    expect(canManageTax({ companyId: 'other' }, tenantWide)).toBe(true);
    const revoked = taxPermissions(session({ permissions: [] }));
    expect(canManageTax({ companyId: 'company' }, revoked)).toBe(false);
    expect(canManageTax({ companyId: null }, taxPermissions(null))).toBe(false);
  });

  it('owner manages all', () => {
    const permissions = taxPermissions(session({ isTenantOwner: true, permissions: [], permissionScopes: {} }));
    expect(canManageTax({ companyId: null }, permissions)).toBe(true);
    expect(canManageTax({ companyId: 'unlisted-company' }, permissions)).toBe(true);
  });

  it('fallback company options use accessible companies only and unknown status', () => {
    const options = taxCompanyOptions(session({ accessibleCompanies: ['12345678-rest'] }), null, (id) => `Company ${id}`);
    expect(options).toEqual([{ id: '12345678-rest', name: 'Company 12345678', status: null, canManage: false }]);
  });

  it('scope revision changes for identity, read/manage scopes and accessible companies', () => {
    const original = session();
    const revision = taxScopeRevision(original);
    for (const change of [{ id: 'other' }, { isTenantOwner: true }, { permissions: [] }, { accessibleCompanies: [] },
      { permissionScopes: { ...original.permissionScopes, 'taxes.tax.read': { tenantWide: true, companyIds: [], branchIds: [] } } },
      { permissionScopes: {} }]) {
      expect(taxScopeRevision({ ...original, ...change })).not.toBe(revision);
    }
    expect(taxScopeRevision({ ...original })).toBe(revision);
  });
});
