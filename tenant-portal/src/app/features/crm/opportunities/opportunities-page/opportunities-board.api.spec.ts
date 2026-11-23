import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { createOpportunity, listOpportunityReasons, loadBoard, loadOpportunityCards, loadStagePage } from '../opportunities.api';
import { branchId, companyId } from '../opportunity-page/opportunity-test-support';
import { configureListTest } from './opportunities-list-test-support';

describe.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('%s / %s', (lang, theme) => {
  describe('OpportunitiesApi', () => {
    let context: ReturnType<typeof configureListTest>;
    beforeEach(() => context = configureListTest(lang, theme));
    afterEach(async () => context.dispose());

    it('reasons', async () => {
      for (const kind of ['WIN', 'LOSS'] as const) {
        expect((await listOpportunityReasons({ kind })).items).toHaveLength(1);
      }
      expect(context.transport.recordedReads().map((call) => ({ path: call.path, query: call.query, scope: call.scope }))).toEqual([
        { path: '/opportunities/reasons', query: { kind: 'WIN' }, scope: undefined },
        { path: '/opportunities/reasons', query: { kind: 'LOSS' }, scope: undefined },
      ]);
    });

    it('uses bare POST reads with a key, session branch and no scope headers', async () => {
      const filterTree = { field: 'title', operator: 'contains', value: 'Office' };
      const body = { branchId: 'untrusted', filterTree, tagIds: ['tag'] };
      const summaries = await loadBoard('pipeline', { ...body, limitPerStage: 0 });
      expect(summaries.stages[0].items).toEqual([]);
      expect(summaries.stages[0].summary.totalCount).toBe(2);
      await loadStagePage('pipeline', 'new', { ...body, limit: 50, cursor: 'opaque' });
      const cards = await loadOpportunityCards('pipeline', { ...body, limit: 50 });
      expect(cards.items[0].title).toBe(context.transport.row.title);
      expect(context.transport.recordedReads()).toEqual([]);
      for (const sent of context.transport.recordedWrites()) {
        expect(sent.method).toBe('POST');
        expect(sent.body).toMatchObject({ branchId, filterTree, tagIds: ['tag'] });
        expect(sent.options.key).toMatch(/^[\da-f-]{14}7[\da-f-]{21}$/);
        expect(sent.options.scope).toBeUndefined();
      }
    });

    it('retains uncertain keys, changes keys for changed bodies and blocks mismatches', async () => {
      context.transport.writeErrors.push(new ApiError(503, 'SERVER_ERROR'));
      await expect(loadBoard('pipeline', { branchId, limitPerStage: 50 })).rejects.toMatchObject({ status: 503 });
      await loadBoard('pipeline', { branchId, limitPerStage: 50 });
      await loadBoard('pipeline', { branchId, limitPerStage: 0 });
      const writes = context.transport.recordedWrites();
      expect(writes[0].options.key).toBe(writes[1].options.key);
      expect(writes[2].options.key).not.toBe(writes[1].options.key);
      context.transport.writeErrors.push(new ApiError(422, 'GW.IDEM.MISMATCH'));
      await expect(loadBoard('pipeline', { branchId, limitPerStage: 50 })).rejects.toMatchObject({ code: 'GW.IDEM.MISMATCH' });
      await expect(loadBoard('pipeline', { branchId, limitPerStage: 50 })).rejects.toMatchObject({ code: 'GW.IDEM.MISMATCH' });
      expect(context.transport.recordedWrites()).toHaveLength(4);
    });

    it('blocks a company-only selection without a request', async () => {
      sessionStorage.setItem('tenant-staff-scope:opportunity-record-spec', JSON.stringify({ companyId, branchId: null }));
      expect(() => loadBoard('pipeline', { branchId, limitPerStage: 50 })).toThrowError('CRM_SCOPED_PERMISSION_DENIED');
      expect(context.transport.recordedWrites()).toEqual([]);
    });

    it('preserves create tagIds in the Wave B body', async () => {
      await createOpportunity({ branchId, pipelineId: 'pipeline', stageId: 'new', customerProfileId: 'customer', title: 'New', tagIds: ['tag'] }, '019f0000-0000-7000-8000-000000000999');
      expect(context.transport.recordedWrites()[0].body).toMatchObject({ tagIds: ['tag'] });
      expect(context.transport.recordedWrites()[0].options.scope).toBeUndefined();
    });
  });
});
