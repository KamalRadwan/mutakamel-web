import { ApiError } from '../api/api-errors';
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
  workspace: {
    timezone: string;
    defaultLanguage: 'ar' | 'en';
  };
}

/** Identity and workspace timezone come from the same authenticated /me response. */
export function userFromMe(me: AuthMe): User {
  if (typeof me?.id !== 'string' || me.id.trim() === '' ||
      typeof me.email !== 'string' || me.email.trim() === '' ||
      typeof me.firstName !== 'string' || typeof me.lastName !== 'string' ||
      typeof me.workspace?.timezone !== 'string' || me.workspace.timezone.trim() === '') {
    throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: me.workspace.timezone });
  } catch {
    throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
  }

  return {
    id: me.id,
    displayName: `${me.firstName} ${me.lastName}`.trim(),
    email: me.email,
    timeZone: me.workspace.timezone,
  };
}
