import { ApiError, errorMessage } from '../../../../core/api/api-errors';
import { SettingsTranslator } from '../../../../core/api/settings-translator';
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
  status: 'ACTIVE' | 'INACTIVE';
  canManage: boolean;
}

export interface TaxPermissions {
  tenantWideAllowed: boolean;
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

export function mapTaxError(error: unknown): unknown {
  const idemCode = error instanceof ApiError && (error.code.startsWith('IDEM_') || error.code.startsWith('GW.IDEM.'));
  const inFlight = error instanceof ApiError && (error.code === 'IDEM_IN_FLIGHT' || error.code === 'GW.IDEM.IN_FLIGHT');
  if (error instanceof ApiError && idemCode && !inFlight) {
    return new ApiError(error.status, 'IDEM_OTHER', error.details);
  }
  return error;
}

export function translateTaxError(error: unknown, transloco: SettingsTranslator): string {
  return errorMessage(mapTaxError(error), 'wsTaxes', transloco);
}
