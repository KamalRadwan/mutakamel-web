import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { scopeAssignmentInvalidIndexes } from './user-roles-tab';

describe('scopeAssignmentInvalidIndexes', () => {
  it('reads the decimal string array details.indexes', () => {
    expect(scopeAssignmentInvalidIndexes(new ApiError(422, 'SCOPE_ROLE_ASSIGNMENT_INVALID', { indexes: ['1', '2'] }))).toEqual([1, 2]);
  });

  it('ignores numbers, junk and missing details', () => {
    expect(scopeAssignmentInvalidIndexes(new ApiError(422, 'SCOPE_ROLE_ASSIGNMENT_INVALID', { indexes: [1, 'x', '3'] }))).toEqual([3]);
    expect(scopeAssignmentInvalidIndexes(new ApiError(422, 'SCOPE_ROLE_ASSIGNMENT_INVALID'))).toEqual([]);
  });
});
