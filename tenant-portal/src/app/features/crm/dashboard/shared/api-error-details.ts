import { ApiError } from '../../../../shared/widgets/dashboard/analytics-api';

/**
 * Error details as the CRM error filter sends them: one string array per key. The shared filter drops every other
 * value shape (numbers, objects, arrays of objects), so the fakes send only this.
 *
 * Two forms reach the client:
 * - DTO (ValidationPipe) 400s: `{ <dtoField>: ['<reason>'] }`.
 * - Business 422/409s (dashboard lane decision, 2026-11-22): parallel `path`/`code` arrays, one entry per issue.
 *   Paths are dotted and relative to the request body (`items.3.w`, never `layout.items.3.w`), codes are lowercase
 *   snake case, numbers travel as decimal strings. Extras about the whole error are single entries. Example:
 *   `{ path: ['items.3.w', 'items.3.h'], code: ['min_width', 'min_height'], placementId: ['…'], minW: ['16'], minH: ['10'] }`.
 * - 5xx errors carry no details.
 */
export type ApiErrorDetails = Record<string, string[]>;

/** `{ field: [reason] }`, the details of one field-level 400 CRM_VALIDATION_FAILED. */
export function fieldDetails(field: string, reason: string): ApiErrorDetails {
  return { [field]: [reason] };
}

/** One business issue: a dotted `path`, a lowercase snake `code` and optional string extras (numbers as decimal strings). */
export type DetailIssue = { path: string; code: string } & Record<string, string>;

/** Parallel string arrays for one or more issues: every key appears in every entry (a missing extra becomes ''). */
export function issueDetails(issues: readonly DetailIssue[]): ApiErrorDetails {
  const keys = new Set<string>();
  for (const issue of issues) for (const key of Object.keys(issue)) keys.add(key);
  const details: ApiErrorDetails = {};
  for (const key of keys) details[key] = issues.map((issue) => issue[key] ?? '');
  return details;
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : null;
}

function detailsOf(source: unknown): Record<string, unknown> | null {
  if (source instanceof ApiError) return (source.details as Record<string, unknown> | undefined) ?? null;
  return source && typeof source === 'object' ? (source as Record<string, unknown>) : null;
}

/** The issues of a parallel-array details object (`path` + `code`), in order. Empty for the DTO form. */
export function detailIssues(source: unknown): { path: string; code: string }[] {
  const details = detailsOf(source);
  const paths = stringArray(details?.['path']);
  if (!paths) return [];
  const codes = stringArray(details?.['code']) ?? [];
  return paths.map((path, index) => ({ path, code: codes[index] ?? '' }));
}

/** The trimmed string at `index` of the array under `key`, or null. */
export function detailString(source: unknown, key: string, index = 0): string | null {
  const value = stringArray(detailsOf(source)?.[key])?.[index];
  return value !== undefined && value.trim() ? value.trim() : null;
}

/** A positive integer sent as a decimal string under `key` (entry `index`), or null. */
export function detailInt(source: unknown, key: string, index = 0): number | null {
  const text = detailString(source, key, index);
  if (text === null || !/^\d+$/.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/**
 * The first field an error's details name, or null when the error carries no field details: the first issue `path`
 * of the parallel-array form, else the first key of the DTO form.
 */
export function errorDetailField(error: unknown): string | null {
  if (!(error instanceof ApiError) || !error.details) return null;
  const issues = detailIssues(error);
  if (issues.length > 0) return issues[0].path || null;
  for (const [key, value] of Object.entries(error.details)) {
    if (stringArray(value)) return key;
  }
  return null;
}
