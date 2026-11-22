import { ApiError, fieldErrorsOf, isValidationError } from '../../../core/api/api-errors';

/** MfaVerifyDto / MfaResendDto constraints from Core. */
export const MFA_CHALLENGE_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const MFA_CODE_PATTERN = /^[0-9]{6}$/;
export const MFA_CODE_LENGTH = 6;
export const MFA_MAX_LOCAL_ATTEMPTS = 5;

export interface MfaVerifyBody {
  challengeId: string;
  code: string;
}

export interface MfaResendBody {
  challengeId: string;
}

export type VerifyErrorKind = 'field' | 'throttle' | 'notice' | 'restart';
export type VerifyNoticeTone = 'danger' | 'warning';

export interface VerifyErrorInfo {
  key: string;
  kind: VerifyErrorKind;
  tone?: VerifyNoticeTone;
}

export const VERIFY_ERROR_KEYS: Readonly<Record<string, VerifyErrorInfo>> = {
  AUTH_MFA_INVALID_CHALLENGE: {
    key: 'authVerify.errors.AUTH_MFA_INVALID_CHALLENGE',
    kind: 'field',
  },
  AUTH_MFA_THROTTLED: {
    key: 'auth.shared.throttle',
    kind: 'throttle',
    tone: 'warning',
  },
  'COMMON.GENERIC.RATE_LIMITED': {
    key: 'auth.shared.throttle',
    kind: 'throttle',
    tone: 'warning',
  },
  'GW.RATE.LIMIT_EXCEEDED': {
    key: 'auth.shared.throttle',
    kind: 'throttle',
    tone: 'warning',
  },
  AUTH_MFA_UNAVAILABLE: {
    key: 'authVerify.errors.AUTH_MFA_UNAVAILABLE',
    kind: 'notice',
    tone: 'danger',
  },
  PLATFORM_MAINTENANCE: {
    key: 'auth.shared.errors.PLATFORM_MAINTENANCE',
    kind: 'notice',
    tone: 'danger',
  },
  SUBSCRIPTION_PAST_DUE: {
    key: 'auth.shared.errors.SUBSCRIPTION_PAST_DUE',
    kind: 'notice',
    tone: 'danger',
  },
  AUTH_SESSION_LIMIT_REACHED: {
    key: 'auth.shared.errors.AUTH_SESSION_LIMIT_REACHED',
    kind: 'notice',
    tone: 'warning',
  },
  TENANT_NOT_RESOLVABLE: {
    key: 'auth.shared.errors.TENANT_NOT_RESOLVABLE',
    kind: 'notice',
    tone: 'danger',
  },
  AUTH_WEB_ORIGIN_NOT_ALLOWED: {
    key: 'auth.shared.errors.generic',
    kind: 'notice',
    tone: 'danger',
  },
  AUTH_CROSS_SITE_REQUEST_REJECTED: {
    key: 'auth.shared.errors.generic',
    kind: 'notice',
    tone: 'danger',
  },
  AUTH_GATEWAY_TRUST_REQUIRED: {
    key: 'auth.shared.errors.generic',
    kind: 'notice',
    tone: 'danger',
  },
  AUTH_NATIVE_NOT_ENABLED: {
    key: 'auth.shared.errors.generic',
    kind: 'notice',
    tone: 'danger',
  },
};

export function verifyErrorKey(error: unknown): VerifyErrorInfo {
  if (!(error instanceof ApiError)) {
    return { key: 'auth.shared.errors.generic', kind: 'notice', tone: 'danger' };
  }

  if (error.status === 0) {
    return { key: 'authVerify.errors.ambiguous', kind: 'notice', tone: 'danger' };
  }

  if (isValidationError(error)) {
    const fields = fieldErrorsOf(error);
    if ('challengeId' in fields) {
      return { key: 'authVerify.restart.text', kind: 'restart', tone: 'warning' };
    }
    if ('code' in fields) {
      return { key: 'authVerify.errors.format', kind: 'field' };
    }
    return { key: 'auth.shared.errors.generic', kind: 'notice', tone: 'danger' };
  }

  const mapped = VERIFY_ERROR_KEYS[error.code];
  if (mapped) {
    return mapped;
  }

  if (error.status === 429) {
    return { key: 'auth.shared.throttle', kind: 'throttle', tone: 'warning' };
  }

  // A bare 503 (fail-closed rate-limit store) carries no domain code.
  if (error.status === 503) {
    return { key: 'auth.shared.errors.unavailable', kind: 'notice', tone: 'danger' };
  }

  return { key: 'auth.shared.errors.generic', kind: 'notice', tone: 'danger' };
}

export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
