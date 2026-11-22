export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export interface PasswordChecks {
  length: boolean;
  lower: boolean;
  upper: boolean;
  digit: boolean;
  symbol: boolean;
}

/** Matches core-app PASSWORD_POLICY / isStrongPassword rules. */
export function passwordChecks(value: string): PasswordChecks {
  return {
    length: value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX,
    lower: /[a-z]/.test(value),
    upper: /[A-Z]/.test(value),
    digit: /[0-9]/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value),
  };
}

export function allChecksPass(checks: PasswordChecks): boolean {
  return checks.length && checks.lower && checks.upper && checks.digit && checks.symbol;
}
