import { describe, expect, it } from 'vitest';
import { resolveDate } from '../../../../shared/query-builder/query-dates';
import { Query } from '../../../../shared/query-builder/query.model';
import { compileLeadQuery } from './lead-search.compile';

const BRANCH_ID = '019a0000-0000-7000-8000-0000000000b1';

const CTX = {
  branchId: BRANCH_ID,
  meUserId: 'u1',
  timeZone: 'Africa/Cairo',
  now: new Date('2026-11-21T12:00:00Z'),
};

describe('compileLeadQuery', () => {
  it('compiles simple chips into top-level search/tags/overdue and mapped filterTree', () => {
    const query: Query = {
      fixed: [
        { kind: 'condition', id: 'f1', field: 'tag', operator: 'hasAny', value: ['tag-vip', 'tag-erp'] },
        { kind: 'condition', id: 'f2', field: 'overdue', operator: 'is', value: true },
      ],
      root: {
        kind: 'group',
        id: 'root',
        op: 'AND',
        children: [
          { kind: 'condition', id: 'c1', field: 'stage', operator: 'eq', value: 'stage-new' },
          { kind: 'condition', id: 'c2', field: 'status', operator: 'in', value: ['OPEN', 'ON_HOLD'] },
          { kind: 'condition', id: 'c3', field: 'leadType', operator: 'eq', value: 'CORPORATE' },
        ],
      },
    };

    expect(compileLeadQuery(query, CTX)).toEqual({
      branchId: BRANCH_ID,
      tagIds: ['tag-erp', 'tag-vip'],
      hasOverdueActivity: true,
      filterTree: {
        op: 'AND',
        children: [
          { field: 'stageId', operator: 'eq', value: 'stage-new' },
          { field: 'status', operator: 'in', value: ['ON_HOLD', 'OPEN'] },
          { field: 'leadProfileType', operator: 'eq', value: 'CORPORATE' },
        ],
      },
    });
  });

  it('compiles an OR group with dates into half-open ranges', () => {
    const query: Query = {
      fixed: [],
      root: {
        kind: 'group',
        id: 'root',
        op: 'OR',
        children: [
          { kind: 'condition', id: 'd1', field: 'createdAt', operator: 'on', value: '2026-11-21' },
          { kind: 'condition', id: 'd2', field: 'updatedAt', operator: 'before', value: '2026-11-01' },
        ],
      },
    };

    const createdRange = resolveDate('on', '2026-11-21', CTX.timeZone, CTX.now);
    const updatedRange = resolveDate('before', '2026-11-01', CTX.timeZone, CTX.now);

    expect(compileLeadQuery(query, CTX)).toEqual({
      branchId: BRANCH_ID,
      filterTree: {
        op: 'OR',
        children: [
          {
            op: 'AND',
            children: [
              { field: 'createdAt', operator: 'gte', value: createdRange.gte },
              { field: 'createdAt', operator: 'lt', value: createdRange.lt },
            ],
          },
          { field: 'updatedAt', operator: 'lt', value: updatedRange.lt },
        ],
      },
    });
  });

  it('resolves $me inside scalar and list values to meUserId', () => {
    const query: Query = {
      fixed: [],
      root: {
        kind: 'group',
        id: 'root',
        op: 'AND',
        children: [
          { kind: 'condition', id: 'p1', field: 'owner', operator: 'eq', value: '$me' },
          { kind: 'condition', id: 'p2', field: 'createdBy', operator: 'in', value: ['$me', 'u2'] },
        ],
      },
    };

    expect(compileLeadQuery(query, CTX)).toEqual({
      branchId: BRANCH_ID,
      filterTree: {
        op: 'AND',
        children: [
          { field: 'ownerUserId', operator: 'eq', value: 'u1' },
          { field: 'createdByUserId', operator: 'in', value: ['u1', 'u2'] },
        ],
      },
    });
  });

  it('normalizes phone search terms by stripping formatting and replacing leading 00 with +', () => {
    const query: Query = {
      fixed: [{ kind: 'condition', id: 'ph1', field: 'phone', operator: 'contains', value: ' 0020 (10) 123-4567 ' }],
      root: { kind: 'group', id: 'root', op: 'AND', children: [] },
    };

    expect(compileLeadQuery(query, CTX)).toEqual({
      branchId: BRANCH_ID,
      search: '+20101234567',
      searchField: 'phone',
    });
  });

  it('compiles an empty query to a body that carries only the branch scope', () => {
    const query: Query = {
      fixed: [],
      root: { kind: 'group', id: 'root', op: 'AND', children: [] },
    };

    expect(compileLeadQuery(query, CTX)).toEqual({ branchId: BRANCH_ID });
  });

  it('flattens nested groups and unwraps single-element lists', () => {
    const query: Query = {
      fixed: [],
      root: {
        kind: 'group',
        id: 'root',
        op: 'AND',
        children: [
          {
            kind: 'group',
            id: 'g1',
            op: 'AND',
            children: [
              { kind: 'condition', id: 'c1', field: 'stage', operator: 'eq', value: 'stage-new' },
              {
                kind: 'group',
                id: 'g2',
                op: 'AND',
                children: [{ kind: 'condition', id: 'c2', field: 'rating', operator: 'gte', value: 2 }],
              },
            ],
          },
          {
            kind: 'group',
            id: 'g3',
            op: 'OR',
            children: [{ kind: 'condition', id: 'c3', field: 'status', operator: 'in', value: ['OPEN'] }],
          },
          {
            kind: 'group',
            id: 'g4',
            op: 'OR',
            children: [],
          },
        ],
      },
    };

    expect(compileLeadQuery(query, CTX)).toEqual({
      branchId: BRANCH_ID,
      filterTree: {
        op: 'AND',
        children: [
          { field: 'stageId', operator: 'eq', value: 'stage-new' },
          { field: 'rating', operator: 'gte', value: 2 },
          { field: 'status', operator: 'eq', value: 'OPEN' },
        ],
      },
    });
  });

  it('always sends the branch scope from the context (LeadSearchFiltersDto.branchId is required)', () => {
    const query: Query = {
      fixed: [{ kind: 'condition', id: 'f1', field: 'lead', operator: 'contains', value: 'acme' }],
      root: { kind: 'group', id: 'root', op: 'AND', children: [] },
    };

    const body = compileLeadQuery(query, { ...CTX, branchId: 'branch-2' });
    expect(body.branchId).toBe('branch-2');
    expect(Object.keys(body)[0]).toBe('branchId');
  });
});
