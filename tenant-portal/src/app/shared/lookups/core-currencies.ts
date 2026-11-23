/*
 * Shared lookup: the tenant's active Core currencies, for any feature that only needs to pick or filter
 * by currency (e.g. CRM report filters). Owners of the currency screens use settings/currencies.api.
 * GET /api/tenant/core/v1/currencies?page&limit(<=100)&status=ACTIVE&sortBy=code&sortDir=ASC
 * [currencies.currency.read] -> Core envelope, a paged CorePage { data: Currency[], meta }.
 * Consumers check the tenant-wide read permission before calling this lookup.
 */
import { inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { CoreHttp } from '../../core/api/core-http';
import type { Currency } from '../../features/workspace/settings/currencies/currencies.model';

export type CoreCurrency = Currency;

/** CurrencyQueryDto allows at most 100 rows per page. */
const PAGE_LIMIT = 100;

/** Every active Core currency, ordered by code. Call in an Angular injection context. */
export async function listActiveCoreCurrencies(): Promise<CoreCurrency[]> {
  const http = inject(CoreHttp);
  // Keep each lookup's in-flight pages separate across session changes.
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, networkMode: 'always' } },
  });
  const all: CoreCurrency[] = [];
  for (let page = 1; ; page++) {
    // Tenant catalogue read: no organization scope headers.
    const result = await queries.fetchQuery({
      queryKey: ['core-currencies', page],
      queryFn: () => http.readPage<CoreCurrency>('/api/tenant/core/v1/currencies', {
        page,
        limit: PAGE_LIMIT,
        status: 'ACTIVE',
        sortBy: 'code',
        sortDir: 'ASC',
      }),
    });
    all.push(...result.data.filter((currency) => currency.status === 'ACTIVE'));
    if (!result.meta.hasNext) return all;
  }
}

/** Codes of every active Core currency, ordered by code. */
export async function listActiveCoreCurrencyCodes(): Promise<string[]> {
  return (await listActiveCoreCurrencies()).map((currency) => currency.code);
}
