/** Subset of the TenantUserView returned by PATCH users/me (no hasAvatar). */
export interface OwnNameUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isTenantOwner: boolean;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
}

export interface OwnNamePatch {
  firstName?: string;
  lastName?: string;
}

export interface TenantProfile {
  id: string;
  tenantUserId: string;
  themeKey: string | null;
  language: 'en' | 'ar' | null;
  extensions: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TenantProfilePatch {
  themeKey?: string | null;
  language?: 'en' | 'ar';
  extensions?: Record<string, unknown>;
}

export type StartPage = 'home' | 'last' | 'crm-leads';

export const NAME_MAX = 80;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export function isStartPage(value: unknown): value is StartPage {
  return value === 'home' || value === 'last' || value === 'crm-leads';
}
