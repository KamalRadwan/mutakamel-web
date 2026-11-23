/** Generic API error type and error-to-message helpers. Shared by every feature. */
import type { SettingsTranslator } from './settings-translator';

/** Optional extras for an ApiError; fakes use it to mimic the real envelope. */
export interface ApiErrorOptions {
  /** The request's correlation id, sent at the top level of every error body (5xx included). */
  readonly correlationId?: string | null;
}

export class ApiError extends Error {
  /** Top-level correlation id from the error body; 5xx bodies carry it but no details. */
  readonly correlationId?: string;

  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: Record<string, unknown>,
    options?: ApiErrorOptions,
  ) {
    super(code);
    this.name = 'ApiError';
    const correlationId = nonEmptyString(options?.correlationId);
    if (correlationId) this.correlationId = correlationId;
  }

  /**
   * Builds an ApiError from an HTTP status and error body. Reads the service
   * envelope (`errorCode`, `details`, `correlationId`) and the gateway problem
   * (`code`, `errors`, `correlationId`); the correlation id is always top level.
   */
  static fromResponse(status: number, body: unknown): ApiError {
    const raw = isRecord(body) ? body : {};
    const code = nonEmptyString(raw['errorCode']) ?? nonEmptyString(raw['code']) ?? codeForStatus(status);
    const details = isRecord(raw['details']) ? raw['details'] : isRecord(raw['errors']) ? raw['errors'] : undefined;
    return new ApiError(status, code, details, { correlationId: nonEmptyString(raw['correlationId']) });
  }
}

export function errorCodeOf(error: unknown): string | null {
  return error instanceof ApiError ? error.code : null;
}

/** The correlation id of an error: the top-level field first, then the legacy `details.correlationId`. */
export function correlationIdOf(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  return nonEmptyString(error.correlationId) ?? nonEmptyString(error.details?.['correlationId']) ?? null;
}

/**
 * Request-validation codes. Core, CRM and Trade each name their own; the shared
 * filter falls back to COMMON.GENERIC.VALIDATION_FAILED. VALIDATION_ERROR is
 * still thrown by fakes. Every service sends `details` keyed by field path.
 */
export const VALIDATION_ERROR_CODES: ReadonlySet<string> = new Set([
  'VALIDATION',
  'VALIDATION_ERROR',
  'CORE_VALIDATION_FAILED',
  'CRM_VALIDATION_FAILED',
  'TRADE.VALIDATION_FAILED',
  'COMMON.GENERIC.VALIDATION_FAILED',
]);

export function isValidationError(error: unknown): boolean {
  const code = errorCodeOf(error);
  return code !== null && VALIDATION_ERROR_CODES.has(code);
}

/**
 * Field messages of a validation error, keyed by field path. Reads the real
 * shape (`details: { "lines.0.qty": ["..."] }`, `_` for unattributed messages)
 * and the fake shape (`details: { field: "name" }`, which yields `{ name: [] }`).
 * Returns an empty object for any other error.
 */
export function fieldErrorsOf(error: unknown): Record<string, string[]> {
  if (!(error instanceof ApiError) || !isValidationError(error) || !error.details) return {};
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(error.details)) {
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) out[key] = [...value];
  }
  const field = nonEmptyString(error.details['field']);
  if (field && !out[field]) out[field] = [];
  return out;
}

const GENERIC_ERROR_KEYS: Readonly<Record<string, string>> = {
  GENERIC: 'generic',
  INTERNAL_ERROR: 'generic',
  SERVER_ERROR: 'generic',
  'COMMON.GENERIC.INTERNAL_ERROR': 'generic',
  'COMMON.GENERIC.HTTP_ERROR': 'generic',
  NETWORK: 'network',
  NETWORK_ERROR: 'network',
  NOT_FOUND: 'notFound',
  'COMMON.GENERIC.NOT_FOUND': 'notFound',
  PERMISSION: 'permission',
  PERMISSION_DENIED: 'permission',
  FORBIDDEN: 'permission',
  UNAUTHORIZED: 'permission',
  'COMMON.GENERIC.FORBIDDEN': 'permission',
  'COMMON.GENERIC.UNAUTHORIZED': 'session',
  // Same key replayed while the first request still runs.
  IDEMPOTENCY: 'idempotency',
  IDEMPOTENCY_CONFLICT: 'idempotency',
  IDEMPOTENCY_IN_PROGRESS: 'idempotency',
  IDEMPOTENCY_REQUEST_PROCESSING: 'idempotency',
  IDEM_IN_FLIGHT: 'idempotency',
  'GW.IDEM.IN_FLIGHT': 'idempotency',
  'CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT': 'idempotency',
  ACTIVITY_IDEMPOTENCY_IN_FLIGHT: 'idempotency',
  // Key missing or malformed (gateway catalogue keys and their wire codes).
  CRM_IDEMPOTENCY_KEY_REQUIRED: 'idempotencyKey',
  INVALID_IDEMPOTENCY_KEY: 'idempotencyKey',
  IDEM_MISSING: 'idempotencyKey',
  IDEM_BAD_VALUE: 'idempotencyKey',
  'GW.IDEM.MISSING': 'idempotencyKey',
  'GW.IDEM.BAD_VALUE': 'idempotencyKey',
  // Same key reused with a different body.
  IDEMPOTENCY_BODY_MISMATCH: 'idempotencyMismatch',
  IDEM_MISMATCH: 'idempotencyMismatch',
  'GW.IDEM.MISMATCH': 'idempotencyMismatch',
  'CORE.TEMPLATE.IDEMPOTENCY.MISMATCH': 'idempotencyMismatch',
  ACTIVITY_IDEMPOTENCY_MISMATCH: 'idempotencyMismatch',
  // 429 with a Retry-After header and no details.
  RATE_LIMITED: 'rateLimited',
  'COMMON.GENERIC.RATE_LIMITED': 'rateLimited',
  'GW.RATE.LIMIT_EXCEEDED': 'rateLimited',
  SUBSCRIPTION: 'subscription',
  SUBSCRIPTION_READ_ONLY: 'subscription',
  TENANT_MAINTENANCE_ACTIVE: 'maintenance',
  TENANT_MAINTENANCE_RELEASE_REQUIRED: 'maintenance',
  ACCESS_POLICY_UNAVAILABLE: 'accessCheckUnavailable',
  ...Object.fromEntries([...VALIDATION_ERROR_CODES].map((code) => [code, 'validation'])),
};

/** The shared message key (`generic`, `validation`, `rateLimited`...) for an error code, if mapped. */
export function sharedErrorKeyOf(code: string): string | null {
  return GENERIC_ERROR_KEYS[code] ?? null;
}

/** Shared messages: the settings scope (when loaded) first, then the always-loaded global file. */
const SHARED_ERROR_PREFIXES = ['settings.errors.', 'apiErrors.'] as const;

type Translate = (key: string, params?: Record<string, unknown>) => string;

function resolveTranslation(translate: Translate, key: string, params?: Record<string, unknown>): string | null {
  const translated = translate(key, params);
  return translated && translated !== key ? translated : null;
}

function resolveShared(translate: Translate, key: string, params?: Record<string, unknown>): string | null {
  for (const prefix of SHARED_ERROR_PREFIXES) {
    const found = resolveTranslation(translate, `${prefix}${key}`, params);
    if (found) return found;
  }
  return null;
}

export function errorMessage(error: unknown, scope: string, t: SettingsTranslator): string {
  const translate: Translate = typeof t === 'function' ? t : (key, params) => t.translate(key, params);
  const code = typeof error === 'string' ? error : errorCodeOf(error);
  const details = error instanceof ApiError ? error.details : undefined;
  const scopePrefix = scope.endsWith('.errors.') ? scope : scope.endsWith('.errors') ? `${scope}.` : `${scope}.errors.`;
  const shared = (key: string, params?: Record<string, unknown>): string =>
    resolveShared(translate, key, params) ?? translate(`settings.errors.${key}`, params);

  const scoped = code ? resolveTranslation(translate, `${scopePrefix}${code}`, details) : null;
  if (scoped) return scoped;
  if (error instanceof ApiError && error.status === 413) return shared('tooLarge', details);

  if (code) {
    const retryAfter = details?.['retryAfterSeconds'];
    if (code === 'GW.RATE.LIMIT_EXCEEDED' && Array.isArray(retryAfter) && typeof retryAfter[0] === 'string') {
      return shared('rateLimitedIn', { ...details, seconds: retryAfter[0] });
    }
    const mapped = GENERIC_ERROR_KEYS[code] ?? code;
    const sharedMessage = resolveShared(translate, mapped, details);
    if (sharedMessage) return sharedMessage;

    if (code.endsWith('_NOT_FOUND')) {
      return shared('notFound', details);
    }
  }

  if (error instanceof ApiError) {
    if (error.status === 0) return shared('network');
    // A 401 means "session ended" only when no domain code says otherwise
    // (e.g. AUTH_MFA_INVALID_CHALLENGE, INVALID_CREDENTIALS stay on screen; memory mfa-401-not-session-expiry).
    if (error.status === 401) return error.code && error.code.startsWith('AUTH_') || error.code === 'INVALID_CREDENTIALS' ? shared('generic') : shared('session');
    if (error.status === 403) return shared('permission');
    if (error.status === 404) return shared('notFound');
    if (error.status === 400 || error.status === 422) return shared('validation');
    if (error.status === 429) return shared('rateLimited');
  }

  return shared('generic');
}

export function writeErrorMessage(error: unknown, scope: string, t: SettingsTranslator): string {
  if (error instanceof ApiError && error.status === 401) {
    const translate: Translate = typeof t === 'function' ? t : (key, params) => t.translate(key, params);
    return resolveShared(translate, 'notSaved', error.details) ?? translate('settings.errors.notSaved', error.details);
  }
  return errorMessage(error, scope, t);
}

export function isRetryableWriteError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || error.status >= 500 || [
    'GW.IDEM.IN_FLIGHT',
    'CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT',
    'ACTIVITY_IDEMPOTENCY_IN_FLIGHT',
    'IDEMPOTENCY_IN_PROGRESS',
    'IDEMPOTENCY_REQUEST_PROCESSING',
  ].includes(error.code));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Mirrors the shared filter's fallback codes when a body has none. */
function codeForStatus(status: number): string {
  if (status === 0) return 'NETWORK_ERROR';
  if (status === 400) return 'COMMON.GENERIC.VALIDATION_FAILED';
  if (status === 401) return 'COMMON.GENERIC.UNAUTHORIZED';
  if (status === 403) return 'COMMON.GENERIC.FORBIDDEN';
  if (status === 404) return 'COMMON.GENERIC.NOT_FOUND';
  if (status === 409) return 'COMMON.GENERIC.CONFLICT';
  if (status === 422) return 'COMMON.GENERIC.UNPROCESSABLE_ENTITY';
  if (status === 429) return 'COMMON.GENERIC.RATE_LIMITED';
  return status >= 500 ? 'COMMON.GENERIC.INTERNAL_ERROR' : 'COMMON.GENERIC.HTTP_ERROR';
}
