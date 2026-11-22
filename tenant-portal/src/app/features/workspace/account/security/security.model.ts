export interface SecurityMe {
  id: string;
  email: string;
  mfaEnabled: boolean;
  mfaUpdatedAt: string | null;
} // subset of GET auth/me

export interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

export interface MfaStep {
  mfaRequired: true;
  challengeId: string;
  expiresIn: number;
  resendAfterSeconds: number;
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
