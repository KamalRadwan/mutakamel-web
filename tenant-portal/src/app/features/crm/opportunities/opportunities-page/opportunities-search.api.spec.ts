import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { searchOpportunities } from '../opportunities.api';
import { OpportunitySearchBody } from '../opportunities.model';
import { branchId, companyId } from '../opportunity-page/opportunity-test-support';
import { configureListTest } from './opportunities-list-test-support';

describe.each([
  ['en', 'light'],
  ['en', 'dark'],
  ['ar', 'light'],
  ['ar', 'dark'],
])('%s / %s', (lang, theme) => {
  describe('OpportunitiesApi', () => {
    let context: ReturnType<typeof configureListTest>;
    beforeEach(() => {
      context = configureListTest(lang, theme);
    });
    afterEach(async () => {
      await context.dispose();
    });
    it('search body', async () => {
      const input = {
        branchId: 'untrusted-branch',
        search: 'Equipment',
        searchField: 'opportunity',
        filterTree: { field: 'amount', operator: 'gte', value: '5000' },
        tagIds: ['tag'],
        sort: 'updatedAt:DESC',
        select: ['id'],
        addSelect: ['title'],
        relations: ['owner'],
        withDeleted: true,
      };
      const result = await searchOpportunities(input as OpportunitySearchBody, 2, 50);
      expect(result.total).toBe(130);
      expect(context.transport.recordedWrites()).toHaveLength(1);
      const sent = context.transport.recordedWrites()[0];
      expect(sent).toMatchObject({
        method: 'POST',
        path: '/opportunities/search',
        body: {
          branchId,
          search: 'Equipment',
          searchField: 'opportunity',
          filterTree: input.filterTree,
          tagIds: ['tag'],
          sort: 'updatedAt:DESC',
          page: 2,
          limit: 50,
        },
      });
      expect(Object.keys(sent.body as object).sort()).toEqual(
        [
          'branchId',
          'search',
          'searchField',
          'filterTree',
          'tagIds',
          'sort',
          'page',
          'limit',
        ].sort(),
      );
      expect(sent.options.key).toMatch(/^[\da-f-]{14}7[\da-f-]{21}$/);
      expect(sent.options.scope).toBeUndefined();
      expect(context.transport.recordedReads()).toEqual([]);
    });
    it('keeps the key for uncertain reads and changes it with the body', async () => {
      context.transport.searchFailure = new ApiError(503, 'SERVER_ERROR');
      const body = { branchId, search: 'A' };
      await expect(searchOpportunities(body, 1, 20)).rejects.toMatchObject({ status: 503 });
      context.transport.searchFailure = null;
      await searchOpportunities(body, 1, 20);
      const writes = context.transport.recordedWrites();
      expect(writes[0].options.key).toBe(writes[1].options.key);
      await searchOpportunities({ ...body, search: 'B' }, 1, 20);
      expect(context.transport.recordedWrites()[2].options.key).not.toBe(writes[1].options.key);
    });
    it('refuses a company-only branch without transport', async () => {
      sessionStorage.setItem(
        'tenant-staff-scope:opportunity-record-spec',
        JSON.stringify({ companyId, branchId: null }),
      );
      await expect(searchOpportunities({ branchId }, 1, 20)).rejects.toMatchObject({ status: 403 });
      expect(context.transport.recordedWrites()).toEqual([]);
    });
    it('never resends an idempotency mismatch', async () => {
      context.transport.searchFailure = new ApiError(422, 'GW.IDEM.MISMATCH');
      await expect(searchOpportunities({ branchId }, 1, 20)).rejects.toMatchObject({
        code: 'GW.IDEM.MISMATCH',
      });
      context.transport.searchFailure = null;
      await expect(searchOpportunities({ branchId }, 1, 20)).rejects.toMatchObject({
        code: 'GW.IDEM.MISMATCH',
      });
      expect(context.transport.recordedWrites()).toHaveLength(1);
    });
  });
});
