import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../settings/shared/settings-api';
import { listTags } from '../../settings/tags/tags.api';
import { ACME_OPPORTUNITY_ID, fakeGetOpportunity } from '../opportunities.fake';
import { emptyDraft, toPatchBody } from './opportunity-draft';
import { diffOpportunityTags, saveTags } from './opportunity-tags-diff';

/**
 * `vi.mock` is not supported for relative imports in the Angular unit-test builder, so
 * saveTags is checked against the fake backend that `opportunities.api` delegates to.
 */
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

async function tagIdsOf(id: string): Promise<string[]> {
  return (await settle(fakeGetOpportunity(id))).tags.map((tag) => tag.id);
}

async function catalogIds(): Promise<string[]> {
  try {
    return (await settle(listTags())).map((tag) => tag.id);
  } catch {
    return ['tag-001', 'tag-002', 'tag-003', 'tag-004', 'tag-005'];
  }
}

describe('diffOpportunityTags', () => {
  it('returns attach and detach sets', () => {
    expect(diffOpportunityTags(['a', 'b'], ['b', 'c'])).toEqual({ attach: ['c'], detach: ['a'] });
  });

  it('is order-insensitive: a reorder is no change', () => {
    expect(diffOpportunityTags(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual({ attach: [], detach: [] });
  });

  it('drops duplicates', () => {
    expect(diffOpportunityTags(['a', 'a'], ['b', 'b', 'a'])).toEqual({ attach: ['b'], detach: [] });
  });

  it('handles empty before and empty after', () => {
    expect(diffOpportunityTags([], ['x', 'y'])).toEqual({ attach: ['x', 'y'], detach: [] });
    expect(diffOpportunityTags(['x', 'y'], [])).toEqual({ attach: [], detach: ['x', 'y'] });
  });
});

describe('saveTags (against the fake backend)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('attaches added ids and detaches removed ids so the opportunity ends with the target set', async () => {
    const before = await tagIdsOf(ACME_OPPORTUNITY_ID);
    expect(before.length).toBeGreaterThan(0);
    const extra = (await catalogIds()).filter((id) => !before.includes(id)).slice(0, 2);
    expect(extra.length).toBeGreaterThan(0);
    const after = [...before.slice(1), ...extra];

    const diff = await settle(saveTags(ACME_OPPORTUNITY_ID, before, after));

    expect(diff).toEqual({ attach: extra, detach: [before[0]] });
    expect(new Set(await tagIdsOf(ACME_OPPORTUNITY_ID))).toEqual(new Set(after));
  });

  it('returns an empty diff and changes nothing when the set is only reordered', async () => {
    const before = await tagIdsOf(ACME_OPPORTUNITY_ID);
    const stamp = (await settle(fakeGetOpportunity(ACME_OPPORTUNITY_ID))).updatedAt;

    const diff = await settle(saveTags(ACME_OPPORTUNITY_ID, before, [...before].reverse()));

    expect(diff).toEqual({ attach: [], detach: [] });
    expect((await settle(fakeGetOpportunity(ACME_OPPORTUNITY_ID))).updatedAt).toBe(stamp);
  });

  it('detaches every tag when the target is empty', async () => {
    const before = await tagIdsOf(ACME_OPPORTUNITY_ID);
    const diff = await settle(saveTags(ACME_OPPORTUNITY_ID, before, []));
    expect(diff).toEqual({ attach: [], detach: before });
    expect(await tagIdsOf(ACME_OPPORTUNITY_ID)).toEqual([]);
  });

  it('still saves tags when the PATCH body is null (tags-only edit)', async () => {
    const before = await tagIdsOf(ACME_OPPORTUNITY_ID);
    const extra = (await catalogIds()).find((id) => !before.includes(id));
    expect(extra).toBeDefined();
    const baseDraft = {
      ...emptyDraft({ branchId: 'br', companyId: null, ownerUserId: 'u1', pipeline: null, defaultCurrency: 'SAR' }),
      title: 'Deal',
      tagIds: before,
    };
    const nextDraft = { ...baseDraft, tagIds: [...before, extra as string] };
    expect(toPatchBody(baseDraft, nextDraft, '2026-11-21T00:00:00Z')).toBeNull();

    const diff = await settle(saveTags(ACME_OPPORTUNITY_ID, baseDraft.tagIds, nextDraft.tagIds));

    expect(diff).toEqual({ attach: [extra], detach: [] });
    expect(await tagIdsOf(ACME_OPPORTUNITY_ID)).toContain(extra);
  });

  it('attaches first: an attach failure rejects and no detach runs', async () => {
    const before = await tagIdsOf(ACME_OPPORTUNITY_ID);
    expect(before.length).toBeGreaterThan(0);

    let caught: unknown;
    try {
      await settle(saveTags(ACME_OPPORTUNITY_ID, before, ['no-such-tag']));
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect(new Set(await tagIdsOf(ACME_OPPORTUNITY_ID))).toEqual(new Set(before));
  });
});
