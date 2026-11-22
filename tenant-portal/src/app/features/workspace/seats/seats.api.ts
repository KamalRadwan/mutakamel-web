import { newIdempotencyKey } from '../../../core/api/idempotency';
import {
  fakeBulkAssignRole,
  fakeFreeUp,
  fakeFreeUpPreview,
  fakeGetMySeatStates,
  fakeGetSeatUsage,
  fakeImportUsers,
  fakeListSeatHolders,
  fakePreviewSeats,
  fakeReleaseSeats,
  fakeSwapSeat,
  fakeSwitchToDerived,
} from './seats.fake';
import {
  BulkRoleResult,
  CorePage,
  FreeUpPreview,
  ImportResult,
  MySeatState,
  SeatChange,
  SeatHolder,
  SeatPreview,
  SeatUsage,
} from './seats.model';

/** GET /api/tenant/core/v1/seats/usage */
export function getSeatUsage(): Promise<SeatUsage> {
  return fakeGetSeatUsage();
}

/** GET /api/tenant/core/v1/seats/usage/:moduleKey/holders?page&limit(<=100)&search(<=120) */
export function listSeatHolders(
  moduleKey: string,
  q: { page: number; limit: number; search?: string },
): Promise<CorePage<SeatHolder>> {
  return fakeListSeatHolders(moduleKey, q);
}

/** POST /api/tenant/core/v1/seats/preview (max 100 changes, no idempotency key) */
export function previewSeats(changes: SeatChange[]): Promise<SeatPreview> {
  return fakePreviewSeats(changes);
}

// TODO(seats-backend): releaseSeats response has no schema in OpenAPI yet; shape matches Core service code.
/** POST /api/tenant/core/v1/users/:id/release-seats?confirmAddonCascade= (header x-idempotency-key UUIDv7) */
export function releaseSeats(
  userId: string,
  opts: { confirmAddonCascade?: boolean } = {},
  key = newIdempotencyKey(),
): Promise<SeatPreview> {
  return fakeReleaseSeats(userId, opts, key);
}

// TODO(seats-backend): bulkAssignRole response has no schema in OpenAPI yet; shape matches Core service code.
/** POST /api/tenant/core/v1/users/bulk-role-assignments?confirmAddonCascade= (header x-idempotency-key UUIDv7) */
export function bulkAssignRole(
  body: {
    roleId: string;
    scope: { target: 'TENANT' | 'COMPANY' | 'BRANCH'; companyId?: string; branchId?: string };
    userIds: string[];
    dryRun: boolean;
  },
  key = newIdempotencyKey(),
  opts: { confirmAddonCascade?: boolean } = {},
): Promise<BulkRoleResult> {
  return fakeBulkAssignRole(body, key, opts);
}

/** POST /api/tenant/core/v1/users/import?confirmAddonCascade= (header x-idempotency-key UUIDv7) */
export function importUsers(
  body: {
    rows: unknown[];
    mode: 'ALL_OR_NOTHING' | 'SKIP_ROLES_THAT_DONT_FIT';
    dryRun: boolean;
  },
  key = newIdempotencyKey(),
  opts: { confirmAddonCascade?: boolean } = {},
): Promise<ImportResult> {
  return fakeImportUsers(body, key, opts);
}

/** POST /api/tenant/core/v1/seats/free-up/preview (owner only, no idempotency key) */
export function freeUpPreview(body: {
  moduleKey: string;
  targetSeats: number;
  keepUserIds: string[];
}): Promise<FreeUpPreview> {
  return fakeFreeUpPreview(body);
}

/** POST /api/tenant/core/v1/seats/free-up (owner only, header x-idempotency-key UUIDv7) */
export function freeUp(
  body: {
    moduleKey: string;
    targetSeats: number;
    keepUserIds: string[];
    expectedUsageRevision: number;
    confirmAddonCascade?: boolean;
  },
  key = newIdempotencyKey(),
): Promise<SeatUsage> {
  return fakeFreeUp(body, key);
}

/** POST /api/tenant/core/v1/seats/:moduleKey/swap (owner only, header x-idempotency-key UUIDv7) */
export function swapSeat(
  moduleKey: string,
  body: { keepUserId: string; releaseUserId: string },
  key = newIdempotencyKey(),
): Promise<SeatUsage> {
  return fakeSwapSeat(moduleKey, body, key);
}

/** POST /api/tenant/core/v1/seats/switch-to-derived?confirmAddonCascade= (owner only, header x-idempotency-key UUIDv7) */
export function switchToDerived(
  opts: { confirmAddonCascade?: boolean } = {},
  key = newIdempotencyKey(),
): Promise<SeatUsage> {
  return fakeSwitchToDerived(opts, key);
}

// TODO(seats-backend): read profile.seats from real GET /api/tenant/core/v1/auth/me once HTTP is wired.
/** GET /api/tenant/core/v1/auth/me → seats (derived in the fake from active actor + seat usage). */
export function getMySeatStates(): Promise<MySeatState[]> {
  return fakeGetMySeatStates();
}
