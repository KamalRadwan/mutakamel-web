import { TranslocoService } from '@jsverse/transloco';
import { errorMessage } from '../../shared/staff.api';
import { OrgCascadeValue, TenantUser } from '../../shared/staff.model';

export type UserModalTab = 'profile' | 'roles' | 'teams' | 'apps' | 'phone' | 'calls';

export const EMPTY_USER_CASCADE: OrgCascadeValue = {
  companyId: null,
  branchId: null,
  departmentId: null,
  teamId: null,
};

const AVATAR_TONES = [
  'bg-icon-blue',
  'bg-icon-navy',
  'bg-icon-teal',
  'bg-icon-green',
  'bg-icon-orange',
  'bg-icon-red',
  'bg-icon-violet',
  'bg-icon-gray',
] as const;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function userFullName(user: Pick<TenantUser, 'firstName' | 'lastName' | 'email'>): string {
  const full = `${user.firstName} ${user.lastName}`.trim();
  return full || user.email;
}

export function userInitials(user: Pick<TenantUser, 'firstName' | 'lastName' | 'email'>): string {
  const first = user.firstName.trim().charAt(0);
  const last = user.lastName.trim().charAt(0);
  const combined = `${first}${last}`.toUpperCase();
  return combined || user.email.trim().charAt(0).toUpperCase() || '?';
}

export function avatarToneForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export function formatStaffDate(iso: string, language: 'ar' | 'en'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(`${language}-u-nu-latn`, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function resolveStaffError(error: unknown, transloco: TranslocoService): string {
  const msg = errorMessage(error, 'staff', transloco);
  if (msg && msg !== 'settings.errors.generic') return msg;
  const fallback = transloco.translate('staff.errors.generic');
  return fallback !== 'staff.errors.generic' ? fallback : msg;
}
