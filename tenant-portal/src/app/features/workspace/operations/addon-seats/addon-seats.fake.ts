import { FAKE_ADDON_HOMES, FAKE_ADDON_WHATSAPP } from '../../billing/shared/addon-catalogue.fake';
import { listSeatHolders } from '../../seats/seats.api';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { getStaffSeatSource } from '../../staff/shared/staff.fake';
import { fakeActorMe } from '../shared/fake-actor';
import {
  AddonAssignment,
  AddonListResponse,
  AddonOption,
  AddonOptionLocalState,
  AddonOptionRef,
  AddonPageMeta,
  AddonSeatWriteReceipt,
  AssignAddonBody,
  RemoveAddonQuery,
} from './addon-seats.model';

interface FakeAddonAllowance {
  applicationId: string;
  applicationKey: string;
  addonId: string;
  addonKey: string;
  addonSelectionId: string;
  allowanceId: string;
  allowanceRevision: string;
  selectedDefinitionVersionId: string;
  capacity: number;
  localState: AddonOptionLocalState;
}

interface StoredAddonAssignment {
  userId: string;
  assignmentId: string;
  assignmentRevision: string;
  applicationId: string;
  applicationKey: string;
  addonId: string;
  addonKey: string;
  addonSelectionId: string;
  parentAssignmentId: string;
  parentAssignmentRevision: string;
  selectedDefinitionVersionId: string;
  assignedAt: string;
}

interface RemovedAddonAssignment {
  addonSelectionId: string;
  finalRevision: string;
}

interface IdempotencyEntry {
  fingerprint: string;
  receipt: AddonSeatWriteReceipt;
}

const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSITIVE_REV_RE = /^[1-9][0-9]{0,18}$/;

const CRM_APP_ID = '0195a000-0000-7000-8000-000000000001';
const PARENT_ASSIGNMENT_IDS: Readonly<Record<string, string>> = {
  'u-mona:crm': '0195a000-0000-7000-8000-000000001001',
  'u-omar:crm': '0195a000-0000-7000-8000-000000001002',
  'u-hany:crm': '0195a000-0000-7000-8000-000000001003',
  'u-nada:crm': '0195a000-0000-7000-8000-000000001004',
};

function createInitialAllowances(): FakeAddonAllowance[] {
  return [
    {
      applicationId: CRM_APP_ID,
      applicationKey: 'crm',
      addonId: FAKE_ADDON_HOMES.id,
      addonKey: FAKE_ADDON_HOMES.key,
      addonSelectionId: '0195a000-0000-7000-8000-000000000201',
      allowanceId: '0195a000-0000-7000-8000-000000000301',
      allowanceRevision: '1',
      selectedDefinitionVersionId: FAKE_ADDON_HOMES.definitionVersionId,
      capacity: 3,
      localState: {
        parentReadiness: 'READY',
        addonReadiness: 'READY',
        parentDenied: false,
        addonDenied: false,
        adoptionPending: false,
        capacityChangePending: false,
      },
    },
    {
      applicationId: CRM_APP_ID,
      applicationKey: 'crm',
      addonId: FAKE_ADDON_WHATSAPP.id,
      addonKey: FAKE_ADDON_WHATSAPP.key,
      addonSelectionId: '0195a000-0000-7000-8000-000000000202',
      allowanceId: '0195a000-0000-7000-8000-000000000302',
      allowanceRevision: '1',
      selectedDefinitionVersionId: FAKE_ADDON_WHATSAPP.definitionVersionId,
      capacity: 5,
      localState: {
        parentReadiness: 'READY',
        addonReadiness: 'READY',
        parentDenied: false,
        addonDenied: false,
        adoptionPending: false,
        capacityChangePending: false,
      },
    },
  ];
}

function createInitialAssignments(): StoredAddonAssignment[] {
  return [
    {
      userId: 'u-mona',
      assignmentId: '0195a000-0000-7000-8000-000000002001',
      assignmentRevision: '1',
      applicationId: CRM_APP_ID,
      applicationKey: 'crm',
      addonId: FAKE_ADDON_HOMES.id,
      addonKey: FAKE_ADDON_HOMES.key,
      addonSelectionId: '0195a000-0000-7000-8000-000000000201',
      parentAssignmentId: PARENT_ASSIGNMENT_IDS['u-mona:crm'],
      parentAssignmentRevision: '1',
      selectedDefinitionVersionId: FAKE_ADDON_HOMES.definitionVersionId,
      assignedAt: '2026-10-12T09:30:00.000Z',
    },
    {
      userId: 'u-omar',
      assignmentId: '0195a000-0000-7000-8000-000000002002',
      assignmentRevision: '1',
      applicationId: CRM_APP_ID,
      applicationKey: 'crm',
      addonId: FAKE_ADDON_HOMES.id,
      addonKey: FAKE_ADDON_HOMES.key,
      addonSelectionId: '0195a000-0000-7000-8000-000000000201',
      parentAssignmentId: PARENT_ASSIGNMENT_IDS['u-omar:crm'],
      parentAssignmentRevision: '1',
      selectedDefinitionVersionId: FAKE_ADDON_HOMES.definitionVersionId,
      assignedAt: '2026-10-14T11:15:00.000Z',
    },
    {
      userId: 'u-hany',
      assignmentId: '0195a000-0000-7000-8000-000000002003',
      assignmentRevision: '1',
      applicationId: CRM_APP_ID,
      applicationKey: 'crm',
      addonId: FAKE_ADDON_HOMES.id,
      addonKey: FAKE_ADDON_HOMES.key,
      addonSelectionId: '0195a000-0000-7000-8000-000000000201',
      parentAssignmentId: PARENT_ASSIGNMENT_IDS['u-hany:crm'],
      parentAssignmentRevision: '1',
      selectedDefinitionVersionId: FAKE_ADDON_HOMES.definitionVersionId,
      assignedAt: '2026-10-22T14:00:00.000Z',
    },
    {
      userId: 'u-mona',
      assignmentId: '0195a000-0000-7000-8000-000000002004',
      assignmentRevision: '1',
      applicationId: CRM_APP_ID,
      applicationKey: 'crm',
      addonId: FAKE_ADDON_WHATSAPP.id,
      addonKey: FAKE_ADDON_WHATSAPP.key,
      addonSelectionId: '0195a000-0000-7000-8000-000000000202',
      parentAssignmentId: PARENT_ASSIGNMENT_IDS['u-mona:crm'],
      parentAssignmentRevision: '1',
      selectedDefinitionVersionId: FAKE_ADDON_WHATSAPP.definitionVersionId,
      assignedAt: '2026-11-04T10:20:00.000Z',
    },
  ];
}

let allowances: FakeAddonAllowance[] = createInitialAllowances();
let liveAssignments: StoredAddonAssignment[] = createInitialAssignments();
let removedAssignments = new Map<string, RemovedAddonAssignment>();
let idempotencyStore = new Map<string, IdempotencyEntry>();
let nextFailure: ApiError | null = null;

export function resetAddonSeatsFake(): void {
  allowances = createInitialAllowances();
  liveAssignments = createInitialAssignments();
  removedAssignments = new Map<string, RemovedAddonAssignment>();
  idempotencyStore = new Map<string, IdempotencyEntry>();
  nextFailure = null;
}

export function setFakeAddonFailure(error: ApiError): void {
  nextFailure = error;
}

export function setFakeAddonLocalState(addonKey: string, patch: Partial<AddonOptionLocalState>): void {
  const allowance = allowances.find((item) => item.addonKey === addonKey);
  if (!allowance) return;
  allowance.localState = { ...allowance.localState, ...patch };
  allowance.allowanceRevision = String(Number(allowance.allowanceRevision) + 1);
}

async function fakeDelay(ms = 200): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
  if (nextFailure) {
    const error = nextFailure;
    nextFailure = null;
    throw error;
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

const READ_PERMISSIONS = ['applications.addon_seats.read', 'applications.addon_seats.manage'] as const;
const MANAGE_PERMISSION = 'applications.addon_seats.manage';

/** Global PermissionsGuard (core-app common/guards/permissions.guard.ts) runs before every other check. */
function requireAnyPermissionGuard(permissions: readonly string[]): void {
  const me = fakeActorMe();
  if (me.isTenantOwner) return;
  if (!permissions.some((key) => me.permissions.includes(key) || Boolean(me.permissionScopes[key]))) {
    throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS', { anyPermissions: [...permissions] });
  }
}

function requirePermissionGuard(permission: string): void {
  const me = fakeActorMe();
  if (me.isTenantOwner) return;
  if (!me.permissions.includes(permission) && !me.permissionScopes[permission]) {
    throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS', { permissions: [permission] });
  }
}

/**
 * ApplicationAccessManagementContext.authorize: exact TENANT authority plus the
 * existing target user. An unknown target, an inactive target on a new
 * allocation, or a company/branch-only grant all fail closed as ACCESS_POLICY_BLOCKED.
 */
function authorizeTenantWide(write: boolean, userId: string, requireActiveTarget = false): void {
  const me = fakeActorMe();
  if (!me.isTenantOwner) {
    const allowed = write
      ? Boolean(me.permissionScopes[MANAGE_PERMISSION]?.tenantWide)
      : READ_PERMISSIONS.some((key) => Boolean(me.permissionScopes[key]?.tenantWide));
    if (!allowed) throw new ApiError(403, 'ACCESS_POLICY_BLOCKED');
  }
  const target = getStaffSeatSource().users.find((user) => user.userId === userId);
  if (!target || (requireActiveTarget && target.status !== 'ACTIVE')) {
    throw new ApiError(403, 'ACCESS_POLICY_BLOCKED');
  }
}

function targetIsActive(userId: string): boolean {
  return getStaffSeatSource().users.some((user) => user.userId === userId && user.status === 'ACTIVE');
}

/** captureAccessPagination: page 1..1000000 and limit 1..100, else 400 with no details. */
function capturePagination(page: number, limit: number): { page: number; limit: number } {
  const valid = (value: number, max: number) => Number.isSafeInteger(value) && value >= 1 && value <= max;
  if (!valid(page, 1000000) || !valid(limit, 100)) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED');
  }
  return { page, limit };
}

/** Transport guard: exactly one UUIDv7 x-idempotency-key. */
function assertIdempotencyKey(key: string): void {
  if (!key || !UUID_V7_RE.test(key)) {
    throw new ApiError(400, 'INVALID_IDEMPOTENCY_KEY');
  }
}

/** captureAccessCommand: the closed command codec rejects bad input with no details. */
function assertPositiveRevision(revision: unknown): void {
  if (typeof revision !== 'string' || !POSITIVE_REV_RE.test(revision)) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED');
  }
}

/** ApplicationAccessCommandReceipts.find: replays only after current authorization. */
function findReceipt(op: string, userId: string, key: string, body: unknown): AddonSeatWriteReceipt | null {
  const existing = idempotencyStore.get(`${op}:${userId}:${key}`);
  if (!existing) return null;
  if (existing.fingerprint !== JSON.stringify(body ?? null)) {
    throw new ApiError(422, 'IDEMPOTENCY_BODY_MISMATCH');
  }
  return clone(existing.receipt);
}

function saveIdempotency(
  op: string,
  userId: string,
  key: string,
  body: unknown,
  receipt: AddonSeatWriteReceipt,
): AddonSeatWriteReceipt {
  idempotencyStore.set(`${op}:${userId}:${key}`, {
    fingerprint: JSON.stringify(body ?? null),
    receipt: clone(receipt),
  });
  return clone(receipt);
}

/** accessListPage: totalPages = Math.ceil(total / limit), so 0 for an empty list. */
function paginateItems<T>(items: T[], page: number, limit: number): AddonListResponse<T> {
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const meta: AddonPageMeta = {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
  return { data: clone(items.slice(start, start + limit)), meta };
}

function syntheticParentAssignmentId(userId: string, applicationKey: string): string {
  const key = `${userId}:${applicationKey}`;
  const fixed = PARENT_ASSIGNMENT_IDS[key];
  if (fixed) return fixed;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  const tail = hash.toString(16).padStart(12, '0').slice(0, 12);
  return `0195a000-0000-7000-8000-${tail}`;
}

async function resolveParentAssignment(userId: string, applicationKey: string): Promise<AddonOptionRef | null> {
  let page = 1;
  while (page <= 20) {
    const res = await listSeatHolders(applicationKey, { page, limit: 100 });
    if (res.data.some((holder) => holder.userId === userId)) {
      return { id: syntheticParentAssignmentId(userId, applicationKey), revision: '1' };
    }
    if (!res.meta.hasNext || res.data.length === 0) break;
    page += 1;
  }
  return null;
}

/**
 * validateAllowance + assertAllowancesMatchSource: denied, non-READY, zero-seat
 * or adoption-pending allowances are not allocatable. A pending capacity change
 * (a PREPARED reservation) only narrows the capacity fence; it does not block.
 */
function isAllocatable(allowance: FakeAddonAllowance): boolean {
  const state = allowance.localState;
  return (
    state.parentReadiness === 'READY' &&
    state.addonReadiness === 'READY' &&
    !state.parentDenied &&
    !state.addonDenied &&
    !state.adoptionPending &&
    allowance.capacity > 0
  );
}

/** GET /api/tenant/core/v1/users/:userId/addon-assignments?page&limit */
export async function fakeListAddonAssignments(
  userId: string,
  page = 1,
  limit = 20,
): Promise<AddonListResponse<AddonAssignment>> {
  await fakeDelay();
  requireAnyPermissionGuard(READ_PERMISSIONS);
  const pagination = capturePagination(page, limit);
  authorizeTenantWide(false, userId);

  const allowanceMap = new Map(allowances.map((item) => [item.addonSelectionId, item]));
  const items: AddonAssignment[] = liveAssignments
    .filter((row) => row.userId === userId)
    .sort((a, b) => a.applicationKey.localeCompare(b.applicationKey) || a.addonKey.localeCompare(b.addonKey))
    .map((row) => ({
      userId: row.userId,
      assignmentId: row.assignmentId,
      assignmentRevision: row.assignmentRevision,
      applicationId: row.applicationId,
      applicationKey: row.applicationKey,
      addonId: row.addonId,
      addonKey: row.addonKey,
      addonSelectionId: row.addonSelectionId,
      allowanceRevision: allowanceMap.get(row.addonSelectionId)?.allowanceRevision ?? '1',
      parentAssignmentId: row.parentAssignmentId,
      parentAssignmentRevision: row.parentAssignmentRevision,
      selectedDefinitionVersionId: row.selectedDefinitionVersionId,
      assignedAt: row.assignedAt,
      observation: 'LOCAL_PROJECTION',
      operationalUse: 'NOT_EVALUATED',
    }));

  return paginateItems(items, pagination.page, pagination.limit);
}

/** GET /api/tenant/core/v1/users/:userId/addon-assignment-options?page&limit */
export async function fakeListAddonOptions(
  userId: string,
  page = 1,
  limit = 20,
): Promise<AddonListResponse<AddonOption>> {
  await fakeDelay();
  requireAnyPermissionGuard(READ_PERMISSIONS);
  const pagination = capturePagination(page, limit);
  authorizeTenantWide(false, userId);
  const targetActive = targetIsActive(userId);

  const userAssignments = liveAssignments.filter((row) => row.userId === userId);
  const assignmentBySelection = new Map(userAssignments.map((row) => [row.addonSelectionId, row]));
  const visibleAllowances = allowances.filter(
    (item) => item.capacity > 0 || assignmentBySelection.has(item.addonSelectionId),
  );
  const uniqueApps = Array.from(new Set(visibleAllowances.map((item) => item.applicationKey)));
  const parentEntries = await Promise.all(
    uniqueApps.map(async (appKey) => [appKey, await resolveParentAssignment(userId, appKey)] as const),
  );
  const parentByApp = new Map<string, AddonOptionRef | null>(parentEntries);

  const items: AddonOption[] = visibleAllowances
    .slice()
    .sort((a, b) => a.applicationKey.localeCompare(b.applicationKey) || a.addonKey.localeCompare(b.addonKey))
    .map((allowance) => {
      const existing = assignmentBySelection.get(allowance.addonSelectionId);
      return {
        userId,
        targetActive,
        applicationId: allowance.applicationId,
        applicationKey: allowance.applicationKey,
        addonId: allowance.addonId,
        addonKey: allowance.addonKey,
        addonSelectionId: allowance.addonSelectionId,
        allowanceId: allowance.allowanceId,
        allowanceRevision: allowance.allowanceRevision,
        selectedDefinitionVersionId: allowance.selectedDefinitionVersionId,
        parentAssignment: parentByApp.get(allowance.applicationKey) ?? null,
        assignment: existing ? { id: existing.assignmentId, revision: existing.assignmentRevision } : null,
        localState: { ...allowance.localState },
        seats: {
          used: liveAssignments.filter((row) => row.addonSelectionId === allowance.addonSelectionId).length,
          total: allowance.capacity,
        },
        observation: 'LOCAL_PROJECTION',
        operationalUse: 'NOT_EVALUATED',
      };
    });

  return paginateItems(items, pagination.page, pagination.limit);
}

/**
 * POST /api/tenant/core/v1/users/:userId/addon-assignments
 * Order follows ApplicationAddonAssignmentAssignService: permission guard,
 * idempotency key, command codec, authorization, receipt replay, active target,
 * source (an unknown selection is "not ready"), allowance readiness, parent
 * assignment (404), CAS (409), existing assignment (changed=false), capacity (422).
 */
export async function fakeAssignAddon(
  userId: string,
  body: AssignAddonBody,
  key: string,
): Promise<AddonSeatWriteReceipt> {
  await fakeDelay();
  requirePermissionGuard(MANAGE_PERMISSION);
  assertIdempotencyKey(key);
  if (typeof body.addonSelectionId !== 'string' || body.addonSelectionId.length === 0) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED');
  }
  assertPositiveRevision(body.expectedAllowanceRevision);
  assertPositiveRevision(body.expectedParentAssignmentRevision);

  authorizeTenantWide(true, userId);
  const replayed = findReceipt('assign', userId, key, body);
  if (replayed) return replayed;
  authorizeTenantWide(true, userId, true);

  const allowance = allowances.find((item) => item.addonSelectionId === body.addonSelectionId);
  if (!allowance || !isAllocatable(allowance)) {
    throw new ApiError(409, 'APPLICATION_ALLOWANCE_NOT_READY');
  }

  const parentAssignment = await resolveParentAssignment(userId, allowance.applicationKey);
  if (!parentAssignment) {
    throw new ApiError(404, 'ASSIGNMENT_NOT_FOUND');
  }
  if (
    body.expectedAllowanceRevision !== allowance.allowanceRevision ||
    body.expectedParentAssignmentRevision !== parentAssignment.revision
  ) {
    throw new ApiError(409, 'ADDON_ASSIGNMENT_REVISION_STALE');
  }

  const existing = liveAssignments.find(
    (row) => row.userId === userId && row.addonSelectionId === allowance.addonSelectionId,
  );
  if (existing) {
    return saveIdempotency('assign', userId, key, body, {
      operationId: newIdempotencyKey(),
      operationRevision: '1',
      state: 'COMMITTED',
      operationKind: 'ASSIGN_ADDON',
      changed: false,
      resourceId: existing.assignmentId,
      resourceRevision: existing.assignmentRevision,
      completedAt: new Date().toISOString(),
    });
  }

  const usedCount = liveAssignments.filter((row) => row.addonSelectionId === allowance.addonSelectionId).length;
  if (usedCount >= allowance.capacity) {
    throw new ApiError(422, 'SEAT_LIMIT_REACHED');
  }

  const now = new Date().toISOString();
  const created: StoredAddonAssignment = {
    userId,
    assignmentId: newIdempotencyKey(),
    assignmentRevision: '1',
    applicationId: allowance.applicationId,
    applicationKey: allowance.applicationKey,
    addonId: allowance.addonId,
    addonKey: allowance.addonKey,
    addonSelectionId: allowance.addonSelectionId,
    parentAssignmentId: parentAssignment.id,
    parentAssignmentRevision: parentAssignment.revision,
    selectedDefinitionVersionId: allowance.selectedDefinitionVersionId,
    assignedAt: now,
  };
  liveAssignments.push(created);

  return saveIdempotency('assign', userId, key, body, {
    operationId: newIdempotencyKey(),
    operationRevision: '1',
    state: 'COMMITTED',
    operationKind: 'ASSIGN_ADDON',
    changed: true,
    resourceId: created.assignmentId,
    resourceRevision: created.assignmentRevision,
    completedAt: now,
  });
}

/**
 * DELETE /api/tenant/core/v1/users/:userId/addon-assignments/:assignmentId
 * An inactive target is allowed (cleanup). Both revisions are compared exactly,
 * also for an already-removed assignment, whose revision is the post-removal one.
 */
export async function fakeRemoveAddon(
  userId: string,
  assignmentId: string,
  q: RemoveAddonQuery,
  key: string,
): Promise<AddonSeatWriteReceipt> {
  await fakeDelay();
  requirePermissionGuard(MANAGE_PERMISSION);
  assertIdempotencyKey(key);
  assertPositiveRevision(q.expectedAssignmentRevision);
  assertPositiveRevision(q.expectedAllowanceRevision);
  authorizeTenantWide(true, userId);

  const fingerprintPayload = { assignmentId, ...q };
  const replayed = findReceipt('remove', userId, key, fingerprintPayload);
  if (replayed) return replayed;

  const idx = liveAssignments.findIndex((row) => row.userId === userId && row.assignmentId === assignmentId);
  if (idx === -1) {
    const removed = removedAssignments.get(`${userId}:${assignmentId}`);
    if (!removed) {
      throw new ApiError(404, 'ASSIGNMENT_NOT_FOUND');
    }
    const allowance = allowances.find((item) => item.addonSelectionId === removed.addonSelectionId);
    if (
      (allowance && q.expectedAllowanceRevision !== allowance.allowanceRevision) ||
      q.expectedAssignmentRevision !== removed.finalRevision
    ) {
      throw new ApiError(409, 'ADDON_ASSIGNMENT_REVISION_STALE');
    }
    return saveIdempotency('remove', userId, key, fingerprintPayload, {
      operationId: newIdempotencyKey(),
      operationRevision: '1',
      state: 'COMMITTED',
      operationKind: 'UNASSIGN_ADDON',
      changed: false,
      resourceId: assignmentId,
      resourceRevision: removed.finalRevision,
      completedAt: new Date().toISOString(),
    });
  }

  const existing = liveAssignments[idx];
  const allowance = allowances.find((item) => item.addonSelectionId === existing.addonSelectionId);
  if (
    q.expectedAssignmentRevision !== existing.assignmentRevision ||
    (allowance && q.expectedAllowanceRevision !== allowance.allowanceRevision)
  ) {
    throw new ApiError(409, 'ADDON_ASSIGNMENT_REVISION_STALE');
  }

  liveAssignments.splice(idx, 1);
  const nextRevision = String(Number(existing.assignmentRevision) + 1);
  removedAssignments.set(`${userId}:${assignmentId}`, {
    addonSelectionId: existing.addonSelectionId,
    finalRevision: nextRevision,
  });

  return saveIdempotency('remove', userId, key, fingerprintPayload, {
    operationId: newIdempotencyKey(),
    operationRevision: '1',
    state: 'COMMITTED',
    operationKind: 'UNASSIGN_ADDON',
    changed: true,
    resourceId: assignmentId,
    resourceRevision: nextRevision,
    completedAt: new Date().toISOString(),
  });
}
