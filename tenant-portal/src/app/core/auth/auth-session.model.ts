import type { AuthMe } from './auth-me';

/** AuthSessionMetadata (@mutakamel/auth). Counters are decimal bigint strings. */
export interface AuthSessionMetadata {
  id: string;
  clientId: string;
  clientType: 'WEB' | 'IOS' | 'ANDROID' | 'DESKTOP';
  createdAt: string;
  lastRefreshAt: string | null;
  lastUserActivityAt: string | null;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  refreshUseCount: string;
  accessIssueCount: string;
  credentialVersion: number;
  authorizationVersion: number;
  profileVersion: number;
}

/** AuthCookieSessionResponse: login, mfa/verify, accept-invite, refresh, change-password. */
export interface LoginSession {
  tokenType: 'Bearer';
  expiresIn: number;
  sessionExpiresIn: number;
  session: AuthSessionMetadata;
}

/** MFA_STEP_SCHEMA (additionalProperties false). challengeId ^[A-Za-z0-9_-]{43}$; expiresIn 0..600. */
export interface MfaStep {
  mfaRequired: true;
  challengeId: string;
  expiresIn: number;
  resendAfterSeconds: number;
}

export function isMfaStep(value: LoginSession | MfaStep): value is MfaStep {
  return 'mfaRequired' in value;
}

export interface TenantSeatState {
  moduleKey: string;
  accessState: 'ACTIVE' | 'OVER_CAPACITY';
}

export interface TenantPermissionScope {
  tenantWide: boolean;
  companyIds: string[];
  branchIds: string[];
}

export interface TenantTeamMembership {
  id: string;
  teamId: string;
  companyId: string;
  branchId: string;
  departmentId: string | null;
  role: string;
  isPrimary: boolean;
}

export interface TenantAccessScope {
  mode: 'FULL' | 'EXPLICIT';
  branchesTruncated: boolean;
  companiesTruncated: boolean;
  teamMembershipsTruncated: boolean;
  teamMembershipsTotal: number;
}

/** GET /auth/me data (TenantMe + featureEntitlements). */
export interface TenantMe extends AuthMe {
  hasMultipleOrganizationScopes?: boolean;
  accessibleBranches: string[];
  accessibleCompanies: string[];
  accessibleBranchCompanies: { branchId: string; companyId: string }[];
  permissions: string[];
  seats: TenantSeatState[];
  permissionScopes: Record<string, TenantPermissionScope>;
  teamMemberships: TenantTeamMembership[];
  accessScope: TenantAccessScope;
  featureEntitlements: Record<string, boolean>;
}

export type SessionStatus = 'unknown' | 'loading' | 'signed-in' | 'signed-out' | 'failed';
