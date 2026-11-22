import { ApiError, fieldErrorsOf, isValidationError } from '../../../core/api/api-errors';
import { ACTION_TOKEN_MAX, ACTION_TOKEN_MIN } from '../shared/action-token';
import { PASSWORD_MAX, PASSWORD_MIN } from '../shared/password-policy';

/** DTO limits from ForgotPasswordDto and ResetPasswordDto. */
export const RESET_LIMITS = {
  emailMax: 255,
  tokenMin: ACTION_TOKEN_MIN,
  tokenMax: ACTION_TOKEN_MAX,
  passwordMin: PASSWORD_MIN,
  passwordMax: PASSWORD_MAX,
} as const;

/** POST /tenant/auth/forgot-password body (ForgotPasswordDto). */
export interface ForgotPasswordBody {
  email: string;
}

/** POST /tenant/auth/reset-password body (ResetPasswordDto). */
export interface ResetPasswordBody {
  token: string;
  newPassword: string;
}

export type ResetErrorKind = 'field-email' | 'field-password' | 'invalid-link' | 'throttle' | 'notice';

/** Maps known error codes for password recovery to Transloco keys. */
export const RESET_ERROR_KEYS: Readonly<Record<string, string>> = {
  INVALID_ACTION_TOKEN: 'authReset.invalid.text',
  WEAK_PASSWORD: 'auth.shared.errors.WEAK_PASSWORD',
  PASSWORD_TOO_LONG: 'auth.shared.errors.PASSWORD_TOO_LONG',
  'COMMON.GENERIC.RATE_LIMITED': 'auth.shared.throttle',
  'GW.RATE.LIMIT_EXCEEDED': 'auth.shared.throttle',
  TENANT_NOT_RESOLVABLE: 'auth.shared.errors.TENANT_NOT_RESOLVABLE',
  PLATFORM_MAINTENANCE: 'auth.shared.errors.PLATFORM_MAINTENANCE',
  AUTH_WEB_ORIGIN_NOT_ALLOWED: 'auth.shared.errors.generic',
  AUTH_CROSS_SITE_REQUEST_REJECTED: 'auth.shared.errors.generic',
  AUTH_GATEWAY_TRUST_REQUIRED: 'auth.shared.errors.generic',
  AUTH_NATIVE_NOT_ENABLED: 'auth.shared.errors.generic',
  NETWORK_ERROR: 'auth.shared.errors.network',
  NETWORK: 'auth.shared.errors.network',
};

export function resetErrorKind(error: unknown): ResetErrorKind {
  if (!(error instanceof ApiError)) return 'notice';
  if (
    error.status === 429 ||
    error.code === 'COMMON.GENERIC.RATE_LIMITED' ||
    error.code === 'GW.RATE.LIMIT_EXCEEDED'
  ) {
    return 'throttle';
  }
  if (error.code === 'INVALID_ACTION_TOKEN') {
    return 'invalid-link';
  }
  if (error.code === 'WEAK_PASSWORD' || error.code === 'PASSWORD_TOO_LONG') {
    return 'field-password';
  }
  if (isValidationError(error)) {
    const fields = fieldErrorsOf(error);
    if (fields['token']) return 'invalid-link';
    if (fields['email']) return 'field-email';
    if (fields['newPassword']) return 'field-password';
    return 'notice';
  }
  return 'notice';
}

export function resetErrorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return 'auth.shared.errors.generic';
  if (error.status === 0) return 'auth.shared.errors.network';
  if (error.status === 429) return 'auth.shared.throttle';
  if (isValidationError(error)) {
    const fields = fieldErrorsOf(error);
    if (fields['token']) return 'authReset.invalid.text';
    if (fields['email']) return 'authReset.errors.email';
    if (fields['newPassword']) {
      return fields['newPassword'].includes('max_length')
        ? 'auth.shared.errors.PASSWORD_TOO_LONG'
        : 'auth.shared.errors.WEAK_PASSWORD';
    }
    return 'auth.shared.errors.generic';
  }
  const mapped = RESET_ERROR_KEYS[error.code];
  if (mapped) return mapped;
  if (error.status === 503) return 'auth.shared.errors.unavailable';
  return 'auth.shared.errors.generic';
}
