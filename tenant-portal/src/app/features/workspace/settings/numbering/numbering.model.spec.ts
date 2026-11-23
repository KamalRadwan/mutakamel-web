import { describe, expect, it } from 'vitest';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import type { WorkspaceCompany } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
import { canManageScope, companyOption, isCounterString, numberingAccess } from './numbering.model';

describe('Numbering model', () => {
  it('access follows permissionScopes', () => {
    const me = { isTenantOwner: false, permissions: ['numbering.manage'],
      permissionScopes: { 'numbering.manage': { tenantWide: false, companyIds: ['company'], branchIds: [] } },
    } as unknown as TenantMe;
    expect(numberingAccess(null)).toEqual({ tenantWideManage: false, manageCompanyIds: [] });
    expect(numberingAccess(me)).toEqual({ tenantWideManage: false, manageCompanyIds: ['company'] });
    expect(numberingAccess({ ...me, permissions: [] }).manageCompanyIds).toEqual([]);
    const tenantWide = { ...me, permissionScopes: { 'numbering.manage': { tenantWide: true, companyIds: [], branchIds: [] } } };
    expect(numberingAccess(tenantWide).tenantWideManage).toBe(true);
    expect(numberingAccess({ ...me, isTenantOwner: true, permissions: [] }).tenantWideManage).toBe(true);
    expect(canManageScope(numberingAccess(tenantWide), 'any-company')).toBe(true);
    expect(canManageScope(numberingAccess(me), null)).toBe(false);
  });

  it('company option maps name and status', () => {
    const company = { id: 'company', name: 'Single company name', status: 'ACTIVE' } as WorkspaceCompany;
    expect(companyOption(company)).toEqual({ id: 'company', label: 'Single company name', active: true });
    expect(companyOption({ ...company, status: 'INACTIVE' }).active).toBe(false);
  });

  it('counter writes allow safe integers only', () => {
    expect(isCounterString('9007199254740991')).toBe(true);
    expect(isCounterString('9007199254740992')).toBe(false);
    expect(isCounterString('0')).toBe(false);
  });
});
