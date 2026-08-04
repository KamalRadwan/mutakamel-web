export type AdminUserStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";

export interface AdminRoleI18n {
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
  webphoneEnabled?: boolean;
  webphoneExtension?: string | null;
  webphoneSipUsername?: string | null;
  webphoneDisplayName?: string | null;
  webphoneOutboundCallerId?: string | null;
  webphoneTransport?: "ws" | "wss";
  roleId: string;
  role: AdminRole;
  profile?: AdminUserProfile | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface AdminWebphoneConfig {
  enabled: boolean;
  extension?: string | null;
  sipUsername?: string | null;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  outboundCallerId?: string | null;
  transport?: "ws" | "wss";
  passwordConfigured: boolean;
}

export interface AdminWebphoneUpdateDto {
  enabled?: boolean;
  extension?: string | null;
  sipUsername?: string | null;
  sipPassword?: string | null;
  displayName?: string | null;
  outboundCallerId?: string | null;
  transport?: "ws" | "wss";
}

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

export interface WebphoneCallLogEntry {
  id: string;
  adminUserId: string;
  type: "IN_ANS" | "IN_NOANS" | "OUT";
  displayName?: string | null;
  phoneNumber: string;
  startedAt?: string | null;
  answeredAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  cause?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface CreateWebphoneCallLogDto {
  type: "IN_ANS" | "IN_NOANS" | "OUT";
  displayName?: string | null;
  phoneNumber: string;
  startedAt?: string | null;
  answeredAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  cause?: string | null;
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
