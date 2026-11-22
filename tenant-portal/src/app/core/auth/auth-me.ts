import type { User } from './current-user';

/**
 * The identity part of GET /tenant/auth/me (`TenantMe`, Core envelope `data`).
 * The full body also carries permissions, seats, scopes and team memberships.
 */
export interface AuthMe {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  hasAvatar: boolean;
  isTenantOwner: boolean;
  mfaEnabled: boolean;
  mfaUpdatedAt: string | null;
  status: string;
}

/** /me has no display name and no time zone: the name is first + last, the zone comes from elsewhere. */
export function userFromMe(me: AuthMe, timeZone?: string): User {
  return {
    id: me.id,
    displayName: `${me.firstName} ${me.lastName}`.trim(),
    email: me.email,
    ...(timeZone ? { timeZone } : {}),
  };
}
