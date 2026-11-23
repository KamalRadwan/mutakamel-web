import { describe, expect, it } from 'vitest';
import { selectionBranchMismatch } from './selection-branch';

describe('selectionBranchMismatch', () => {
  it('never rejects IDS selections', () => expect(selectionBranchMismatch({ kind: 'IDS', ids: ['lead'] }, 'branch')).toBe(false));
  it('accepts a QUERY in the scope branch', () => expect(selectionBranchMismatch({ kind: 'QUERY', query: { search: { branchId: 'branch' } } }, 'branch')).toBe(false));
  it('rejects a different or missing QUERY branch', () => {
    for (const query of [{ search: { branchId: 'other' } }, { search: {} }, {}, null]) {
      expect(selectionBranchMismatch({ kind: 'QUERY', query }, 'branch')).toBe(true);
    }
  });
});
