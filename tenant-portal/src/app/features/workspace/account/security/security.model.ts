import { ApiError } from '../../../../core/api/api-errors';
import type { AuthMe } from '../../../../core/auth/auth-me';

export type SecurityMe = Pick<AuthMe, 'id' | 'email' | 'mfaEnabled' | 'mfaUpdatedAt'>;

export interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

export function retryAfterSecondsOf(error: unknown): number {
  if (!(error instanceof ApiError)) return 60;
  const raw = error.details?.['retryAfterSeconds'];
  const seconds = Number(Array.isArray(raw) ? raw[0] : NaN);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 60;
}

export function isUnknownOutcome(error: unknown): boolean {
  return (
    (error instanceof ApiError && error.status === 0) ||
    (error instanceof Error && error.name === 'TimeoutError')
  );
}

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;
export const MFA_CODE_PATTERN = /^[0-9]{6}$/;

export interface PasswordChecks {
  length: boolean;
  lower: boolean;
  upper: boolean;
  digit: boolean;
  symbol: boolean;
}

export function passwordChecks(value: string): PasswordChecks {
  return {
    length: value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX,
    lower: /[a-z]/.test(value),
    upper: /[A-Z]/.test(value),
    digit: /[0-9]/.test(value),
    symbol: /[^\p{L}\p{N}\s]/u.test(value),
  };
}

export function allPasswordChecksPass(checks: PasswordChecks): boolean {
  return checks.length && checks.lower && checks.upper && checks.digit && checks.symbol;
}
