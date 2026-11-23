import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { Query } from '../../../../shared/query-builder/query.model';
import { QueryCondition } from '../../../../shared/ui/query-builder/query-condition/query-condition';
import {
  configureListTest,
  settleList,
} from '../opportunities-page/opportunities-list-test-support';
import { branchId } from '../opportunity-page/opportunity-test-support';
import { compileOpportunityQuery } from './opportunity-search.compile';
import { opportunitySearchFields } from './opportunity-search.fields';
import { OpportunitySearchBuilder } from './opportunity-search-builder';
import { opportunityFilterIssues, withoutPipelineFilter } from './opportunity-search-errors';

describe.each([
  ['en', 'light'],
  ['en', 'dark'],
  ['ar', 'light'],
  ['ar', 'dark'],
])('%s / %s', (lang, theme) => {
  describe('OpportunitySearch', () => {
    let context: ReturnType<typeof configureListTest>;
    beforeEach(() => {
      context = configureListTest(lang, theme);
    });
    afterEach(async () => {
      await context.dispose();
    });
    it('filter errors by path', async () => {
      const query: Query = {
        fixed: [],
        root: {
          kind: 'group',
          id: 'root',
          op: 'AND',
          children: [
            { kind: 'condition', id: 'first', field: 'amount', operator: 'gte', value: 10 },
            {
              kind: 'group',
              id: 'nested',
              op: 'AND',
              children: [
                {
                  kind: 'condition',
                  id: 'second',
                  field: 'probability',
                  operator: 'gte',
                  value: 25,
                },
              ],
            },
          ],
        },
      };
      const body = compileOpportunityQuery(query, {
        branchId,
        meUserId: 'owner',
        timeZone: 'UTC',
      }).body;
      const fixture = TestBed.createComponent(OpportunitySearchBuilder);
      fixture.componentRef.setInput(
        'fields',
        opportunitySearchFields({
          t: (key) => key,
          stages: [],
          sources: [],
          tags: [],
          currencies: [],
          winReasons: [],
          lossReasons: [],
          owners: async () => [],
          teams: async () => [],
          customers: async () => [],
          language: lang as 'en' | 'ar',
        }),
      );
      fixture.componentRef.setInput('applied', query);
      fixture.componentRef.setInput('body', body);
      for (const code of ['INVALID_FILTER_TREE', 'INVALID_FIELD', 'INVALID_OPERATOR_VALUE']) {
        const error = new ApiError(400, code, {
          path: ['filterTree.children[1]'],
          field: ['probabilityPercent'],
          operator: ['gte'],
          reason: ['value_range'],
        });
        expect(
          opportunityFilterIssues(error, query, body, 'UTC').map((issue) => issue.nodeIds),
        ).toEqual([['second']]);
        fixture.componentRef.setInput('serverError', error);
        await settleList(() => fixture.detectChanges());
        const rows = fixture.debugElement.queryAll(By.directive(QueryCondition));
        const target = rows.find(
          (row) => (row.componentInstance as QueryCondition).condition().id === 'second',
        )!;
        const first = rows.find(
          (row) => (row.componentInstance as QueryCondition).condition().id === 'first',
        )!;
        expect(target.nativeElement.querySelector('[aria-live="polite"]')).not.toBeNull();
        expect(first.nativeElement.querySelector('[aria-live="polite"]')).toBeNull();
        expect(target.nativeElement.querySelector('[aria-describedby]')).not.toBeNull();
      }
    });
    it('places tag conflicts on the tag facet', () => {
      const query: Query = {
        root: { kind: 'group', id: 'root', op: 'AND', children: [] },
        fixed: [
          { kind: 'condition', id: 'tag-facet', field: 'tags', operator: 'hasAny', value: ['tag'] },
        ],
      };
      const error = new ApiError(422, 'OPPORTUNITY_FILTER_TAGS_CONFLICT');
      expect(opportunityFilterIssues(error, query, { branchId }, 'UTC')[0].nodeIds).toEqual([
        'tag-facet',
      ]);
    });
    it('resets only a missing hidden pipeline filter', () => {
      const amount = { field: 'amount', operator: 'gte', value: '10' };
      expect(
        withoutPipelineFilter({
          op: 'AND',
          children: [{ field: 'pipelineId', operator: 'eq', value: 'missing' }, amount],
        }),
      ).toEqual(amount);
    });
  });
});
