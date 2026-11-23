import { Service, inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { CoreHttp } from '../../../../core/api/core-http';
import { AuthSession } from '../../../../core/auth/auth-session';
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

const CURRENCIES_PATH = '/api/tenant/core/v1/currencies';

@Service()
export class CurrenciesApi {
  private readonly http = inject(CoreHttp);
  private readonly session = inject(AuthSession);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { retry: false, networkMode: 'always', gcTime: 0 } },
  });

  listCurrencies(query: CurrencyListQuery = {}): Promise<CorePage<Currency>> {
    const params = { ...query, page: Math.max(1, query.page ?? 1), limit: Math.min(100, Math.max(1, query.limit ?? 20)) };
    return this.queries.fetchQuery({
      queryKey: ['ws-currencies', this.session.me()?.id, params],
      queryFn: () => this.http.readPage<Currency>(CURRENCIES_PATH, params),
    });
  }

  async getDefaultCurrency(): Promise<Currency | null> {
    return (await this.listCurrencies({ isDefault: true, limit: 1 })).data[0] ?? null;
  }

  createCurrency(body: CreateCurrencyBody, key: string): Promise<Currency> {
    return this.write('POST', CURRENCIES_PATH, body, key);
  }

  updateCurrency(id: string, body: UpdateCurrencyBody, key: string): Promise<Currency> {
    return this.write('PATCH', `${CURRENCIES_PATH}/${encodeURIComponent(id)}`, body, key);
  }

  setDefaultCurrency(id: string, key: string): Promise<Currency> {
    return this.write('POST', `${CURRENCIES_PATH}/${encodeURIComponent(id)}/set-default`, undefined, key);
  }

  async deactivateCurrency(id: string, key: string): Promise<void> {
    await this.write<void>('DELETE', `${CURRENCIES_PATH}/${encodeURIComponent(id)}`, undefined, key);
  }

  listCurrencyCatalogue(lang: 'en' | 'ar'): Promise<CurrencyCatalogueEntry[]> {
    return listCurrencyCatalogue(lang);
  }

  private async write<T = Currency>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body: unknown, key: string): Promise<T> {
    const result = await this.http.write<T>(method, path, body, { key, noBody: body === undefined });
    const filters = { queryKey: ['ws-currencies'] };
    await this.queries.cancelQueries(filters);
    await this.queries.invalidateQueries(filters);
    return result.data;
  }
}

export async function listCurrencyCatalogue(lang: 'en' | 'ar'): Promise<CurrencyCatalogueEntry[]> {
  // The ISO catalogue is client-side by contract (Intl).
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
