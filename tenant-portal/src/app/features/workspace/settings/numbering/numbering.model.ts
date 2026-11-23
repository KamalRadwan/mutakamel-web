import type { CorePage } from '../core-response.model';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { hasTenantWidePermission } from '../../../../core/auth/tenant-wide-permission';
import type { WorkspaceCompany } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.model';

export interface NumberingSequence {
  id: string;
  code: string;
  prefix: string | null;
  padding: number;
  nextValue: string;
  companyId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NumberingListQuery {
  code?: string;
  page?: number;
  limit?: number;
  sortBy?: 'code' | 'nextValue' | 'createdAt';
  sortDir?: 'ASC' | 'DESC';
  search?: string;
  companyId?: string;
}

/** GET numbering: Core's envelope { data, meta } around the PaginatedResult. */
export type NumberingPage = CorePage<NumberingSequence>;

export interface CreateNumberingBody {
  code: string;
  prefix?: string;
  padding?: number;
  startValue?: number;
  companyId?: string;
}

export interface UpdateNumberingBody {
  prefix?: string;
  padding?: number;
  nextValue?: number;
}

/** NumberingPeekResult: companyId is the sequence's own scope, null for a workspace-wide sequence. */
export interface NumberingPeek {
  code: string;
  companyId: string | null;
  nextValue: string;
  formatted: string;
}

export interface CompanyOption {
  id: string;
  label: string;
  active: boolean;
}

export interface NumberingAccess {
  tenantWideManage: boolean;
  manageCompanyIds: string[];
}

export const NUMBERING_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._:-]{0,63}$/;
export const NUMBERING_PREFIX_PATTERN = /^[\p{L}\p{N}._:/#-]*$/u;
export const NUMBERING_PREFIX_MAX = 16;
export const NUMBERING_CODE_MAX = 64;
export const NUMBERING_PADDING_MIN = 1;
export const NUMBERING_PADDING_MAX = 12;
export const NUMBERING_COUNTER_MAX = '9007199254740991';
export const NUMBERING_PAGE_SIZES = [20, 50, 100];

const COUNTER_DIGITS_PATTERN = /^[0-9]{1,16}$/;
const COUNTER_MAX_BIGINT = BigInt(NUMBERING_COUNTER_MAX);

export function stripLeadingZeros(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const stripped = trimmed.replace(/^0+/, '');
  return stripped || '0';
}

export function isCounterString(value: string): boolean {
  if (!COUNTER_DIGITS_PATTERN.test(value)) return false;
  const normalized = stripLeadingZeros(value);
  if (!normalized || normalized === '0') return false;
  const numeric = BigInt(normalized);
  return numeric >= 1n && numeric <= COUNTER_MAX_BIGINT;
}

export function compareCounters(a: string, b: string): number {
  const normA = stripLeadingZeros(a);
  const normB = stripLeadingZeros(b);
  const bigA = BigInt(normA && /^[0-9]+$/.test(normA) ? normA : '0');
  const bigB = BigInt(normB && /^[0-9]+$/.test(normB) ? normB : '0');
  if (bigA < bigB) return -1;
  if (bigA > bigB) return 1;
  return 0;
}

export function formatNumber(prefix: string | null, padding: number, counter: string): string {
  const safePadding = Math.max(NUMBERING_PADDING_MIN, Math.min(NUMBERING_PADDING_MAX, Math.floor(padding)));
  const normalized = stripLeadingZeros(counter) || '0';
  return `${prefix ?? ''}${normalized.padStart(safePadding, '0')}`;
}

export function canManageScope(access: NumberingAccess, companyId: string | null | undefined): boolean {
  const normalizedCompanyId = companyId ?? null;
  if (normalizedCompanyId === null) {
    return access.tenantWideManage;
  }
  return access.tenantWideManage || access.manageCompanyIds.includes(normalizedCompanyId);
}

export function numberingAccess(me: TenantMe | null | undefined): NumberingAccess {
  return {
    tenantWideManage: hasTenantWidePermission(me, 'numbering.manage'),
    manageCompanyIds: me?.permissions.includes('numbering.manage')
      ? me.permissionScopes['numbering.manage']?.companyIds ?? [] : [],
  };
}

export function companyOption(company: WorkspaceCompany): CompanyOption {
  return { id: company.id, label: company.name, active: company.status === 'ACTIVE' };
}
