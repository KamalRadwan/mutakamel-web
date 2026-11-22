import { ApiError } from '../../../core/api/api-errors';

/** CorePage moved to core/api/core-page.ts (shared/ and core/ import it from there); re-exported here. */
export type { CorePage, CorePageMeta } from '../../../core/api/core-page';

/**
 * Core answers a failed DTO check with 400 CORE_VALIDATION_FAILED. Its ValidationPipe passes the
 * ValidationError array as `message`, and AllExceptionsFilter flattens it into `details`:
 * one entry per field path, each a list of messages already in the request language.
 * Example: { "nameEn": ["nameEn should not be empty"], "cityIds": ["cityIds must contain no more than 500 elements"] }.
 */
export type CoreFieldErrors = Record<string, string[]>;

export const CORE_VALIDATION_FAILED = 'CORE_VALIDATION_FAILED';

/** The field messages of a CORE_VALIDATION_FAILED error, or null for any other error. */
export function coreFieldErrors(error: unknown): CoreFieldErrors | null {
  if (!(error instanceof ApiError) || error.code !== CORE_VALIDATION_FAILED) return null;
  const out: CoreFieldErrors = {};
  for (const [field, messages] of Object.entries(error.details ?? {})) {
    if (Array.isArray(messages)) {
      const texts = messages.filter((message): message is string => typeof message === 'string');
      if (texts.length) out[field] = texts;
    }
  }
  return out;
}

/** The first message for each known form field; fields the form does not show are left out. */
export function fieldMessages<F extends string>(errors: CoreFieldErrors, fields: readonly F[]): Partial<Record<F, string>> {
  const out: Partial<Record<F, string>> = {};
  for (const field of fields) {
    const first = errors[field]?.[0];
    if (first) out[field] = first;
  }
  return out;
}

/** True when some messages belong to fields the form cannot show (the caller then shows a toast). */
export function hasOtherFields(errors: CoreFieldErrors, fields: readonly string[]): boolean {
  return Object.keys(errors).some((field) => !fields.includes(field));
}

/**
 * One x-idempotency-key per user action: the same action (same signature, e.g. "delete:<id>")
 * reuses its key until it succeeds, so a retry after a lost answer is replayed, not applied twice.
 */
export class ActionKeys {
  private readonly keys = new Map<string, string>();

  constructor(private readonly newKey: () => string) {}

  keyFor(signature: string): string {
    let key = this.keys.get(signature);
    if (!key) {
      key = this.newKey();
      this.keys.set(signature, key);
    }
    return key;
  }

  done(signature: string): void {
    this.keys.delete(signature);
  }
}

/**
 * Fake helper: turns { field: reason } into the CORE_VALIDATION_FAILED details shape, with
 * class-validator style messages ("property code should not exist" for a non-whitelisted field).
 */
export function coreValidationDetails(reasons: Record<string, string>): CoreFieldErrors {
  return Object.fromEntries(
    Object.entries(reasons).map(([field, reason]) => [
      field,
      [reason === 'immutable' || reason === 'forbidden' ? `property ${field} should not exist` : `${field} is not valid`],
    ]),
  );
}
