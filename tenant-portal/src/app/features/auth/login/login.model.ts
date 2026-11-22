import { ApiError, isValidationError } from '../../../core/api/api-errors';
import type { LoginSession, MfaStep } from '../../../core/auth/auth-session.model';

/** POST /tenant/auth/login body (LoginDto). The backend trims and lower-cases the email. */
export interface LoginBody {
  email: string;
  password: string;
}

/** The login form. `remember` is not a body field: it travels as the `x-auth-remember: 1` header. */
export interface LoginForm extends LoginBody {
  remember: boolean;
}

/** LoginDto limits: @MaxLength(255) on email, PASSWORD_MAX_LENGTH (128) on password. */
export const LOGIN_LIMITS = { emailMax: 255, passwordMax: 128 } as const;

export type LoginResult = LoginSession | MfaStep;

/** Keys under `auth.errors`. Transloco keys cannot hold dots, so COMMON.GENERIC.RATE_LIMITED maps to RATE_LIMITED. */
export type LoginErrorKey =
  | 'INVALID_CREDENTIALS'
  | 'AUTH_LOGIN_THROTTLED'
  | 'AUTH_MFA_THROTTLED'
  | 'RATE_LIMITED'
  | 'AUTH_SESSION_LIMIT_REACHED'
  | 'SUBSCRIPTION_PAST_DUE'
  | 'PLATFORM_MAINTENANCE'
  | 'TENANT_MAINTENANCE'
  | 'AUTH_MFA_UNAVAILABLE'
  | 'TENANT_NOT_RESOLVABLE'
  | 'CORE_VALIDATION_FAILED'
  | 'UNKNOWN';

const ERROR_KEYS: Readonly<Record<string, LoginErrorKey>> = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  AUTH_LOGIN_THROTTLED: 'AUTH_LOGIN_THROTTLED',
  AUTH_MFA_THROTTLED: 'AUTH_MFA_THROTTLED',
  'COMMON.GENERIC.RATE_LIMITED': 'RATE_LIMITED',
  'GW.RATE.LIMIT_EXCEEDED': 'RATE_LIMITED',
  AUTH_SESSION_LIMIT_REACHED: 'AUTH_SESSION_LIMIT_REACHED',
  SUBSCRIPTION_PAST_DUE: 'SUBSCRIPTION_PAST_DUE',
  PLATFORM_MAINTENANCE: 'PLATFORM_MAINTENANCE',
  TENANT_MAINTENANCE_ACTIVE: 'TENANT_MAINTENANCE',
  TENANT_MAINTENANCE_RELEASE_REQUIRED: 'TENANT_MAINTENANCE',
  AUTH_MFA_UNAVAILABLE: 'AUTH_MFA_UNAVAILABLE',
  TENANT_NOT_RESOLVABLE: 'TENANT_NOT_RESOLVABLE',
  CORE_VALIDATION_FAILED: 'CORE_VALIDATION_FAILED',
};

export function loginErrorKey(error: unknown): LoginErrorKey {
  if (!(error instanceof ApiError)) return 'UNKNOWN';
  const known = Object.hasOwn(ERROR_KEYS, error.code) ? ERROR_KEYS[error.code] : undefined;
  if (known) return known;
  if (error.status === 429) return 'RATE_LIMITED';
  return isValidationError(error) ? 'CORE_VALIDATION_FAILED' : 'UNKNOWN';
}

/** Minutes from `details.retryAfterSeconds: ['900']` (AUTH_LOGIN_THROTTLED, AUTH_MFA_THROTTLED); 0 when absent. */
export function retryAfterMinutes(error: unknown): number {
  const raw = error instanceof ApiError ? error.details?.['retryAfterSeconds'] : undefined;
  const seconds = Number(Array.isArray(raw) ? raw[0] : Number.NaN);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds / 60) : 0;
}
