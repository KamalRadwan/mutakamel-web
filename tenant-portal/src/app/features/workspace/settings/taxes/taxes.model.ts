import { ApiError, errorMessage } from '../../../../core/api/api-errors';
import { SettingsTranslator } from '../../../../core/api/settings-translator';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { hasTenantWidePermission } from '../../../../core/auth/tenant-wide-permission';
import type { WorkspaceCompany } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
export type { CorePage } from '../core-response.model';

export type TaxStatus = 'ACTIVE' | 'INACTIVE';

export interface Tax {
  id: string;
  code: string;
  name: string;
  rate: string;
  isInclusive: boolean;
  companyId: string | null;
  status: TaxStatus;
  createdAt: string;
  updatedAt: string;
}

export type TaxSortBy = 'code' | 'name' | 'rate' | 'createdAt';

export interface TaxListQuery {
  page?: number;
  limit?: number;
  sortBy?: TaxSortBy;
  sortDir?: 'ASC' | 'DESC';
  search?: string;
  status?: TaxStatus;
  companyId?: string;
  isInclusive?: boolean;
}

export interface CreateTaxBody {
  code: string;
  name: string;
  rate: number;
  isInclusive?: boolean;
  companyId?: string;
}

export interface UpdateTaxBody {
  name?: string;
  rate?: number;
  isInclusive?: boolean;
  status?: TaxStatus;
}

export interface CompanyOption {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE' | null;
  canManage: boolean;
}

export interface TaxPermissions {
  tenantWideAllowed: boolean;
  managedCompanyIds: string[];
}

export function taxPermissions(me: TenantMe | null): TaxPermissions {
  const scope = me?.permissions.includes('taxes.tax.manage') ? me.permissionScopes['taxes.tax.manage'] : undefined;
  return {
    tenantWideAllowed: hasTenantWidePermission(me, 'taxes.tax.manage'),
    managedCompanyIds: scope?.companyIds ?? [],
  };
}

export function canManageTax(tax: Pick<Tax, 'companyId'>, permissions: TaxPermissions): boolean {
  return permissions.tenantWideAllowed ||
    (tax.companyId !== null && permissions.managedCompanyIds.includes(tax.companyId));
}

export function taxScopeRevision(me: TenantMe | null): string {
  return JSON.stringify([me?.id, me?.isTenantOwner, me?.permissions,
    me?.permissionScopes['taxes.tax.read'], me?.permissionScopes['taxes.tax.manage'], me?.accessibleCompanies]);
}

export function taxCompanyOptions(
  me: TenantMe | null,
  companies: readonly WorkspaceCompany[] | null,
  fallbackLabel: (id: string) => string,
): CompanyOption[] {
  const permissions = taxPermissions(me);
  const rows = companies ?? (me?.accessibleCompanies ?? []).map((id) => ({ id, name: fallbackLabel(id.slice(0, 8)), status: null }));
  return rows.map(({ id, name, status }) => ({ id, name, status, canManage: canManageTax({ companyId: id }, permissions) }));
}

export const TAX_LIMITS = {
  code: 32,
  name: 120,
  rateMin: 0,
  rateMax: 100,
  rateDecimals: 4,
  pageSizes: [20, 50, 100],
} as const;

const RATE_TEXT_PATTERN = /^\d+(\.\d{1,4})?$/;

export function isValidRateText(text: string): boolean {
  const trimmed = text.trim();
  if (!RATE_TEXT_PATTERN.test(trimmed)) return false;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= TAX_LIMITS.rateMin && parsed <= TAX_LIMITS.rateMax;
}

export function toCanonicalRate(rate: number): string {
  return rate.toFixed(TAX_LIMITS.rateDecimals);
}

export function formatRate(rate: string): string {
  const trimmed = rate.trim();
  if (!trimmed.includes('.')) return trimmed;
  return trimmed.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1').replace(/\.$/, '');
}

export function translateTaxError(
  error: unknown,
  transloco: SettingsTranslator,
  action: 'read' | 'write' | 'create' | 'reactivate' = 'read',
): string {
  const translate = typeof transloco === 'function' ? transloco : (key: string) => transloco.translate(key);
  if (action !== 'read' && error instanceof ApiError && error.status === 401) {
    return translate('wsTaxes.notSaved');
  }
  if (error instanceof ApiError && error.code === 'COMPANY_INVALID') {
    if (action === 'create') return translate('wsTaxes.errors.COMPANY_INVALID_CREATE');
    if (action === 'reactivate') return translate('wsTaxes.errors.COMPANY_INVALID_ON_REACTIVATE');
  }
  return errorMessage(error, 'wsTaxes', transloco);
}
