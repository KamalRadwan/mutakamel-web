import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAKE_COMPANIES } from '../../../../core/scope/scope.fake';
import { ApiError, newIdempotencyKey } from '../trade-api';
import {
  fakeCountTerms,
  fakeCreateTerm,
  fakeDeleteTerm,
  fakeGetTerm,
  fakeListTermOptions,
  fakeListTerms,
  fakeMakeDefaultTerm,
  fakeUpdateTerm,
} from './terms.fake';
import { TERM_LIMITS, TERM_TYPES, type TermInput } from './terms.model';

async function settle<T>(promise: Promise<T>): Promise<T> {
  const caught = promise.catch((e: unknown) => e);
  await vi.advanceTimersByTimeAsync(350);
  const result = await caught;
  if (result instanceof Error) throw result;
  return result as T;
}

async function settleError(promise: Promise<unknown>): Promise<ApiError> {
  const caught = promise.then(
    () => null,
    (e: unknown) => e,
  );
  await vi.advanceTimersByTimeAsync(350);
  const result = await caught;
  expect(result).toBeInstanceOf(ApiError);
  return result as ApiError;
}

let keySeq = 0;
const nextKey = () => {
  keySeq += 1;
  return newIdempotencyKey();
};

function input(over: Partial<TermInput> = {}): TermInput {
  return {
    termType: 'GENERAL',
    side: 'BOTH',
    code: `SPEC${keySeq + 1}`,
    localizedNames: { en: 'Spec term', ar: 'شرط اختبار' },
    localizedTexts: { en: 'Spec text', ar: 'نص الاختبار' },
    sortOrder: 5,
    isActive: true,
    ...over,
  };
}

describe('terms.fake catalogue limits (§6)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem('lang');
    document.documentElement.lang = 'en';
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.removeItem('lang');
  });

  it('defines textMax = 400 and maxClauses = 4', () => {
    expect(TERM_LIMITS.nameMax).toBe(120);
    expect(TERM_LIMITS.textMax).toBe(400);
    expect(TERM_LIMITS.maxClauses).toBe(4);
  });

  it('keeps every seeded term text in en and ar at most 400 characters', async () => {
    let checked = 0;

    for (const company of FAKE_COMPANIES) {
      for (const type of TERM_TYPES) {
        const page = await settle(fakeListTerms(company.id, { type, limit: 100 }));
        const terms = page.items;

        for (const term of terms) {
          checked += 1;
          const enText = term.localizedTexts['en'] ?? '';
          const arText = term.localizedTexts['ar'] ?? '';
          const enName = term.localizedNames['en'] ?? '';
          const arName = term.localizedNames['ar'] ?? '';

          expect(enText.length).toBeLessThanOrEqual(TERM_LIMITS.textMax);
          expect(arText.length).toBeLessThanOrEqual(TERM_LIMITS.textMax);
          expect(enName.length).toBeLessThanOrEqual(TERM_LIMITS.nameMax);
          expect(arName.length).toBeLessThanOrEqual(TERM_LIMITS.nameMax);
        }
      }
    }

    expect(checked).toBeGreaterThan(0);
  });

  it('rejects creating a term with text exceeding 400 characters', async () => {
    const createPromise = fakeCreateTerm(
      FAKE_COMPANIES[0].id,
      {
        termType: 'GENERAL',
        side: 'BOTH',
        code: 'TOOLONG401',
        localizedNames: { en: 'Too long test', ar: 'اختبار طويل' },
        localizedTexts: { en: 'a'.repeat(401), ar: 'ن'.repeat(20) },
        sortOrder: 99,
        isActive: true,
      },
      newIdempotencyKey(),
    );

    const rejection = expect(createPromise).rejects.toMatchObject({
      status: 400,
      code: 'TRADE.VALIDATION_FAILED',
    });
    await vi.advanceTimersByTimeAsync(350);
    await rejection;
  });

  it('lists as { items, total, page, limit } with default limit 25, max 100 and the `active` filter', async () => {
    const companyId = FAKE_COMPANIES[0].id;
    const all = await settle(fakeListTerms(companyId));
    expect(all.page).toBe(1);
    expect(all.limit).toBe(25);
    expect(all.items.length).toBe(Math.min(25, all.total));

    const second = await settle(fakeListTerms(companyId, { page: 2, limit: 10 }));
    expect(second.items.length).toBe(Math.min(10, Math.max(0, second.total - 10)));

    const payment = await settle(fakeListTerms(companyId, { type: 'PAYMENT', limit: 100 }));
    const inactive = await settle(fakeListTerms(companyId, { type: 'PAYMENT', active: false, limit: 100 }));
    const active = await settle(fakeListTerms(companyId, { type: 'PAYMENT', active: true, limit: 100 }));
    expect(inactive.items.every((t) => !t.isActive)).toBe(true);
    expect(active.total + inactive.total).toBe(payment.total);
    expect(payment.items.every((t) => !('companyId' in t))).toBe(true);

    expect((await settleError(fakeListTerms(companyId, { limit: 101 }))).status).toBe(400);
  });

  it('counts as { total, byType }', async () => {
    const companyId = FAKE_COMPANIES[0].id;
    const counts = await settle(fakeCountTerms(companyId));
    const activeOnly = await settle(fakeCountTerms(companyId, { active: true }));
    expect(Object.keys(counts.byType).sort()).toEqual([...TERM_TYPES].sort());
    expect(counts.total).toBe(Object.values(counts.byType).reduce((a, b) => a + b, 0));
    expect(activeOnly.total).toBeLessThan(counts.total);
  });

  it('rejects null dueDays / incotermCode on types that do not use them (TYPE_FIELD_INVALID)', async () => {
    const companyId = FAKE_COMPANIES[0].id;
    for (const over of [{ dueDays: null }, { incotermCode: null }] as const) {
      const error = await settleError(fakeCreateTerm(companyId, input(over), nextKey()));
      expect(error).toMatchObject({ status: 422, code: 'TRADE.TERMS.TYPE_FIELD_INVALID' });
    }
    const created = await settle(fakeCreateTerm(companyId, input(), nextKey()));
    expect(created).toMatchObject({ dueDays: null, incotermCode: null });
    const patchError = await settleError(fakeUpdateTerm(companyId, created.id, `"${created.version}"`, { dueDays: null }, nextKey()));
    expect(patchError.code).toBe('TRADE.TERMS.TYPE_FIELD_INVALID');

    const payment = await settle(fakeCreateTerm(companyId, input({ termType: 'PAYMENT', dueDays: null }), nextKey()));
    expect(payment.dueDays).toBeNull();
  });

  it('rejects a blank text even for an inactive term, allows an absent one', async () => {
    const companyId = FAKE_COMPANIES[0].id;
    const blank = await settleError(
      fakeCreateTerm(companyId, input({ isActive: false, localizedTexts: { en: '', ar: 'نص' } }), nextKey()),
    );
    expect(blank).toMatchObject({ status: 400, code: 'TRADE.VALIDATION_FAILED' });

    const missingActive = await settleError(
      fakeCreateTerm(companyId, input({ localizedTexts: { ar: 'نص' } }), nextKey()),
    );
    expect(missingActive).toMatchObject({ status: 422, code: 'TRADE.TERMS.TEXT_REQUIRED' });

    const inactive = await settle(fakeCreateTerm(companyId, input({ isActive: false, localizedTexts: {} }), nextKey()));
    expect((await settle(fakeGetTerm(companyId, inactive.id))).localizedTexts).toEqual({});
  });

  it('validates idempotency keys like the backend: missing 400, not UUIDv7 422, mismatch 422, replay', async () => {
    const companyId = FAKE_COMPANIES[0].id;
    expect(await settleError(fakeCreateTerm(companyId, input(), ''))).toMatchObject({
      status: 400,
      code: 'TRADE.IDEMPOTENCY.KEY_MISSING',
    });
    expect(await settleError(fakeCreateTerm(companyId, input(), 'not-a-uuid'))).toMatchObject({
      status: 422,
      code: 'TRADE.IDEMPOTENCY.KEY_REQUIRED',
    });
    const key = nextKey();
    const body = input();
    const first = await settle(fakeCreateTerm(companyId, body, key));
    const again = await settle(fakeCreateTerm(companyId, body, key));
    expect(again.id).toBe(first.id);
    expect(await settleError(fakeCreateTerm(companyId, { ...body, sortOrder: 6 }, key))).toMatchObject({
      status: 422,
      code: 'TRADE.IDEMPOTENCY.MISMATCH',
    });
  });

  it('matches the code as sent (no upper-casing), defaults sortOrder 0 / isActive true, CODE_TAKEN with details', async () => {
    const companyId = FAKE_COMPANIES[0].id;
    expect(await settleError(fakeCreateTerm(companyId, input({ code: 'lower' }), nextKey()))).toMatchObject({
      status: 400,
      code: 'TRADE.VALIDATION_FAILED',
    });
    const { sortOrder: _s, isActive: _a, ...rest } = input({ code: 'DEFAULTS1' });
    const created = await settle(fakeCreateTerm(companyId, rest, nextKey()));
    expect(created).toMatchObject({ sortOrder: 0, isActive: true, isDefault: false, version: 1 });
    const taken = await settleError(fakeCreateTerm(companyId, input({ code: 'DEFAULTS1' }), nextKey()));
    expect(taken).toMatchObject({ status: 409, code: 'TRADE.TERMS.CODE_TAKEN', details: { field: ['code'] } });
  });

  it('reports TEXT_REQUIRED with details.field localizedTexts', async () => {
    const error = await settleError(
      fakeCreateTerm(FAKE_COMPANIES[0].id, input({ localizedTexts: { en: 'Only en' } }), nextKey()),
    );
    expect(error).toMatchObject({ status: 422, details: { field: ['localizedTexts'] } });
  });

  it('PATCH / make-default / DELETE need a key and If-Match; NOT_FOUND is 404, stale is 409', async () => {
    const companyId = FAKE_COMPANIES[0].id;
    const term = await settle(fakeCreateTerm(companyId, input(), nextKey()));
    expect(await settleError(fakeUpdateTerm(companyId, term.id, '"1"', { sortOrder: 1 }, ''))).toMatchObject({
      status: 400,
      code: 'TRADE.IDEMPOTENCY.KEY_MISSING',
    });
    expect(await settleError(fakeUpdateTerm(companyId, term.id, '', { sortOrder: 1 }, nextKey()))).toMatchObject({
      status: 400,
      code: 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED',
    });
    expect(await settleError(fakeUpdateTerm(companyId, 'missing', '"1"', {}, nextKey()))).toMatchObject({
      status: 404,
      code: 'TRADE.TERMS.NOT_FOUND',
    });
    expect(await settleError(fakeMakeDefaultTerm(companyId, term.id, '"9"', nextKey()))).toMatchObject({
      status: 409,
      code: 'TRADE.CONCURRENCY.STALE_VERSION',
    });
    const updated = await settle(fakeUpdateTerm(companyId, term.id, '"1"', { sortOrder: 7 }, nextKey()));
    expect(updated).toMatchObject({ sortOrder: 7, version: 2 });
    const deleted = await settle(fakeDeleteTerm(companyId, term.id, '"2"', nextKey()));
    expect(deleted).toMatchObject({ id: term.id, version: 3 });
    expect((await settleError(fakeGetTerm(companyId, term.id))).status).toBe(404);
  });

  it('options return active terms of the document side or BOTH with defaults', async () => {
    const options = await settle(fakeListTermOptions(FAKE_COMPANIES[0].id, 'QUOTATION'));
    expect(Object.keys(options.byType).sort()).toEqual([...TERM_TYPES].sort());
    for (const rows of Object.values(options.byType)) {
      expect(rows.every((t) => t.isActive && (t.side === 'SALES' || t.side === 'BOTH'))).toBe(true);
    }
  });
});
