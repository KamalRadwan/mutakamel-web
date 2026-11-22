import { describe, expect, it } from 'vitest';
import {
  ApiError,
  cursorPageOf,
  errorCodeOf,
  idempotencyKeyOf,
  isAbortError,
  isUuidV7,
  newIdempotencyKey,
  pageOf,
  queueRun,
  replayOf,
  requestFingerprint,
  wireDetails,
  withRunSlot,
} from './analytics-api';

const items = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `i${i}` }));

describe('pageOf', () => {
  it('returns the first page with a next cursor when more items remain', () => {
    const page = pageOf(items(5), null, 2);
    expect(page.items.map((i) => i.id)).toEqual(['i0', 'i1']);
    expect(page.pageInfo.hasMore).toBe(true);
    expect(page.pageInfo.nextCursor).not.toBeNull();
  });

  it('walks every item across pages with no overlap', () => {
    const all = items(5);
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page: ReturnType<typeof pageOf<{ id: string }>> = pageOf(all, cursor, 2);
      seen.push(...page.items.map((i) => i.id));
      cursor = page.pageInfo.nextCursor;
    } while (cursor);
    expect(seen).toEqual(['i0', 'i1', 'i2', 'i3', 'i4']);
  });

  it('has no next cursor on the last page', () => {
    expect(pageOf(items(2), null, 2).pageInfo).toEqual({
      limit: 2,
      hasMore: false,
      nextCursor: null,
    });
  });

  it('clamps the limit to 100', () => {
    expect(pageOf(items(3), null, 1000).pageInfo.limit).toBe(100);
  });

  it('clamps a zero limit to 1', () => {
    expect(pageOf(items(3), null, 0).items).toHaveLength(1);
  });

  it('falls back to 20 for a non-finite limit', () => {
    expect(pageOf(items(3), null, Number.NaN).pageInfo.limit).toBe(20);
  });

  it('rejects a cursor with invalid characters', () => {
    expect(() => pageOf(items(3), '***')).toThrow(ApiError);
  });

  it('rejects a cursor that decodes to a non-number', () => {
    expect(() => pageOf(items(3), btoa('abc'))).toThrow(ApiError);
  });

  it('rejects a negative cursor index', () => {
    expect(() => pageOf(items(3), btoa('-1'))).toThrow(ApiError);
  });

  it('rejects a cursor index with a leading zero', () => {
    expect(() => pageOf(items(3), btoa('01'))).toThrow(ApiError);
  });

  it('reports the cursor error code', () => {
    let caught: unknown;
    try {
      pageOf(items(3), '***');
    } catch (e) {
      caught = e;
    }
    expect(errorCodeOf(caught)).toBe('CRM_DASHBOARD_LIST_CURSOR_INVALID');
  });
});

describe('cursorPageOf', () => {
  const v7 = (n: number) => `01934b60-0000-7000-8000-${String(n).padStart(12, '0')}`;
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: v7(i) }));

  it('continues after the item whose id is the cursor', () => {
    expect(cursorPageOf(rows(5), v7(1), 2).items.map((i) => i.id)).toEqual([v7(2), v7(3)]);
  });

  it('returns the last item id as the next cursor while more remain', () => {
    expect(cursorPageOf(rows(5), null, 2).nextCursor).toBe(v7(1));
  });

  it('returns a null next cursor at the end', () => {
    expect(cursorPageOf(rows(2), null, 2).nextCursor).toBeNull();
  });

  it('rejects a non-UUID-v7 cursor with 400 CRM_VALIDATION_FAILED keyed by cursor', () => {
    expect(() => cursorPageOf(rows(2), 'nope')).toThrow(
      expect.objectContaining({ status: 400, code: 'CRM_VALIDATION_FAILED', details: { cursor: ['is_uuid'] } }),
    );
  });

  it('returns an empty last page for a well-formed id that is no longer listed', () => {
    expect(cursorPageOf(rows(2), v7(99))).toEqual({ items: [], nextCursor: null });
  });
});

describe('errorCodeOf', () => {
  it('returns null for a non-ApiError', () => {
    expect(errorCodeOf(new Error('x'))).toBeNull();
  });
});

describe('queueRun', () => {
  it('runs a 9-widget dashboard through the 3 run slots without a 429', async () => {
    const work = (i: number) =>
      queueRun(() =>
        withRunSlot(
          () => new Promise<number>((resolve) => setTimeout(() => resolve(i), 5 + (i % 3) * 5)),
        ),
      );
    const results = await Promise.all(Array.from({ length: 9 }, (_, i) => work(i)));
    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('stops a queued run at once when its signal aborts', async () => {
    const hold = () =>
      queueRun(() => withRunSlot(() => new Promise<void>((resolve) => setTimeout(resolve, 20))));
    const running = [hold(), hold(), hold()];
    const controller = new AbortController();
    const queued = queueRun(() => Promise.resolve('late'), controller.signal);
    controller.abort();
    await expect(queued).rejects.toSatisfy(isAbortError);
    await Promise.all(running);
  });
});

describe('backend contract helpers', () => {
  it('accepts only UUID v7 ids, which the fakes also generate', () => {
    expect(isUuidV7(newIdempotencyKey())).toBe(true);
    expect(isUuidV7('01934b60-0000-7000-8000-000000000001')).toBe(true);
    expect(isUuidV7('01934b60-0000-4000-8000-000000000001')).toBe(false);
    expect(isUuidV7('dash-base-executive')).toBe(false);
  });

  it('keeps only string-array details, as the shared error filter does', () => {
    expect(wireDetails({ name: ['max_length'], reason: 'PDF_RENDERER_UNAVAILABLE', minW: 4, nested: { a: 1 } })).toEqual({
      name: ['max_length'],
    });
    expect(wireDetails({ field: 'name' })).toBeUndefined();
    expect(wireDetails({})).toBeUndefined();
  });

  it('rejects a missing or non-v7 idempotency key with 400 CRM_IDEMPOTENCY_KEY_INVALID and lowercases a good one', () => {
    for (const bad of [undefined, '', 'abc', '01934b60-0000-4000-8000-000000000001']) {
      expect(() => idempotencyKeyOf(bad)).toThrow(expect.objectContaining({ status: 400, code: 'CRM_IDEMPOTENCY_KEY_INVALID' }));
    }
    expect(idempotencyKeyOf(' 01934B60-0000-7000-8000-00000000000A ')).toBe('01934b60-0000-7000-8000-00000000000a');
  });

  it('replays the same body and answers a different body with 422 CRM_IDEMPOTENCY_KEY_REUSED', () => {
    const store = new Map([['k', { fingerprint: requestFingerprint({ a: 1, b: [2] }), response: 'stored' }]]);
    expect(replayOf(store, 'k', requestFingerprint({ b: [2], a: 1, c: undefined }))).toBe('stored');
    expect(replayOf(store, 'other', 'x')).toBeUndefined();
    expect(() => replayOf(store, 'k', requestFingerprint({ a: 2 }))).toThrow(
      expect.objectContaining({ status: 422, code: 'CRM_IDEMPOTENCY_KEY_REUSED' }),
    );
  });
});
