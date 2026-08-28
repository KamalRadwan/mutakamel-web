export const ADMIN_PASSWORD_MIN_LENGTH = 12;
export const ADMIN_PASSWORD_MAX_LENGTH = 128;
const ADMIN_ACTION_TOKEN_MIN_LENGTH = 16;
export const ADMIN_ACTION_TOKEN_MAX_LENGTH = 512;

export interface AdminPasswordChecks {
  length: boolean;
  lowercase: boolean;
  uppercase: boolean;
  number: boolean;
  symbol: boolean;
}

export type AdminPasswordValidationError =
  | "tokenMissing"
  | "tokenInvalid"
  | "passwordRequired"
  | "passwordTooLong"
  | "passwordWeak"
  | "confirmationMismatch";

export function getAdminPasswordChecks(password: string): AdminPasswordChecks {
  return {
    length: password.length >= ADMIN_PASSWORD_MIN_LENGTH,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
}

export function isStrongAdminPassword(password: string): boolean {
  if (password.length > ADMIN_PASSWORD_MAX_LENGTH) return false;
  return Object.values(getAdminPasswordChecks(password)).every(Boolean);
}

export function validateAdminPasswordAction(input: {
  token: string | null;
  password: string;
  confirmation: string;
}): AdminPasswordValidationError | null {
  if (input.token === null || input.token.length === 0) return "tokenMissing";
  if (
    input.token.length < ADMIN_ACTION_TOKEN_MIN_LENGTH ||
    input.token.length > ADMIN_ACTION_TOKEN_MAX_LENGTH
  ) {
    return "tokenInvalid";
  }
  if (input.password.length === 0) return "passwordRequired";
  if (input.password.length > ADMIN_PASSWORD_MAX_LENGTH) {
    return "passwordTooLong";
  }
  if (!isStrongAdminPassword(input.password)) return "passwordWeak";
  if (input.password !== input.confirmation) return "confirmationMismatch";
  return null;
}

export function readAdminActionTokenFromHash(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  const token = new URLSearchParams(raw).get("token");
  return token && token.length > 0 ? token : null;
}
