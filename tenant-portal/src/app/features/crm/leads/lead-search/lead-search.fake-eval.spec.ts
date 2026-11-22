import { describe, expect, it } from 'vitest';
import { LeadRow } from '../leads.model';
import { matchesLead } from './lead-search.fake-eval';

const BRANCH_ID = '019a0000-0000-7000-8000-0000000000b1';
const LEAD = {} as LeadRow;

function errorOf(run: () => unknown): { status?: number; code?: string; details?: Record<string, unknown> } {
  try {
    run();
  } catch (error) {
    return error as { status: number; code: string; details?: Record<string, unknown> };
  }
  throw new Error('expected a throw');
}

describe('lead search fake: filter errors use string-array details (lead-filter-spec validateLeaf)', () => {
  it('INVALID_FIELD carries field and path', () => {
    const error = errorOf(() =>
      matchesLead(LEAD, { branchId: BRANCH_ID, filterTree: { op: 'AND', children: [{ field: 'bogus', operator: 'eq', value: 'x' }] } }),
    );
    expect(error).toMatchObject({ status: 400, code: 'INVALID_FIELD', details: { field: ['bogus'], path: ['filterTree.children[0]'] } });
  });

  it('INVALID_OPERATOR_VALUE carries path, field, operator and a lowercase reason', () => {
    const error = errorOf(() => matchesLead(LEAD, { branchId: BRANCH_ID, filterTree: { field: 'status', operator: 'in', value: [] } }));
    expect(error).toMatchObject({
      status: 400,
      code: 'INVALID_OPERATOR_VALUE',
      details: { path: ['filterTree'], field: ['status'], operator: ['in'], reason: ['array_empty'] },
    });
    const between = errorOf(() =>
      matchesLead(LEAD, { branchId: BRANCH_ID, filterTree: { field: 'createdAt', operator: 'between', value: ['2026-01-01'] } }),
    );
    expect(between.details).toEqual({
      path: ['filterTree'],
      field: ['createdAt'],
      operator: ['between'],
      reason: ['between_arity'],
      expected: ['[from,to]'],
    });
  });
});
