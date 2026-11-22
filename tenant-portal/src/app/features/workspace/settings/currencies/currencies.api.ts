import {
  fakeCreateCurrency,
  fakeDeactivateCurrency,
  fakeListCurrencies,
  fakeSetDefaultCurrency,
  fakeUpdateCurrency,
} from './currencies.fake';
import {
  CURRENCY_LIMITS,
  CreateCurrencyBody,
  Currency,
  CurrencyCatalogueEntry,
  CurrencyListQuery,
  CorePage,
  UpdateCurrencyBody,
  minorUnitsOf,
  supportedCurrencyCodes,
} from './currencies.model';

const catalogueCache = new Map<'en' | 'ar', CurrencyCatalogueEntry[]>();

function resolveCurrencyName(displayNames: Intl.DisplayNames | null, code: string): string {
  if (!displayNames) return code;
  try {
    return displayNames.of(code) || code;
  } catch {
    return code;
  }
}

function resolveCurrencySymbol(lang: 'en' | 'ar', code: string): string {
  try {
    const parts = new Intl.NumberFormat(lang, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0);
    const currencyPart = parts.find((part) => part.type === 'currency')?.value.trim() ?? '';
    if (currencyPart && Array.from(currencyPart).length <= CURRENCY_LIMITS.symbol) {
      return currencyPart;
    }
  } catch {
    // Fallback to ISO code below.
  }
  return code;
}

export function listCurrencies(query?: CurrencyListQuery): Promise<CorePage<Currency>> {
  // GET    /api/v1/tenant/currencies [currencies.currency.read] -> envelope { data: Currency[], meta }
  return fakeListCurrencies(query);
}

export function createCurrency(body: CreateCurrencyBody, key: string): Promise<Currency> {
  // POST   /api/v1/tenant/currencies [currencies.currency.manage, tenant-wide] (x-idempotency-key)
  return fakeCreateCurrency(body, key);
}

export function updateCurrency(id: string, body: UpdateCurrencyBody, key: string): Promise<Currency> {
  // PATCH  /api/v1/tenant/currencies/:id [currencies.currency.manage, tenant-wide] (x-idempotency-key)
  return fakeUpdateCurrency(id, body, key);
}

export function setDefaultCurrency(id: string, key: string): Promise<Currency> {
  // POST   /api/v1/tenant/currencies/:id/set-default [currencies.currency.manage, tenant-wide] (x-idempotency-key, no body)
  return fakeSetDefaultCurrency(id, key);
}

export function deactivateCurrency(id: string, key: string): Promise<void> {
  // DELETE /api/v1/tenant/currencies/:id [currencies.currency.manage, tenant-wide] (x-idempotency-key)
  return fakeDeactivateCurrency(id, key);
}

export async function listCurrencyCatalogue(lang: 'en' | 'ar'): Promise<CurrencyCatalogueEntry[]> {
  // no endpoint yet (plan D2)
  const cached = catalogueCache.get(lang);
  if (cached) {
    return cached.map((entry) => ({ ...entry }));
  }

  let displayNames: Intl.DisplayNames | null = null;
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
      displayNames = new Intl.DisplayNames([lang], { type: 'currency' });
    }
  } catch {
    displayNames = null;
  }

  const entries: CurrencyCatalogueEntry[] = supportedCurrencyCodes().map((code) => ({
    code,
    name: resolveCurrencyName(displayNames, code),
    symbol: resolveCurrencySymbol(lang, code),
    decimalPlaces: minorUnitsOf(code),
  }));

  catalogueCache.set(lang, entries);
  return entries.map((entry) => ({ ...entry }));
}

export async function getDefaultCurrency(): Promise<Currency | null> {
  const result = await listCurrencies({ isDefault: true, limit: 1 });
  return result.data[0] ?? null;
}
