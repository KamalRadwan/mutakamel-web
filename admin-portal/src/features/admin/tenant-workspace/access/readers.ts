import {
  TENANT_USER_STATUSES,
  type BranchOption,
  type OrganizationOption,
  type PageResult,
  type RoleOption,
  type TenantUserDeliveryResult,
  type TenantUserInvitationResult,
  type TenantUserManagerRef,
  type TenantUserOrganizationRef,
  type TenantUserRoleAssignment,
  type TenantUserSummary,
  type TenantUserView,
  type TenantUserWebphone,
} from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLE_SCOPES = ["TENANT", "COMPANY", "BRANCH"] as const;
const DELIVERIES = ["QUEUED", "ALREADY_QUEUED"] as const;

export function readTenantUserPage(value: unknown): PageResult<TenantUserView> {
  return readPage(value, readTenantUserView, "INVALID_TENANT_USER_LIST_RESPONSE");
}

export function readTenantUserSummary(value: unknown): TenantUserSummary {
  const summary = object(coreData(value), "INVALID_TENANT_USER_SUMMARY_RESPONSE");
  return {
    total: nonNegativeInteger(summary.total, "INVALID_TENANT_USER_SUMMARY_RESPONSE"),
    invited: nonNegativeInteger(summary.invited, "INVALID_TENANT_USER_SUMMARY_RESPONSE"),
    active: nonNegativeInteger(summary.active, "INVALID_TENANT_USER_SUMMARY_RESPONSE"),
    suspended: nonNegativeInteger(summary.suspended, "INVALID_TENANT_USER_SUMMARY_RESPONSE"),
    deactivated: nonNegativeInteger(summary.deactivated, "INVALID_TENANT_USER_SUMMARY_RESPONSE"),
    deleted: nonNegativeInteger(summary.deleted, "INVALID_TENANT_USER_SUMMARY_RESPONSE"),
    owners: nonNegativeInteger(summary.owners, "INVALID_TENANT_USER_SUMMARY_RESPONSE"),
    webphoneEnabled: nonNegativeInteger(
      summary.webphoneEnabled,
      "INVALID_TENANT_USER_SUMMARY_RESPONSE",
    ),
    locked: nonNegativeInteger(summary.locked, "INVALID_TENANT_USER_SUMMARY_RESPONSE"),
  };
}

export function readTenantUserView(value: unknown): TenantUserView {
  assertNoCredentialMaterial(value, "INVALID_TENANT_USER_RESPONSE");
  const user = object(coreData(value), "INVALID_TENANT_USER_RESPONSE");
  const organization = object(
    user.organization,
    "INVALID_TENANT_USER_RESPONSE",
  );
  return {
    id: uuid(user.id, "INVALID_TENANT_USER_RESPONSE"),
    email: email(user.email, "INVALID_TENANT_USER_RESPONSE"),
    firstName: requiredString(user.firstName, "INVALID_TENANT_USER_RESPONSE"),
    lastName: requiredString(user.lastName, "INVALID_TENANT_USER_RESPONSE"),
    employeeCode: nullableString(user.employeeCode, "INVALID_TENANT_USER_RESPONSE"),
    jobTitle: nullableString(user.jobTitle, "INVALID_TENANT_USER_RESPONSE"),
    status: oneOf(user.status, TENANT_USER_STATUSES, "INVALID_TENANT_USER_RESPONSE"),
    isTenantOwner: boolean(user.isTenantOwner, "INVALID_TENANT_USER_RESPONSE"),
    organization: {
      company: readOrganizationRef(organization.company),
      branch: readOrganizationRef(organization.branch),
      department: readOrganizationRef(organization.department),
      team:
        organization.team === null
          ? null
          : readOrganizationRef(organization.team),
    },
    manager: user.manager === null ? null : readManager(user.manager),
    roleAssignments: array(
      user.roleAssignments,
      "INVALID_TENANT_USER_RESPONSE",
    ).map(readRoleAssignment),
    webphone: readTenantUserWebphone(user.webphone),
    lastLoginAt: nullableIsoDate(user.lastLoginAt, "INVALID_TENANT_USER_RESPONSE"),
    lockedUntil: nullableIsoDate(user.lockedUntil, "INVALID_TENANT_USER_RESPONSE"),
    createdAt: isoDate(user.createdAt, "INVALID_TENANT_USER_RESPONSE"),
    updatedAt: isoDate(user.updatedAt, "INVALID_TENANT_USER_RESPONSE"),
    deletedAt: nullableIsoDate(user.deletedAt, "INVALID_TENANT_USER_RESPONSE"),
  };
}

export function readTenantUserWebphone(value: unknown): TenantUserWebphone {
  assertNoCredentialMaterial(value, "INVALID_TENANT_USER_WEBPHONE_RESPONSE");
  const config = object(coreData(value), "INVALID_TENANT_USER_WEBPHONE_RESPONSE");
  return {
    enabled: boolean(config.enabled, "INVALID_TENANT_USER_WEBPHONE_RESPONSE"),
    extension: nullableString(config.extension, "INVALID_TENANT_USER_WEBPHONE_RESPONSE"),
    sipUsername: nullableString(
      config.sipUsername,
      "INVALID_TENANT_USER_WEBPHONE_RESPONSE",
    ),
    displayName: nullableString(
      config.displayName,
      "INVALID_TENANT_USER_WEBPHONE_RESPONSE",
    ),
    outboundCallerId: nullableString(
      config.outboundCallerId,
      "INVALID_TENANT_USER_WEBPHONE_RESPONSE",
    ),
    transport: oneOf(
      config.transport,
      ["ws", "wss"] as const,
      "INVALID_TENANT_USER_WEBPHONE_RESPONSE",
    ),
    passwordConfigured: boolean(
      config.passwordConfigured,
      "INVALID_TENANT_USER_WEBPHONE_RESPONSE",
    ),
  };
}

export function readTenantUserInvitation(
  value: unknown,
): TenantUserInvitationResult {
  const result = object(coreData(value), "INVALID_TENANT_USER_INVITE_RESPONSE");
  return {
    user: readTenantUserView(result.user),
    delivery: oneOf(
      result.delivery,
      DELIVERIES,
      "INVALID_TENANT_USER_INVITE_RESPONSE",
    ),
  };
}

export function readTenantUserDelivery(
  value: unknown,
): TenantUserDeliveryResult {
  const result = object(coreData(value), "INVALID_TENANT_USER_DELIVERY_RESPONSE");
  return {
    userId: uuid(result.userId, "INVALID_TENANT_USER_DELIVERY_RESPONSE"),
    delivery: oneOf(
      result.delivery,
      DELIVERIES,
      "INVALID_TENANT_USER_DELIVERY_RESPONSE",
    ),
  };
}

export function readRolePage(value: unknown): PageResult<RoleOption> {
  return readPage(value, readRole, "INVALID_TENANT_ACCESS_ROLE_RESPONSE");
}

export function readBranchPage(value: unknown): PageResult<BranchOption> {
  return readPage(value, readBranch, "INVALID_TENANT_ACCESS_BRANCH_RESPONSE");
}

export function readOrganizationPage(
  value: unknown,
): PageResult<OrganizationOption> {
  return readPage(
    value,
    readOrganizationOption,
    "INVALID_TENANT_ACCESS_ORGANIZATION_RESPONSE",
  );
}

function readRole(value: unknown): RoleOption {
  const role = object(value, "INVALID_TENANT_ACCESS_ROLE_RESPONSE");
  return {
    id: uuid(role.id, "INVALID_TENANT_ACCESS_ROLE_RESPONSE"),
    name: requiredString(role.name, "INVALID_TENANT_ACCESS_ROLE_RESPONSE"),
    description: nullableString(
      role.description,
      "INVALID_TENANT_ACCESS_ROLE_RESPONSE",
    ),
    isSystem: boolean(role.isSystem, "INVALID_TENANT_ACCESS_ROLE_RESPONSE"),
  };
}

function readBranch(value: unknown): BranchOption {
  const branch = object(value, "INVALID_TENANT_ACCESS_BRANCH_RESPONSE");
  const company = object(
    branch.company,
    "INVALID_TENANT_ACCESS_BRANCH_RESPONSE",
  );
  return {
    id: uuid(branch.id, "INVALID_TENANT_ACCESS_BRANCH_RESPONSE"),
    code: requiredString(branch.code, "INVALID_TENANT_ACCESS_BRANCH_RESPONSE"),
    name: requiredString(branch.name, "INVALID_TENANT_ACCESS_BRANCH_RESPONSE"),
    company: {
      id: uuid(company.id, "INVALID_TENANT_ACCESS_BRANCH_RESPONSE"),
      code: requiredString(company.code, "INVALID_TENANT_ACCESS_BRANCH_RESPONSE"),
      name: requiredString(company.name, "INVALID_TENANT_ACCESS_BRANCH_RESPONSE"),
    },
  };
}

function readOrganizationOption(value: unknown): OrganizationOption {
  const option = object(value, "INVALID_TENANT_ACCESS_ORGANIZATION_RESPONSE");
  return {
    id: uuid(option.id, "INVALID_TENANT_ACCESS_ORGANIZATION_RESPONSE"),
    code: requiredString(
      option.code,
      "INVALID_TENANT_ACCESS_ORGANIZATION_RESPONSE",
    ),
    name: requiredString(
      option.name,
      "INVALID_TENANT_ACCESS_ORGANIZATION_RESPONSE",
    ),
  };
}

function readOrganizationRef(value: unknown): TenantUserOrganizationRef {
  const ref = object(value, "INVALID_TENANT_USER_RESPONSE");
  return {
    id: uuid(ref.id, "INVALID_TENANT_USER_RESPONSE"),
    code: nullableString(ref.code, "INVALID_TENANT_USER_RESPONSE"),
    name: nullableString(ref.name, "INVALID_TENANT_USER_RESPONSE"),
  };
}

function readManager(value: unknown): TenantUserManagerRef {
  const manager = object(value, "INVALID_TENANT_USER_RESPONSE");
  return {
    id: uuid(manager.id, "INVALID_TENANT_USER_RESPONSE"),
    email: email(manager.email, "INVALID_TENANT_USER_RESPONSE"),
    firstName: requiredString(manager.firstName, "INVALID_TENANT_USER_RESPONSE"),
    lastName: requiredString(manager.lastName, "INVALID_TENANT_USER_RESPONSE"),
  };
}

function readRoleAssignment(value: unknown): TenantUserRoleAssignment {
  const assignment = object(value, "INVALID_TENANT_USER_RESPONSE");
  return {
    assignmentId: uuid(assignment.assignmentId, "INVALID_TENANT_USER_RESPONSE"),
    roleId: uuid(assignment.roleId, "INVALID_TENANT_USER_RESPONSE"),
    roleName: requiredString(assignment.roleName, "INVALID_TENANT_USER_RESPONSE"),
    scope: oneOf(assignment.scope, ROLE_SCOPES, "INVALID_TENANT_USER_RESPONSE"),
    companyId: nullableUuid(assignment.companyId, "INVALID_TENANT_USER_RESPONSE"),
    branchId: nullableUuid(assignment.branchId, "INVALID_TENANT_USER_RESPONSE"),
  };
}

function readPage<T>(
  value: unknown,
  reader: (item: unknown) => T,
  code: string,
): PageResult<T> {
  const envelope = plainObject(value);
  if (envelope?.success === true && Array.isArray(envelope.data)) {
    return readPageParts(envelope.data, envelope.meta, reader, code);
  }

  const page = object(coreData(value), code);
  return readPageParts(page.items, page, reader, code);
}

function readPageParts<T>(
  items: unknown,
  metadata: unknown,
  reader: (item: unknown) => T,
  code: string,
): PageResult<T> {
  const meta = object(metadata, code);
  const result = {
    items: array(items, code).map(reader),
    total: nonNegativeInteger(meta.total, code),
    page: positiveInteger(meta.page, code),
    limit: positiveInteger(meta.limit, code),
    totalPages: nonNegativeInteger(meta.totalPages, code),
    hasNext: boolean(meta.hasNext, code),
    hasPrev: boolean(meta.hasPrev, code),
  };
  if (result.totalPages === 0 && result.total !== 0) invalid(code);
  return result;
}

/** Unwrap only the documented Core success envelope, never arbitrary `data`. */
function coreData(value: unknown): unknown {
  const root = plainObject(value);
  return root?.success === true && "data" in root ? root.data : value;
}

function assertNoCredentialMaterial(value: unknown, code: string): void {
  const forbidden = new Set([
    "sipPassword",
    "passwordHash",
    "password_hash",
    "inviteToken",
    "resetToken",
    "tokenHash",
  ]);
  const visit = (candidate: unknown, depth: number): boolean => {
    if (depth > 8 || candidate === null || typeof candidate !== "object") return false;
    if (Array.isArray(candidate)) return candidate.some((entry) => visit(entry, depth + 1));
    const source = candidate as Record<string, unknown>;
    return Object.entries(source).some(
      ([key, entry]) => forbidden.has(key) || visit(entry, depth + 1),
    );
  };
  if (visit(value, 0)) invalid(code);
}

function plainObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function object(value: unknown, code: string): Record<string, unknown> {
  const result = plainObject(value);
  if (!result) invalid(code);
  return result;
}

function array(value: unknown, code: string): unknown[] {
  if (!Array.isArray(value)) invalid(code);
  return value;
}

function boolean(value: unknown, code: string): boolean {
  if (typeof value !== "boolean") invalid(code);
  return value;
}

function requiredString(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) invalid(code);
  return value.trim();
}

function nullableString(value: unknown, code: string): string | null {
  if (value === null) return null;
  return requiredString(value, code);
}

function email(value: unknown, code: string): string {
  const result = requiredString(value, code).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) invalid(code);
  return result;
}

function uuid(value: unknown, code: string): string {
  const result = requiredString(value, code);
  if (!UUID_PATTERN.test(result)) invalid(code);
  return result;
}

function nullableUuid(value: unknown, code: string): string | null {
  return value === null ? null : uuid(value, code);
}

function isoDate(value: unknown, code: string): string {
  const result = requiredString(value, code);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(result) || !Number.isFinite(Date.parse(result))) {
    invalid(code);
  }
  return result;
}

function nullableIsoDate(value: unknown, code: string): string | null {
  return value === null ? null : isoDate(value, code);
}

function nonNegativeInteger(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) invalid(code);
  return value;
}

function positiveInteger(value: unknown, code: string): number {
  const result = nonNegativeInteger(value, code);
  if (result < 1) invalid(code);
  return result;
}

function oneOf<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  code: string,
): Values[number] {
  if (typeof value !== "string" || !values.includes(value)) invalid(code);
  return value as Values[number];
}

function invalid(code: string): never {
  throw new Error(code);
}
