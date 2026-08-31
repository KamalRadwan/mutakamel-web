import type { AdminPermission } from "@/lib/auth/rbac";

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface AdminRole {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  permissionIds: string[];
}

export interface RolePage {
  items: AdminRole[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  correlationId: string;
  timestamp: string;
}

export interface CoreResult<T> {
  data: T;
  correlationId: string;
  timestamp: string;
}

export interface CreateRoleCommand {
  name: string;
  description?: string;
}

export interface UpdateRoleCommand {
  name: string;
  description: string | null;
}

export interface ReplaceRolePermissionsCommand {
  permissionIds: string[];
}

export class RoleContractError extends Error {
  constructor(message = "INVALID_ROLE_RESPONSE") {
    super(message);
    this.name = "RoleContractError";
  }
}

export function isUuidV7(value: string): boolean {
  return UUID_V7_PATTERN.test(value);
}

export function readRolesPage(payload: unknown): RolePage {
  const envelope = coreEnvelope(payload);
  const rawItems = array(envelope.data, 100);
  const meta = object(envelope.meta);
  const page = positiveInteger(meta.page);
  const limit = positiveInteger(meta.limit, 100);
  const total = nonNegativeInteger(meta.total);
  const totalPages = nonNegativeInteger(meta.totalPages);
  const hasNext = boolean(meta.hasNext);
  const hasPrev = boolean(meta.hasPrev);
  if (
    rawItems.length > limit ||
    total < rawItems.length ||
    totalPages !== Math.ceil(total / limit) ||
    hasNext !== page < totalPages ||
    hasPrev !== page > 1
  ) {
    fail();
  }
  const items = rawItems.map(readRoleRecord);
  unique(items.map((item) => item.id));
  return {
    items,
    page,
    limit,
    total,
    totalPages,
    hasNext,
    hasPrev,
    correlationId: envelope.correlationId,
    timestamp: envelope.timestamp,
  };
}

export function readRole(payload: unknown): CoreResult<AdminRole> {
  const envelope = coreEnvelope(payload);
  return {
    data: readRoleRecord(envelope.data),
    correlationId: envelope.correlationId,
    timestamp: envelope.timestamp,
  };
}

export function readPermissionCatalogue(
  payload: unknown,
): CoreResult<AdminPermission[]> {
  const envelope = coreEnvelope(payload);
  const data = array(envelope.data, 1_000).map(readPermission);
  unique(data.map((permission) => permission.id));
  unique(data.map((permission) => permission.key));
  return {
    data,
    correlationId: envelope.correlationId,
    timestamp: envelope.timestamp,
  };
}

export function validateCreateRoleCommand(command: CreateRoleCommand): void {
  if (
    !exactKeys(command, ["name", "description"]) ||
    !validRoleName(command.name) ||
    (command.description !== undefined &&
      !validDescription(command.description))
  ) {
    throw new TypeError("INVALID_CREATE_ROLE_COMMAND");
  }
}

export function validateUpdateRoleCommand(command: UpdateRoleCommand): void {
  if (
    !exactKeys(command, ["name", "description"], true) ||
    !validRoleName(command.name) ||
    (command.description !== null && !validDescription(command.description))
  ) {
    throw new TypeError("INVALID_UPDATE_ROLE_COMMAND");
  }
}

export function validateReplacePermissionsCommand(
  command: ReplaceRolePermissionsCommand,
): void {
  if (
    !exactKeys(command, ["permissionIds"], true) ||
    !Array.isArray(command.permissionIds) ||
    command.permissionIds.length > 200 ||
    command.permissionIds.some(
      (permissionId) =>
        typeof permissionId !== "string" || !isUuidV7(permissionId),
    ) ||
    new Set(command.permissionIds).size !== command.permissionIds.length
  ) {
    throw new TypeError("INVALID_REPLACE_ROLE_PERMISSIONS_COMMAND");
  }
}

function readRoleRecord(value: unknown): AdminRole {
  const role = object(value);
  const rawAssignments =
    role.rolePermissions === undefined
      ? []
      : array(role.rolePermissions, 200);
  const permissionIds = rawAssignments.map((assignment) => {
    const record = object(assignment);
    return uuidV7(record.permissionId);
  });
  unique(permissionIds);
  return {
    id: uuidV7(role.id),
    name: boundedString(role.name, 120),
    description:
      role.description === null || role.description === undefined
        ? null
        : string(role.description, 2_000),
    isSystem: boolean(role.isSystem),
    createdAt: isoTimestamp(role.createdAt),
    updatedAt: isoTimestamp(role.updatedAt),
    permissionIds,
  };
}

function readPermission(value: unknown): AdminPermission {
  const permission = object(value);
  return {
    id: uuidV7(permission.id),
    key: boundedString(permission.key, 80),
    nameAr: boundedString(permission.nameAr, 255),
    nameEn: boundedString(permission.nameEn, 255),
    description: boundedString(permission.description, 255),
    group: boundedString(permission.group, 64),
    createdAt: isoTimestamp(permission.createdAt),
    updatedAt: isoTimestamp(permission.updatedAt),
  };
}

function coreEnvelope(value: unknown) {
  const envelope = object(value);
  if (envelope.success !== true) fail();
  return {
    data: envelope.data,
    meta: envelope.meta,
    correlationId: uuidV7(envelope.correlationId),
    timestamp: isoTimestamp(envelope.timestamp),
  };
}

function validRoleName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    value.length >= 2 &&
    value.length <= 120
  );
}

function validDescription(value: unknown): value is string {
  return typeof value === "string" && value.length <= 2_000;
}

function exactKeys(
  value: object,
  allowed: readonly string[],
  allRequired = false,
): boolean {
  const keys = Object.keys(value);
  return (
    keys.every((key) => allowed.includes(key)) &&
    (!allRequired || allowed.every((key) => keys.includes(key)))
  );
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail();
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) fail();
  return value;
}

function string(value: unknown, maximum: number): string {
  if (typeof value !== "string" || value.length > maximum) fail();
  return value;
}

function boundedString(value: unknown, maximum: number): string {
  const result = string(value, maximum);
  if (!result.length || result !== result.trim()) fail();
  return result;
}

function uuidV7(value: unknown): string {
  if (typeof value !== "string" || !isUuidV7(value)) fail();
  return value;
}

function isoTimestamp(value: unknown): string {
  if (typeof value !== "string") fail();
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    fail();
  }
  return value;
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") fail();
  return value;
}

function positiveInteger(
  value: unknown,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > maximum
  ) {
    fail();
  }
  return value;
}

function nonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail();
  }
  return value;
}

function unique(values: readonly string[]): void {
  if (new Set(values).size !== values.length) fail();
}

function fail(): never {
  throw new RoleContractError();
}
