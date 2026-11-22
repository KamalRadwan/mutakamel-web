import { ApiError, errorCodeOf, newIdempotencyKey } from '../../staff/shared/staff.api';
import {
  fakeAssignAddon,
  fakeListAddonAssignments,
  fakeListAddonOptions,
  fakeRemoveAddon,
} from './addon-seats.fake';
import {
  AddonAssignment,
  AddonListResponse,
  AddonOption,
  AddonSeatWriteReceipt,
  AssignAddonBody,
  RemoveAddonQuery,
} from './addon-seats.model';

export { ApiError, errorCodeOf, newIdempotencyKey };
export { correlationIdOf } from '../../../../core/api/api-errors';
export * from './addon-seats.model';

/**
 * GET /api/tenant/core/v1/users/:userId/addon-assignments?page&limit
 */
export function listAddonAssignments(
  userId: string,
  page = 1,
  limit = 20,
): Promise<AddonListResponse<AddonAssignment>> {
  return fakeListAddonAssignments(userId, page, limit);
}

/**
 * GET /api/tenant/core/v1/users/:userId/addon-assignment-options?page&limit
 */
export function listAddonOptions(
  userId: string,
  page = 1,
  limit = 20,
): Promise<AddonListResponse<AddonOption>> {
  return fakeListAddonOptions(userId, page, limit);
}

/**
 * POST /api/tenant/core/v1/users/:userId/addon-assignments
 * Header: x-idempotency-key (UUIDv7); returns 201 receipt.
 */
export function assignAddon(
  userId: string,
  body: AssignAddonBody,
  key = newIdempotencyKey(),
): Promise<AddonSeatWriteReceipt> {
  return fakeAssignAddon(userId, body, key);
}

/**
 * DELETE /api/tenant/core/v1/users/:userId/addon-assignments/:assignmentId?expectedAssignmentRevision&expectedAllowanceRevision
 * Header: x-idempotency-key (UUIDv7); returns 200 receipt.
 */
export function removeAddon(
  userId: string,
  assignmentId: string,
  q: RemoveAddonQuery,
  key = newIdempotencyKey(),
): Promise<AddonSeatWriteReceipt> {
  return fakeRemoveAddon(userId, assignmentId, q, key);
}
