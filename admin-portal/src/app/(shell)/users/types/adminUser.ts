export type AdminUserStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";

interface AdminRoleI18n {
  en?: string;
  ar?: string;
}

export interface AdminRole {
  id: string;
  name: string;
  description?: string | null;
  isSystem?: boolean;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  nameI18n?: AdminRoleI18n;
  descriptionI18n?: AdminRoleI18n;
}

export interface AdminUserProfile {
  id: string;
  adminUserId: string;
  themeKey?: string | null;
  language?: string | null;
  extensions?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuperAdmin: boolean;
  status: AdminUserStatus;
  sessionVersion?: number;
  lastLoginAt?: string | null;
  failedLoginAttempts?: number;
  lockedUntil?: string | null;
  roleId: string;
  role: AdminRole;
  profile?: AdminUserProfile | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// A user's WebPhone identity is an extension row owned by the WebPhone module
// and keyed by ownerId — it is no longer a set of columns on the user record.
// The module's contract owns those shapes and their response parser, so they
// are re-exported here rather than restated, keeping one definition per shape.
export type {
  WebphoneExtension as AdminWebphoneExtension,
  CreateWebphoneExtensionDto as AdminWebphoneCreateDto,
  UpdateWebphoneExtensionDto as AdminWebphoneUpdateDto,
} from "../../settings/webphone/webphone-contract";

export interface CreateAdminUserDto {
  /**
   * Required, valid email, max 255, lowercased & trimmed
   */
  email: string;
  /**
   * Required, trimmed, 1-80 chars
   */
  firstName: string;
  /**
   * Required, trimmed, 1-80 chars
   */
  lastName: string;
  /**
   * Required UUIDv7
   */
  roleId: string;
  /**
   * Optional boolean, default false
   */
  isSuperAdmin?: boolean;
}

export interface UpdateAdminUserDto {
  firstName?: string;
  lastName?: string;
  isSuperAdmin?: boolean;
  roleId?: string;
}

export interface AssignRoleDto {
  roleId: string;
}

export type AdminUserErrorCode =
  | "MISSING_REQUIRED_PERMISSIONS"
  | "ADMIN_USER_NOT_FOUND"
  | "ADMIN_EMAIL_TAKEN"
  | "ROLE_NOT_FOUND"
  | "ADMIN_SELF_FORBIDDEN"
  | "ADMIN_SELF_ROLE_CHANGE_FORBIDDEN"
  | "ADMIN_INVITE_PENDING"
  | "ADMIN_LAST_SUPER_ADMIN"
  | "ADMIN_SUPER_ADMIN_REQUIRED"
  | "ROLE_PERMISSION_ESCALATION"
  | "ACTING_ADMIN_NOT_FOUND"
  | "ADMIN_LAST_ROLE_MANAGER"
  | "WEBPHONE_CONFIG_INCOMPLETE"
  | "WEBPHONE_EXTENSION_TAKEN"
  | "WEBPHONE_SIP_USERNAME_TAKEN"
  | "ADMIN_PROFILE_NOT_FOUND"
  | "INVALID_ACTION_TOKEN"
  | "WEAK_PASSWORD"
  | "COMMON.GENERIC.VALIDATION_FAILED"
  | "GW.IDEM.MISSING"
  | "GW.IDEM.BAD_VALUE"
  | "GW.IDEM.IN_FLIGHT"
  | "GW.IDEM.MISMATCH";
