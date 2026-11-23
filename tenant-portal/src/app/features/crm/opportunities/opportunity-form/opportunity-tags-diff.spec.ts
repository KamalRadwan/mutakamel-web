import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bindCrmHttpForTest } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { diffOpportunityTags, saveTags } from './opportunity-tags-diff';
import { ApiError } from '../../../../core/api/api-errors';

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

describe('saveTags (live transport)', () => {
  let stub: CrmHttpStub;
  let dispose: () => void;
  beforeEach(() => { stub = new CrmHttpStub(); dispose = bindCrmHttpForTest(stub); });
  afterEach(() => dispose());
  it('attaches additions before detaching removals with keyed writes', async () => {
    expect(await saveTags('record', ['a', 'b'], ['b', 'c'])).toEqual({ attach: ['c'], detach: ['a'] });
    expect(stub.recordedWrites().map(({ method, path, body }) => ({ method, path, body }))).toEqual([
      { method: 'POST', path: '/opportunities/record/tags', body: { tagIds: ['c'] } },
      { method: 'DELETE', path: '/opportunities/record/tags/a', body: {} },
    ]);
    expect(stub.recordedWrites().every((write) => !!write.options.key && !write.options.scope)).toBe(true);
  });
  it('does not write for reordered tags', async () => {
    await saveTags('record', ['a', 'b'], ['b', 'a']);
    expect(stub.recordedWrites()).toEqual([]);
  });
  it('detaches all tags when the target is empty', async () => {
    await saveTags('record', ['a', 'b'], []);
    expect(stub.recordedWrites().map((write) => write.path)).toEqual(['/opportunities/record/tags/a', '/opportunities/record/tags/b']);
  });
  it('does not detach after an attach fails', async () => {
    const fail = bindCrmHttpForTest({ ...stub, read: stub.read.bind(stub), readBlob: stub.readBlob.bind(stub), writeMultipart: stub.writeMultipart.bind(stub), write: async () => { throw new ApiError(422, 'CRM_TAG_UNKNOWN'); } });
    try { await expect(saveTags('record', ['a'], ['bad'])).rejects.toMatchObject({ code: 'CRM_TAG_UNKNOWN' }); }
    finally { fail(); }
    expect(stub.recordedWrites()).toEqual([]);
  });
});
