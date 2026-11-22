import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../shared/widgets/dashboard/analytics-api';
import { listCatalogue, listWholeCatalogue, setReportFavourite } from './catalogue.api';
import { REPORT_DOMAINS, countByDomain, isReportDisabled } from './catalogue.model';

async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    return error as ApiError;
  }
  throw new Error('expected an ApiError');
}

describe('report catalogue fake (GET /crm/dashboards/reports/catalogue)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns { items, pageInfo } with the default limit of 25', async () => {
    const page = await settle(listCatalogue());
    expect(page.items).toHaveLength(25);
    expect(page.pageInfo).toEqual({ limit: 25, hasMore: true, nextCursor: expect.any(String) });
  });

  it('orders by domain text, then code, then report key', async () => {
    const page = await settle(listCatalogue({ limit: 100 }));
    const keys = page.items.map((item) => [item.domain, item.code ?? '', item.reportKey]);
    const byTuple = (a: string[], b: string[]) => {
      const i = a.findIndex((part, index) => part !== b[index]);
      return i === -1 ? 0 : a[i] < b[i] ? -1 : 1;
    };
    expect(keys).toEqual([...keys].sort(byTuple));
    expect(keys.find((key) => key[0] === 'pipeline')?.[1]).toBe('');
  });

  it('matches q against the report key as well as code and titles', async () => {
    const page = await settle(listCatalogue({ q: 'missing-owner-audit' }));
    expect(page.items.map((item) => item.reportKey)).toEqual(['missing-owner-audit']);
  });

  it('trims q before the 120 character limit', async () => {
    await expect(settle(listCatalogue({ q: `  ${'a'.repeat(120)}  ` }))).resolves.toBeDefined();
    const error = await errorOf(listCatalogue({ q: 'a'.repeat(121) }));
    expect([error.status, error.code, error.details]).toEqual([400, 'CRM_VALIDATION_FAILED', { q: ['max_length'] }]);
  });

  it('refuses a limit above 100', async () => {
    const error = await errorOf(listCatalogue({ limit: 101 }));
    expect(error.details).toEqual({ limit: ['max'] });
  });

  it('favourite=false returns only non-favourites', async () => {
    const page = await settle(listCatalogue({ favourite: false, limit: 100 }));
    expect(page.items.every((item) => !item.favourite)).toBe(true);
  });

  it('reads the whole catalogue by cursor and counts domains on the client', async () => {
    const whole = await settle(listWholeCatalogue());
    expect(whole).toHaveLength(92);
    const counts = countByDomain(whole);
    expect(Object.keys(counts)).toEqual([...REPORT_DOMAINS]);
    expect(Object.values(counts).reduce((sum, n) => sum + n, 0)).toBe(92);
    const acquisition = await settle(listWholeCatalogue({ domain: 'acquisition' }));
    expect(counts.acquisition).toBe(acquisition.length);
  });

  it('availableOnly keeps only entries whose readiness is available, on the client', async () => {
    const whole = await settle(listWholeCatalogue());
    const available = await settle(listWholeCatalogue({ availableOnly: true }));
    expect(available.every((item) => !isReportDisabled(item.readiness))).toBe(true);
    expect(available.length).toBe(whole.filter((item) => !isReportDisabled(item.readiness)).length);
    expect(available.length).toBeLessThan(whole.length);
  });

  it('keeps the REPORT row id after unfavouriting, and 404s an unknown key', async () => {
    const on = await settle(setReportFavourite('lead-acquisition', true));
    const off = await settle(setReportFavourite('lead-acquisition', false));
    expect(off).toEqual({ dashboardId: on.dashboardId, favorite: false });
    const error = await errorOf(setReportFavourite('no-such-report', true));
    expect([error.status, error.code]).toEqual([404, 'CRM_REPORT_NOT_FOUND']);
  });
});
