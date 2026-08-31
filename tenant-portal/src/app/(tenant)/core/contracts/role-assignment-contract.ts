import { readCoreData, writeCoreData } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";
import {
  CORE_LIST_RESPONSE_LIMIT_BYTES,
  CORE_WRITE_RESPONSE_LIMIT_BYTES,
  invalidCoreResponse,
  isMember,
  nullableUuidV7,
  parseCoreArray,
  record,
  requiredUuidV7,
} from "./core-page";
import { userPath } from "./user-contract";

// The two grant models a Core user can hold, side by side.
//
// `tenant_user_branch_roles` scopes a role to one branch and supports add and
// remove individually; `tenant_user_scope_roles` scopes a role to TENANT,
// COMPANY or BRANCH and is replaced atomically by the tenant owner. A user's
// effective permissions are the **union** of both — see
// docs/api/core-identity.md#two-role-models-coexist--this-is-not-a-mistake.
//
// Both `PUT`s take the complete collection and say nothing about what they take
// away, which is why every caller shows a diff before committing one.

/** `SetUserBranchRolesDto` / `ReplaceScopeRoleAssignmentsDto` — both @ArrayMaxSize(500). */
const MAX_BRANCH_ROLE_ASSIGNMENTS_PER_USER = 500;
const MAX_SCOPE_ROLE_ASSIGNMENTS_PER_USER = 500;

/** `ScopeRoleAssignmentDto.scopeTarget` — scope-role-assignment.dto.ts. */
export const SCOPE_ROLE_TARGETS = ["TENANT", "COMPANY", "BRANCH"] as const;
export type ScopeRoleTarget = (typeof SCOPE_ROLE_TARGETS)[number];

export interface BranchRoleAssignment {
  id: string;
  tenantUserId: string;
  branchId: string;
  roleId: string;
}

export interface ScopeRoleAssignment {
  id: string;
  tenantUserId: string;
  roleId: string;
  scopeTarget: ScopeRoleTarget;
  companyId: string | null;
  branchId: string | null;
}

export interface ScopeRoleAssignmentInput {
  scopeTarget: ScopeRoleTarget;
  roleId: string;
  companyId?: string;
  branchId?: string;
}

function parseBranchRoleAssignment(payload: unknown): BranchRoleAssignment {
  const source = record(payload);
  if (!source) invalidCoreResponse();
  return {
    id: requiredUuidV7(source, "id"),
    tenantUserId: requiredUuidV7(source, "tenantUserId"),
    branchId: requiredUuidV7(source, "branchId"),
    roleId: requiredUuidV7(source, "roleId"),
  };
}

export function parseScopeRoleAssignment(payload: unknown): ScopeRoleAssignment {
  const source = record(payload);
  if (!source || !isMember(SCOPE_ROLE_TARGETS, source.scopeTarget)) invalidCoreResponse();
  return {
    id: requiredUuidV7(source, "id"),
    tenantUserId: requiredUuidV7(source, "tenantUserId"),
    roleId: requiredUuidV7(source, "roleId"),
    scopeTarget: source.scopeTarget,
    companyId: nullableUuidV7(source, "companyId"),
    branchId: nullableUuidV7(source, "branchId"),
  };
}

export async function fetchBranchRoleAssignments(
  userId: string,
  signal?: AbortSignal,
): Promise<BranchRoleAssignment[]> {
  return parseCoreArray(
    await readCoreData(userPath(userId, "/assignments"), {
      signal,
      cache: "no-store",
      maxResponseBytes: CORE_LIST_RESPONSE_LIMIT_BYTES,
    }),
    parseBranchRoleAssignment,
    MAX_BRANCH_ROLE_ASSIGNMENTS_PER_USER,
  );
}

export async function addBranchRoleAssignment(
  userId: string,
  body: { branchId: string; roleId: string },
): Promise<BranchRoleAssignment> {
  return parseBranchRoleAssignment(
    await writeCoreData("post", userPath(userId, "/assignments"), body, {
      cache: "no-store",
      maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
    }),
  );
}

/**
 * Replaces the user's whole branch-role set in one write.
 *
 * `SetUserBranchRolesDto.assignments` is the complete collection — the add and
 * remove routes above are the incremental path, and this one is not a superset
 * of them: anything absent from the array is revoked.
 */
export async function replaceBranchRoleAssignments(
  userId: string,
  assignments: Array<{ branchId: string; roleId: string }>,
): Promise<BranchRoleAssignment[]> {
  if (assignments.length > MAX_BRANCH_ROLE_ASSIGNMENTS_PER_USER) invalidCoreResponse();
  return parseCoreArray(
    await writeCoreData(
      "put",
      userPath(userId, "/assignments"),
      { assignments },
      {
        cache: "no-store",
        maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
        replayAfterRefresh: true,
      },
    ),
    parseBranchRoleAssignment,
    MAX_BRANCH_ROLE_ASSIGNMENTS_PER_USER,
  );
}

/** The stable identity of one branch grant, for diffing a replacement set. */
export function branchRoleAssignmentKey(assignment: {
  branchId: string;
  roleId: string;
}): string {
  return `${assignment.branchId}:${assignment.roleId}`;
}

export async function removeBranchRoleAssignment(
  userId: string,
  assignmentId: string,
): Promise<void> {
  if (!isUUIDv7(assignmentId)) invalidCoreResponse();
  await writeCoreData(
    "delete",
    userPath(userId, `/assignments/${encodeURIComponent(assignmentId)}`),
    undefined,
    { cache: "no-store", maxResponseBytes: 10_000, nonReplayable: true },
  );
}

export async function fetchScopeRoleAssignments(
  userId: string,
  signal?: AbortSignal,
): Promise<ScopeRoleAssignment[]> {
  return parseCoreArray(
    await readCoreData(userPath(userId, "/scope-role-assignments"), {
      signal,
      cache: "no-store",
      maxResponseBytes: CORE_LIST_RESPONSE_LIMIT_BYTES,
    }),
    parseScopeRoleAssignment,
    MAX_SCOPE_ROLE_ASSIGNMENTS_PER_USER,
  );
}

/**
 * The most destructive write in Core: one `PUT` replaces the user's entire
 * exact-scope role set in a single transaction, and only an active tenant owner
 * may call it. Never send this without showing the caller the diff first.
 */
export async function replaceScopeRoleAssignments(
  userId: string,
  assignments: ScopeRoleAssignmentInput[],
): Promise<ScopeRoleAssignment[]> {
  if (assignments.length > MAX_SCOPE_ROLE_ASSIGNMENTS_PER_USER) invalidCoreResponse();
  return parseCoreArray(
    await writeCoreData(
      "put",
      userPath(userId, "/scope-role-assignments"),
      { assignments },
      {
        cache: "no-store",
        maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
        replayAfterRefresh: true,
      },
    ),
    parseScopeRoleAssignment,
    MAX_SCOPE_ROLE_ASSIGNMENTS_PER_USER,
  );
}

/**
 * The stable identity of one exact-scope grant, for diffing a replacement set.
 * The server row's `id` is not usable here: a newly added assignment has none
 * yet, so identity has to come from the tuple the DTO's `@ArrayUnique` uses.
 */
export function scopeRoleAssignmentKey(
  assignment: ScopeRoleAssignmentInput | ScopeRoleAssignment,
): string {
  return [
    assignment.scopeTarget,
    assignment.roleId,
    assignment.companyId ?? "none",
    assignment.branchId ?? "none",
  ].join(":");
}
