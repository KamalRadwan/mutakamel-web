import { ApiError, fieldErrorsOf, isValidationError } from '../../../core/api/api-errors';
import type { LoginSession, MfaStep } from '../../../core/auth/auth-session.model';

/** POST /api/tenant/core/v1/auth/accept-invite request body (AcceptInviteDto). */
export interface AcceptInviteBody {
  token: string;
  newPassword: string;
}

export type AcceptInviteResult = LoginSession | MfaStep;

export type InviteErrorKind = 'field-password' | 'invalid' | 'throttle' | 'notice';

export type InviteNoticeTone = 'danger' | 'warning';

export const INVITE_ERROR_KEYS: Readonly<Record<string, string>> = {
  INVALID_ACTION_TOKEN: 'authInvite.invalid.text',
  WEAK_PASSWORD: 'auth.shared.errors.WEAK_PASSWORD',
  PASSWORD_TOO_LONG: 'auth.shared.errors.PASSWORD_TOO_LONG',
  SUBSCRIPTION_PAST_DUE: 'auth.shared.errors.SUBSCRIPTION_PAST_DUE',
  AUTH_SESSION_LIMIT_REACHED: 'authInvite.errors.sessionLimit',
  PLATFORM_MAINTENANCE: 'auth.shared.errors.PLATFORM_MAINTENANCE',
  AUTH_MFA_UNAVAILABLE: 'authInvite.errors.AUTH_MFA_UNAVAILABLE',
  TENANT_NOT_RESOLVABLE: 'auth.shared.errors.TENANT_NOT_RESOLVABLE',
  AUTH_MFA_THROTTLED: 'auth.shared.throttle',
  'COMMON.GENERIC.RATE_LIMITED': 'auth.shared.throttle',
  'GW.RATE.LIMIT_EXCEEDED': 'auth.shared.throttle',
  NETWORK_ERROR: 'authInvite.errors.ambiguous',
};

const THROTTLE_CODES: ReadonlySet<string> = new Set([
  'AUTH_MFA_THROTTLED',
  'COMMON.GENERIC.RATE_LIMITED',
  'GW.RATE.LIMIT_EXCEEDED',
]);

const FIELD_PASSWORD_CODES: ReadonlySet<string> = new Set([
  'WEAK_PASSWORD',
  'PASSWORD_TOO_LONG',
]);

export function inviteErrorKind(error: unknown): InviteErrorKind {
  if (!(error instanceof ApiError)) return 'notice';
  if (error.code === 'INVALID_ACTION_TOKEN') return 'invalid';

  if (isValidationError(error)) {
    const fields = fieldErrorsOf(error);
    if (fields['token']) return 'invalid';
    if (fields['newPassword']) return 'field-password';
    return 'notice';
  }

  if (FIELD_PASSWORD_CODES.has(error.code)) return 'field-password';
  if (error.status === 429 || THROTTLE_CODES.has(error.code)) return 'throttle';
  return 'notice';
}

export function inviteErrorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return 'auth.shared.errors.generic';

  if (isValidationError(error)) {
    const fields = fieldErrorsOf(error);
    if (fields['token']) return 'authInvite.invalid.text';
    if (fields['newPassword']) {
      return fields['newPassword'].includes('max_length')
        ? 'auth.shared.errors.PASSWORD_TOO_LONG'
        : 'auth.validation.server';
    }
    return 'auth.shared.errors.generic';
  }

  if (error.status === 0) return 'authInvite.errors.ambiguous';
  if (error.status === 429 || THROTTLE_CODES.has(error.code)) return 'auth.shared.throttle';

  const mapped = INVITE_ERROR_KEYS[error.code];
  if (mapped) return mapped;

  if (error.status === 503) return 'auth.shared.errors.unavailable';
  return 'auth.shared.errors.generic';
}

export function inviteNoticeTone(error: unknown): InviteNoticeTone {
  return error instanceof ApiError && error.code === 'AUTH_SESSION_LIMIT_REACHED' ? 'warning' : 'danger';
}
