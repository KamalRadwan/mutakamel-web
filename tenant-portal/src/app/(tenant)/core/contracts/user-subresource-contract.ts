import { readCoreData, writeCoreData } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";
import {
  CORE_DETAIL_RESPONSE_LIMIT_BYTES,
  CORE_LIST_RESPONSE_LIMIT_BYTES,
  CORE_WRITE_RESPONSE_LIMIT_BYTES,
  invalidCoreResponse,
  isMember,
  nullableText,
  parseCoreArray,
  record,
  requiredBoolean,
  requiredText,
  requiredUuidV7,
} from "./core-page";
import { USERS_PATH, userPath } from "./user-contract";

// The three collections that hang off one tenant user, plus the caller's own
// preferences. Each is a bounded array rather than a page — the controller
// returns `result.items`, not a `PaginatedResult` — so none of them carries a
// `meta` block and none of them paginates.

/** `SetTenantUserTeamMembershipsDto` / `CreateTenantUserDto.teamMemberships`. */
const MAX_TEAM_MEMBERSHIPS_PER_USER = 500;
/** `UserModulesService.listForUser` reads one page of 100 and returns its items. */
const MAX_USER_MODULES = 100;

/** `TeamMembershipRoleEnum` — core-app/packages/common/src/enums. */
export const TEAM_MEMBERSHIP_ROLES = ["MEMBER", "LEAD", "MANAGER"] as const;
export type TeamMembershipRole = (typeof TEAM_MEMBERSHIP_ROLES)[number];

/** `AssignModuleDto.moduleKey` — @Matches(/^[a-z][a-z0-9_]*$/) @MaxLength(64). */
export const MODULE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/u;
export const MODULE_KEY_MAX_LENGTH = 64;

/**
 * Seat exhaustion on `POST /users/:userId/modules`.
 *
 * A **422**, not the 403 the plan predicted: `UserModulesService.assign` throws
 * `UnprocessableEntityException` once the assignment count reaches the
 * subscription item's seat allowance, behind a PostgreSQL advisory lock.
 */
export const SEAT_LIMIT_REACHED_CODE = "SEAT_LIMIT_REACHED";

const PROFILE_THEME_KEY_MAX_LENGTH = 64;
const PROFILE_LANGUAGE_MAX_LENGTH = 8;

export interface TeamMembership {
  id: string;
  tenantUserId: string;
  teamId: string;
  role: TeamMembershipRole;
  isPrimary: boolean;
}

export interface UserModuleAssignment {
  id: string;
  userId: string;
  moduleKey: string;
}

export interface TenantProfile {
  id: string;
  tenantUserId: string;
  themeKey: string | null;
  language: string | null;
  extensions: Record<string, unknown>;
}

function parseTeamMembership(payload: unknown): TeamMembership {
  const source = record(payload);
  if (!source || !isMember(TEAM_MEMBERSHIP_ROLES, source.role)) invalidCoreResponse();
  return {
    id: requiredUuidV7(source, "id"),
    tenantUserId: requiredUuidV7(source, "tenantUserId"),
    teamId: requiredUuidV7(source, "teamId"),
    role: source.role,
    isPrimary: requiredBoolean(source, "isPrimary"),
  };
}

function parseUserModuleAssignment(payload: unknown): UserModuleAssignment {
  const source = record(payload);
  if (!source) invalidCoreResponse();
  const moduleKey = requiredText(source, "moduleKey", MODULE_KEY_MAX_LENGTH);
  if (!MODULE_KEY_PATTERN.test(moduleKey)) invalidCoreResponse();
  return {
    id: requiredUuidV7(source, "id"),
    userId: requiredUuidV7(source, "userId"),
    moduleKey,
  };
}

export function parseTenantProfile(payload: unknown): TenantProfile {
  const source = record(payload);
  if (!source) invalidCoreResponse();
  const extensions = record(source.extensions);
  if (source.extensions !== undefined && !extensions) invalidCoreResponse();
  return {
    id: requiredUuidV7(source, "id"),
    tenantUserId: requiredUuidV7(source, "tenantUserId"),
    themeKey: nullableText(source, "themeKey", PROFILE_THEME_KEY_MAX_LENGTH),
    language: nullableText(source, "language", PROFILE_LANGUAGE_MAX_LENGTH),
    extensions: extensions ?? {},
  };
}

export async function fetchTeamMemberships(
  userId: string,
  signal?: AbortSignal,
): Promise<TeamMembership[]> {
  return parseCoreArray(
    await readCoreData(userPath(userId, "/team-memberships"), {
      signal,
      cache: "no-store",
      maxResponseBytes: CORE_LIST_RESPONSE_LIMIT_BYTES,
    }),
    parseTeamMembership,
    MAX_TEAM_MEMBERSHIPS_PER_USER,
  );
}

export interface TeamMembershipInput {
  teamId: string;
  role?: TeamMembershipRole;
  isPrimary?: boolean;
}

/** `PUT` replaces the whole set in one transaction — always diff before calling. */
export async function replaceTeamMemberships(
  userId: string,
  memberships: TeamMembershipInput[],
): Promise<TeamMembership[]> {
  return parseCoreArray(
    await writeCoreData(
      "put",
      userPath(userId, "/team-memberships"),
      { memberships },
      {
        cache: "no-store",
        maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
        replayAfterRefresh: true,
      },
    ),
    parseTeamMembership,
    MAX_TEAM_MEMBERSHIPS_PER_USER,
  );
}

export async function addTeamMembership(
  userId: string,
  membership: TeamMembershipInput,
): Promise<TeamMembership> {
  return parseTeamMembership(
    await writeCoreData("post", userPath(userId, "/team-memberships"), membership, {
      cache: "no-store",
      maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
    }),
  );
}

export async function removeTeamMembership(
  userId: string,
  membershipId: string,
): Promise<void> {
  if (!isUUIDv7(membershipId)) invalidCoreResponse();
  await writeCoreData(
    "delete",
    userPath(userId, `/team-memberships/${encodeURIComponent(membershipId)}`),
    undefined,
    { cache: "no-store", maxResponseBytes: 10_000, nonReplayable: true },
  );
}

export async function fetchUserModules(
  userId: string,
  signal?: AbortSignal,
): Promise<UserModuleAssignment[]> {
  return parseCoreArray(
    await readCoreData(userPath(userId, "/modules"), {
      signal,
      cache: "no-store",
      maxResponseBytes: CORE_LIST_RESPONSE_LIMIT_BYTES,
    }),
    parseUserModuleAssignment,
    MAX_USER_MODULES,
  );
}

export async function assignUserModule(
  userId: string,
  moduleKey: string,
): Promise<UserModuleAssignment> {
  return parseUserModuleAssignment(
    await writeCoreData("post", userPath(userId, "/modules"), { moduleKey }, {
      cache: "no-store",
      maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
    }),
  );
}

export async function unassignUserModule(
  userId: string,
  moduleKey: string,
): Promise<void> {
  if (!MODULE_KEY_PATTERN.test(moduleKey)) invalidCoreResponse();
  await writeCoreData(
    "delete",
    userPath(userId, `/modules/${encodeURIComponent(moduleKey)}`),
    undefined,
    { cache: "no-store", maxResponseBytes: 10_000, nonReplayable: true },
  );
}

export async function fetchMyProfile(signal?: AbortSignal): Promise<TenantProfile> {
  return parseTenantProfile(
    await readCoreData(`${USERS_PATH}/me/profile`, {
      signal,
      cache: "no-store",
      maxResponseBytes: CORE_DETAIL_RESPONSE_LIMIT_BYTES,
    }),
  );
}

export interface UpdateProfileInput {
  themeKey?: string;
  language?: string;
  extensions?: Record<string, unknown>;
}

export async function updateMyProfile(
  body: UpdateProfileInput,
): Promise<TenantProfile> {
  return parseTenantProfile(
    await writeCoreData("put", `${USERS_PATH}/me/profile`, body, {
      cache: "no-store",
      maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
      replayAfterRefresh: true,
    }),
  );
}
