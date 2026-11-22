import { ApiError, errorMessage } from '../../../../core/api/api-errors';
import { SettingsTranslator } from '../../../../core/api/settings-translator';
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
  rateMax: 1_000_000_000,
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
  // Guard against values like 1000000000.00000001 rounding down to rateMax in IEEE 754 float.
  const [, fracPart = ''] = trimmed.split('.');
  if (parsed === CURRENCY_LIMITS.rateMax && /[1-9]/.test(fracPart)) return false;
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

export function mapCurrencyErrorCode(code: string | null): string | null {
  if (!code) return null;
  if (code === 'GW.IDEM.IN_FLIGHT' || code === 'IDEM_IN_FLIGHT') return 'IDEM_IN_FLIGHT';
  if (code.startsWith('IDEM_') || code.startsWith('GW.IDEM.')) return 'IDEM_OTHER';
  return code;
}

export function currencyErrorMessage(error: unknown, t: SettingsTranslator): string {
  if (error instanceof ApiError) {
    const mapped = mapCurrencyErrorCode(error.code);
    const normalized = mapped && mapped !== error.code ? new ApiError(error.status, mapped, error.details) : error;
    return errorMessage(normalized, 'wsCurrencies', t);
  }
  if (typeof error === 'string') {
    const mapped = mapCurrencyErrorCode(error) ?? error;
    return errorMessage(mapped, 'wsCurrencies', t);
  }
  return errorMessage(error, 'wsCurrencies', t);
}
