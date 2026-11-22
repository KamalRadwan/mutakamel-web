import { describe, expect, it } from 'vitest';
import { resolveDate } from '../../../../shared/query-builder/query-dates';
import { Query } from '../../../../shared/query-builder/query.model';
import { ApiError } from '../../settings/shared/settings-api';
import {
  CompileOpportunityContext,
  compileOpportunityQuery,
  normalizePhoneTerm,
  opportunitySearchErrorKey,
} from './opportunity-search.compile';

const CTX: CompileOpportunityContext = {
  branchId: 'b1',
  pipelineId: 'pipe-sales',
  meUserId: 'u1',
  timeZone: 'Africa/Cairo',
  now: new Date('2026-11-21T12:00:00Z'),
};

describe('compileOpportunityQuery', () => {
  it('always includes pipelineId eq leaf at the top of filterTree even on empty query', () => {
    const query: Query = {
      fixed: [],
      root: { kind: 'group', id: 'root', op: 'AND', children: [] },
    };

    expect(compileOpportunityQuery(query, CTX)).toEqual({
      body: {
        branchId: 'b1',
        filterTree: { field: 'pipelineId', operator: 'eq', value: 'pipe-sales' },
      },
      rejected: [],
    });
  });

  it('omits pipelineId and includes customerPartyId in all-pipelines customer drill-in mode', () => {
    const query: Query = {
      fixed: [],
      root: { kind: 'group', id: 'root', op: 'AND', children: [] },
    };

    expect(
      compileOpportunityQuery(query, {
        ...CTX,
        pipelineId: null,
        customerPartyId: 'party-acme',
      }),
    ).toEqual({
      body: {
        branchId: 'b1',
        filterTree: { field: 'customerPartyId', operator: 'eq', value: 'party-acme' },
      },
      rejected: [],
    });
  });

  it('normalizes phone search terms and maps single text facets to search/searchField', () => {
    const query: Query = {
      fixed: [{ kind: 'condition', id: 'ph1', field: 'phone', operator: 'contains', value: ' 0020 (10) 123-4567 ' }],
      root: { kind: 'group', id: 'root', op: 'AND', children: [] },
    };

    expect(normalizePhoneTerm(' 0020 (10) 123-4567 ')).toBe('+20101234567');
    expect(compileOpportunityQuery(query, CTX)).toEqual({
      body: {
        branchId: 'b1',
        search: '+20101234567',
        searchField: 'phone',
        filterTree: { field: 'pipelineId', operator: 'eq', value: 'pipe-sales' },
      },
      rejected: [],
    });
  });

  it('demotes an extra q facet to title contains and rejects extra customer/email/phone facets', () => {
    const withExtraQ: Query = {
      fixed: [
        { kind: 'condition', id: 'f1', field: 'customer', operator: 'contains', value: 'Acme' },
        { kind: 'condition', id: 'f2', field: 'q', operator: 'contains', value: 'POS rollout' },
      ],
      root: { kind: 'group', id: 'root', op: 'AND', children: [] },
    };

    expect(compileOpportunityQuery(withExtraQ, CTX)).toEqual({
      body: {
        branchId: 'b1',
        search: 'Acme',
        searchField: 'customer',
        filterTree: {
          op: 'AND',
          children: [
            { field: 'pipelineId', operator: 'eq', value: 'pipe-sales' },
            { field: 'title', operator: 'contains', value: 'POS rollout' },
          ],
        },
      },
      rejected: [],
    });

    const withExtraEmail: Query = {
      fixed: [
        { kind: 'condition', id: 'f1', field: 'q', operator: 'contains', value: 'ERP' },
        { kind: 'condition', id: 'f2', field: 'email', operator: 'contains', value: 'sales@acme.com' },
      ],
      root: { kind: 'group', id: 'root', op: 'AND', children: [] },
    };

    expect(compileOpportunityQuery(withExtraEmail, CTX)).toEqual({
      body: {
        branchId: 'b1',
        search: 'ERP',
        searchField: 'opportunity',
        filterTree: { field: 'pipelineId', operator: 'eq', value: 'pipe-sales' },
      },
      rejected: [{ field: 'email', reasonKey: 'search.rejected.oneTextFacet' }],
    });
  });

  it('expands OPEN status to IN_PROGRESS and ON_HOLD while deduplicating', () => {
    const query: Query = {
      fixed: [],
      root: {
        kind: 'group',
        id: 'root',
        op: 'AND',
        children: [
          { kind: 'condition', id: 's1', field: 'status', operator: 'eq', value: 'OPEN' },
          { kind: 'condition', id: 's2', field: 'status', operator: 'nin', value: ['OPEN', 'WON'] },
        ],
      },
    };

    expect(compileOpportunityQuery(query, CTX)).toEqual({
      body: {
        branchId: 'b1',
        filterTree: {
          op: 'AND',
          children: [
            { field: 'pipelineId', operator: 'eq', value: 'pipe-sales' },
            { field: 'status', operator: 'in', value: ['IN_PROGRESS', 'ON_HOLD'] },
            { field: 'status', operator: 'nin', value: ['IN_PROGRESS', 'ON_HOLD', 'WON'] },
          ],
        },
      },
      rejected: [],
    });
  });

  it('compiles tags as tagIds anyOf leaf inside filterTree and never emits top-level tagIds', () => {
    const query: Query = {
      fixed: [],
      root: {
        kind: 'group',
        id: 'root',
        op: 'AND',
        children: [{ kind: 'condition', id: 't1', field: 'tags', operator: 'hasAny', value: ['tag-2', 'tag-1'] }],
      },
    };

    const result = compileOpportunityQuery(query, CTX);
    expect(result.body.tagIds).toBeUndefined();
    expect(result.body).toEqual({
      branchId: 'b1',
      filterTree: {
        op: 'AND',
        children: [
          { field: 'pipelineId', operator: 'eq', value: 'pipe-sales' },
          { field: 'tagIds', operator: 'anyOf', value: ['tag-1', 'tag-2'] },
        ],
      },
    });
  });

  it('compiles closing as calendar expectedCloseDate and created/updated via resolveDate', () => {
    const query: Query = {
      fixed: [],
      root: {
        kind: 'group',
        id: 'root',
        op: 'OR',
        children: [
          { kind: 'condition', id: 'c1', field: 'closing', operator: 'relative', value: 'last7' },
          { kind: 'condition', id: 'c2', field: 'created', operator: 'on', value: '2026-11-21' },
        ],
      },
    };

    const createdRange = resolveDate('on', '2026-11-21', CTX.timeZone, CTX.now);

    expect(compileOpportunityQuery(query, CTX)).toEqual({
      body: {
        branchId: 'b1',
        filterTree: {
          op: 'AND',
          children: [
            { field: 'pipelineId', operator: 'eq', value: 'pipe-sales' },
            {
              op: 'OR',
              children: [
                { field: 'expectedCloseDate', operator: 'between', value: ['2026-11-15', '2026-11-21'] },
                {
                  op: 'AND',
                  children: [
                    { field: 'createdAt', operator: 'gte', value: createdRange.gte },
                    { field: 'createdAt', operator: 'lt', value: createdRange.lt },
                  ],
                },
              ],
            },
          ],
        },
      },
      rejected: [],
    });
  });

  it('resolves $me, empty/non-empty contact & fromLead, and numeric fields', () => {
    const query: Query = {
      fixed: [],
      root: {
        kind: 'group',
        id: 'root',
        op: 'AND',
        children: [
          { kind: 'condition', id: 'o1', field: 'owner', operator: 'eq', value: '$me' },
          { kind: 'condition', id: 'o2', field: 'createdBy', operator: 'in', value: ['$me', 'u2'] },
          { kind: 'condition', id: 'k1', field: 'contact', operator: 'isNotNull', value: undefined },
          { kind: 'condition', id: 'l1', field: 'fromLead', operator: 'isNull', value: undefined },
          { kind: 'condition', id: 'a1', field: 'amount', operator: 'gte', value: 10000 },
        ],
      },
    };

    expect(compileOpportunityQuery(query, CTX)).toEqual({
      body: {
        branchId: 'b1',
        filterTree: {
          op: 'AND',
          children: [
            { field: 'pipelineId', operator: 'eq', value: 'pipe-sales' },
            { field: 'ownerUserId', operator: 'eq', value: 'u1' },
            { field: 'createdByUserId', operator: 'in', value: ['u1', 'u2'] },
            { field: 'contactPartyId', operator: 'isNotNull' },
            { field: 'leadId', operator: 'isNull' },
            { field: 'amount', operator: 'gte', value: 10000 },
          ],
        },
      },
      rejected: [],
    });
  });

  it('maps backend search validation errors to search.rejected keys', () => {
    expect(opportunitySearchErrorKey(new ApiError(422, 'OPPORTUNITY_FILTER_TAGS_CONFLICT'))).toBe(
      'opportunities.search.rejected.tagsConflict',
    );
    expect(opportunitySearchErrorKey(new ApiError(400, 'INVALID_FIELD', { field: ['bad'], path: ['filterTree'] }))).toBe(
      'opportunities.search.rejected.invalidField',
    );
    expect(
      opportunitySearchErrorKey(
        new ApiError(400, 'INVALID_OPERATOR_VALUE', {
          path: ['filterTree'],
          field: ['title'],
          operator: ['gt'],
          reason: ['operator_not_allowed'],
        }),
      ),
    ).toBe('opportunities.search.rejected.operatorNotAllowed');
    expect(
      opportunitySearchErrorKey(new ApiError(400, 'INVALID_OPERATOR_VALUE', { operator: ['gt'], reason: ['OPERATOR_NOT_ALLOWED'] })),
    ).toBe('opportunities.search.rejected.invalidValue');
    expect(
      opportunitySearchErrorKey(new ApiError(400, 'INVALID_FILTER_TREE', { path: ['filterTree'], reason: ['empty_group'] })),
    ).toBe('opportunities.search.rejected.invalidValue');
    expect(
      opportunitySearchErrorKey(new ApiError(400, 'INVALID_OPERATOR_VALUE', { operator: ['between'], reason: ['between_arity'] })),
    ).toBe('opportunities.search.rejected.invalidValue');
    expect(opportunitySearchErrorKey(new ApiError(500, 'INTERNAL'))).toBeNull();
  });
});
