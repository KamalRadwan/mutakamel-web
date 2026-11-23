import { ApiError, errorMessage } from '../../../../core/api/api-errors';
import { SettingsTranslator } from '../../../../core/api/settings-translator';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { hasTenantWidePermission } from '../../../../core/auth/tenant-wide-permission';
export type { CorePage } from '../core-response.model';

export type CurrencyStatus = 'ACTIVE' | 'INACTIVE';

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
  decimalPlaces: number;
  isDefault: boolean;
  exchangeRate: string | null;
  status: CurrencyStatus;
  createdAt: string;
  updatedAt: string;
}

export type CurrencySortBy = 'code' | 'name' | 'exchangeRate' | 'createdAt';

export interface CurrencyListQuery {
  page?: number;
  limit?: number;
  sortBy?: CurrencySortBy;
  sortDir?: 'ASC' | 'DESC';
  search?: string;
  status?: CurrencyStatus;
  isDefault?: boolean;
}

export interface CreateCurrencyBody {
  code: string;
  name: string;
  symbol?: string;
  exchangeRate?: number;
  isDefault?: boolean;
}

export interface UpdateCurrencyBody {
  name?: string;
  symbol?: string;
  exchangeRate?: number;
  status?: CurrencyStatus;
}

export interface CurrencyCatalogueEntry {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
}

export const CURRENCY_LIMITS = {
  code: 3,
  name: 80,
  symbol: 8,
  rateMax: 10_000_000_000,
  rateDecimals: 8,
  pageSizes: [20, 50, 100],
} as const;

export const ZERO_DECIMAL_CODES: ReadonlySet<string> = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'ISK',
  'JPY',
  'KMF',
  'KRW',
  'PYG',
  'RWF',
  'UGX',
  'UYI',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

export const THREE_DECIMAL_CODES: ReadonlySet<string> = new Set([
  'BHD',
  'IQD',
  'JOD',
  'KWD',
  'LYD',
  'OMR',
  'TND',
]);

export const FOUR_DECIMAL_CODES: ReadonlySet<string> = new Set(['CLF', 'UYW']);

export const NON_SPENDABLE_CURRENCY_CODES: ReadonlySet<string> = new Set([
  'XDR',
  'XSU',
  'XUA',
  'XAU',
  'XAG',
  'XPD',
  'XPT',
  'XTS',
  'XXX',
]);

export const FALLBACK_CURRENCY_CODES: readonly string[] = [
  'SAR',
  'AED',
  'KWD',
  'BHD',
  'OMR',
  'QAR',
  'JOD',
  'EGP',
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CNY',
  'INR',
  'TRY',
  'CHF',
  'CAD',
  'AUD',
  'SGD',
  'MYR',
  'PKR',
  'IDR',
  'KRW',
  'NZD',
  'SEK',
  'NOK',
  'DKK',
  'ZAR',
  'RUB',
  'BRL',
];

export const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;
export const CURRENCY_RATE_PATTERN = /^\d+(\.\d{1,8})?$/;

let cachedSupportedCodes: readonly string[] | null = null;
let cachedSupportedCodeSet: ReadonlySet<string> | null = null;

export function minorUnitsOf(code: string): number {
  const normalized = code.trim().toUpperCase();
  if (ZERO_DECIMAL_CODES.has(normalized)) return 0;
  if (THREE_DECIMAL_CODES.has(normalized)) return 3;
  if (FOUR_DECIMAL_CODES.has(normalized)) return 4;
  return 2;
}

export function isValidRateText(text: string): boolean {
  const trimmed = text.trim();
  if (!CURRENCY_RATE_PATTERN.test(trimmed)) return false;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > CURRENCY_LIMITS.rateMax) return false;
  // Check the integer part too: a fraction above the maximum can round down in IEEE 754.
  const [integerPart, fracPart = ''] = trimmed.split('.');
  if (Number(integerPart) >= CURRENCY_LIMITS.rateMax && /[1-9]/.test(fracPart)) return false;
  return true;
}

export function supportedCurrencyCodes(): readonly string[] {
  if (cachedSupportedCodes) return cachedSupportedCodes;

  let rawCodes: readonly string[] = FALLBACK_CURRENCY_CODES;
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
      const supported = Intl.supportedValuesOf('currency');
      if (supported.length > 0) {
        rawCodes = supported;
      }
    }
  } catch {
    rawCodes = FALLBACK_CURRENCY_CODES;
  }

  const unique = new Set<string>();
  for (const item of rawCodes) {
    const code = item.trim().toUpperCase();
    if (CURRENCY_CODE_PATTERN.test(code) && !NON_SPENDABLE_CURRENCY_CODES.has(code)) {
      unique.add(code);
    }
  }

  const sorted = Array.from(unique).sort((a, b) => a.localeCompare(b, 'en'));
  cachedSupportedCodes = sorted;
  cachedSupportedCodeSet = new Set(sorted);
  return sorted;
}

export function isSupportedCurrencyCode(code: string): boolean {
  if (!cachedSupportedCodeSet) {
    supportedCurrencyCodes();
  }
  return cachedSupportedCodeSet?.has(code.trim().toUpperCase()) ?? false;
}

export function currencyPermissions(me: TenantMe | null | undefined): { readable: boolean; manage: boolean } {
  return {
    readable: me?.permissions.includes('currencies.currency.read') ?? false,
    manage: hasTenantWidePermission(me, 'currencies.currency.manage'),
  };
}

export interface CurrencyCompanyBlocker {
  companies: { id: string; name: string }[];
  more: number;
}

export function currencyCompanyBlocker(error: ApiError): CurrencyCompanyBlocker {
  const ids = error.details?.['companyIds'];
  const names = error.details?.['companyNames'];
  const companies: CurrencyCompanyBlocker['companies'] = [];
  if (error.code === 'CURRENCY_COMPANY_IN_USE' && Array.isArray(ids) && Array.isArray(names)) {
    for (let index = 0; index < Math.min(ids.length, names.length, 20); index++) {
      if (typeof ids[index] === 'string' && ids[index] && typeof names[index] === 'string' && names[index]) {
        companies.push({ id: ids[index], name: names[index] });
      }
    }
  }
  const remaining = error.details?.['more'];
  const more = Array.isArray(remaining) ? Number(remaining[0]) : 0;
  return { companies, more: Number.isSafeInteger(more) && more > 0 ? more : 0 };
}

export function currencyErrorMessage(error: unknown, t: SettingsTranslator, operation: 'read' | 'write' = 'read'): string {
  const translate = typeof t === 'function' ? t : (key: string) => t.translate(key);
  if (operation === 'write' && error instanceof ApiError && error.status === 401) {
    return translate('wsCurrencies.errors.notSaved');
  }
  if (error instanceof ApiError && error.code === 'CURRENCY_DEFAULT_DELETE') {
    return translate('wsCurrencies.blocker.next.CURRENCY_DEFAULT_DELETE');
  }
  return errorMessage(error, 'wsCurrencies', t);
}
