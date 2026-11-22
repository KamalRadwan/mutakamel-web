import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAKE_COMPANIES } from '../../../../core/scope/scope.fake';
import { fakeGetOpportunity, fakePatchOpportunity } from '../opportunities.fake';
import { opportunityRef } from '../opportunities.model';
import { companyIdForBranch, draftFromRow, isDirty, toCreateBody, toPatchBody } from './opportunity-draft';

// OP-30008: seeded record with KWD 6,200 on the session branch "Cairo HQ" (b1, company c1).
const OP_30008_ID = '0192b8ea-7c4f-7a7d-9c9f-51c7f2b30008';

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

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('companyIdForBranch', () => {
  it('returns the session company that owns the branch', () => {
    expect(companyIdForBranch('b1', FAKE_COMPANIES)).toBe('c1');
    expect(companyIdForBranch('b4', FAKE_COMPANIES)).toBe('c2');
  });

  it('returns null for an unknown or empty branch', () => {
    expect(companyIdForBranch('br-unknown', FAKE_COMPANIES)).toBeNull();
    expect(companyIdForBranch(null, FAKE_COMPANIES)).toBeNull();
    expect(companyIdForBranch('b1', [])).toBeNull();
  });
});

describe('draftFromRow on a loaded record (N2: OP-30008)', () => {
  it('carries the record currency, company and branch into the draft', async () => {
    const row = await settle(fakeGetOpportunity(OP_30008_ID));
    expect(opportunityRef(row.id)).toBe('OP-30008');
    expect(row.currencyCode).toBe('KWD');
    expect(row.amount).toBe('6200.00000000');

    const draft = draftFromRow(row, FAKE_COMPANIES);

    expect(draft.currencyCode).toBe('KWD');
    expect(draft.amount).toBe('6200.00000000');
    expect(draft.branchId).toBe(row.branchId);
    expect(draft.branchId).toBe('b1');
    expect(draft.companyId).toBe('c1');
  });

  it('is not dirty and sends no PATCH when nothing changed', async () => {
    const row = await settle(fakeGetOpportunity(OP_30008_ID));
    const base = draftFromRow(row, FAKE_COMPANIES);
    const draft = draftFromRow(row, FAKE_COMPANIES);

    expect(isDirty(base, draft)).toBe(false);
    expect(toPatchBody(base, draft, row.updatedAt)).toBeNull();
  });

  it('a save after editing another field keeps currency, amount and branch unchanged', async () => {
    const row = await settle(fakeGetOpportunity(OP_30008_ID));
    const base = draftFromRow(row, FAKE_COMPANIES);
    const edited = { ...base, title: `${base.title} (edited)` };

    const body = toPatchBody(base, edited, row.updatedAt);
    expect(body).toEqual({ expectedUpdatedAt: row.updatedAt, title: edited.title });
    expect(body).not.toHaveProperty('currencyCode');
    expect(body).not.toHaveProperty('amount');

    const saved = await settle(fakePatchOpportunity(row.id, body!));
    expect(saved.title).toBe(edited.title);
    expect(saved.currencyCode).toBe('KWD');
    expect(saved.amount).toBe('6200.00000000');
    expect(saved.branchId).toBe('b1');

    const after = draftFromRow(saved, FAKE_COMPANIES);
    expect(after).toMatchObject({ currencyCode: 'KWD', companyId: 'c1', branchId: 'b1' });
  });

  it('a create body built from the loaded draft keeps branch, amount and currency', async () => {
    const row = await settle(fakeGetOpportunity(OP_30008_ID));
    const body = toCreateBody(draftFromRow(row, FAKE_COMPANIES));

    expect(body.branchId).toBe('b1');
    expect(body.amount).toBe('6200.00000000');
    expect(body.currencyCode).toBe('KWD');
  });
});
