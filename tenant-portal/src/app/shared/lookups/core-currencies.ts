/*
 * Shared lookup: the tenant's active Core currencies, for any feature that only needs to pick or filter
 * by currency (e.g. CRM report filters). Owners of the currency screens use settings/currencies.api.
 * GET /api/tenant/core/v1/currencies?page&limit(<=100)&status=ACTIVE&sortBy=code&sortDir=ASC
 * [currencies.currency.read] -> Core envelope, a paged CorePage { data: Currency[], meta }.
 * Reads every page from the same fake the Currencies settings screen uses, so both show one list.
 */
import type { CorePage } from '../../core/api/core-page';
import { fakeListCurrencies } from '../../features/workspace/settings/currencies/currencies.fake';
import type { Currency } from '../../features/workspace/settings/currencies/currencies.model';

export type CoreCurrency = Currency;

/** CurrencyQueryDto allows at most 100 rows per page. */
const PAGE_LIMIT = 100;

/** Every active Core currency, ordered by code. */
export async function listActiveCoreCurrencies(): Promise<CoreCurrency[]> {
  const all: CoreCurrency[] = [];
  for (let page = 1; ; page++) {
    const result: CorePage<CoreCurrency> = await fakeListCurrencies({
      page,
      limit: PAGE_LIMIT,
      status: 'ACTIVE',
      sortBy: 'code',
      sortDir: 'ASC',
    });
    all.push(...result.data.filter((currency) => currency.status === 'ACTIVE'));
    if (!result.meta.hasNext || result.data.length === 0) return all;
  }
}

/** Codes of every active Core currency, ordered by code. */
export async function listActiveCoreCurrencyCodes(): Promise<string[]> {
  return (await listActiveCoreCurrencies()).map((currency) => currency.code);
}
