import type { CorePath } from "@/lib/api/envelope";
import { buildCoreListQuery, parseCorePage, type CorePage } from "../../contracts/core-page";
import {
  isBoundedInteger,
  isNonEmptyString,
  isTimestamp,
  isUnsignedIntegerString,
  isUuidV7,
  record,
} from "../../core-validation";

export const NUMBERING_PATH = "/api/tenant/core/v1/numbering";

/** `CreateNumberingSequenceDto` / `UpdateNumberingSequenceDto` column bounds. */
export const NUMBERING_CODE_MAX_LENGTH = 64;
export const NUMBERING_PREFIX_MAX_LENGTH = 16;
const NUMBERING_PADDING_MIN = 1;
const NUMBERING_PADDING_MAX = 12;
export const NUMBERING_PAGE_SIZE = 20;

/** `NumberingCodeParamDto` and `CreateNumberingSequenceDto` share this pattern. */
const NUMBERING_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._:-]{0,63}$/u;
// Unlike $ alone, the final assertion also rejects a trailing newline.
const NUMBERING_PREFIX_PATTERN = /^[\p{L}\p{N}._:/#-]*$(?![\s\S])/u;

/** `NumberingSequencesService` rejections. */
export const SEQUENCE_NOT_FOUND_CODE = "SEQUENCE_NOT_FOUND";
export const SEQUENCE_CODE_TAKEN_CODE = "SEQUENCE_CODE_TAKEN";
export const SEQUENCE_VALUE_INVALID_CODE = "SEQUENCE_VALUE_INVALID";
export const COMPANY_INVALID_CODE = "COMPANY_INVALID";

export interface NumberingSequence {
  id: string;
  code: string;
  prefix: string | null;
  padding: number;
  /** `bigint` column serialised as a string; never parse into a JS number. */
  nextValue: string;
  companyId: string | null;
  updatedAt: string;
}

export interface NumberingPeek {
  code: string;
  companyId: string | null;
  nextValue: string;
  /** The server's own rendering at the currently saved prefix and padding. */
  formatted: string;
}

export interface NumberingFormValues {
  code: string;
  prefix: string;
  padding: string;
  /** Create: `startValue`. Edit: `nextValue`. Both are integers on the wire. */
  startValue: string;
  companyId: string | null;
}

/** `CreateNumberingSequenceDto`. */
export interface CreateNumberingSequenceRequest {
  code: string;
  prefix?: string;
  padding?: number;
  startValue?: number;
  companyId?: string;
}

/** `UpdateNumberingSequenceDto` — no `code`, no `companyId`; the scope key is fixed. */
export interface UpdateNumberingSequenceRequest {
  prefix?: string;
  padding?: number;
  nextValue?: number;
}

export interface NumberingListOptions {
  page: number;
  companyId?: string;
  code?: string;
  search: string;
  sortBy?: NumberingSortField;
  sortDir?: "ASC" | "DESC";
  signal?: AbortSignal;
}

export const EMPTY_NUMBERING_FORM: NumberingFormValues = {
  code: "",
  prefix: "",
  padding: "5",
  startValue: "1",
  companyId: null,
};

export function toNumberingForm(sequence: NumberingSequence): NumberingFormValues {
  return {
    code: sequence.code,
    prefix: sequence.prefix ?? "",
    padding: String(sequence.padding),
    startValue: sequence.nextValue,
    companyId: sequence.companyId,
  };
}

export function numberingPath(id: string): CorePath {
  if (!isUuidV7(id)) invalidResponse();
  return `${NUMBERING_PATH}/${encodeURIComponent(id)}` as CorePath;
}

/** The route upper-cases `:code` before lookup, so the URL is case-insensitive. */
export function numberingPeekPath(code: string, companyId: string | null): CorePath {
  const normalized = code.trim().toUpperCase();
  if (!NUMBERING_CODE_PATTERN.test(normalized)) throw new Error("NUMBERING_FORM_CODE");
  const query = new URLSearchParams();
  if (companyId !== null) query.set("companyId", companyId);
  const suffix = query.toString();
  return `${NUMBERING_PATH}/${encodeURIComponent(normalized)}/peek${suffix ? `?${suffix}` : ""}` as CorePath;
}

/** The only sort fields GET /numbering accepts; else a 400. */
export const NUMBERING_SORT_FIELDS = ["code", "nextValue", "createdAt"] as const;
export type NumberingSortField = (typeof NUMBERING_SORT_FIELDS)[number];

export function numberingListQuery(options: NumberingListOptions): string {
  if (options.companyId !== undefined && !isUuidV7(options.companyId)) throw new Error("NUMBERING_FORM_COMPANY");
  const normalizedCode = options.code?.trim().toUpperCase();
  if (normalizedCode && !NUMBERING_CODE_PATTERN.test(normalizedCode)) throw new Error("NUMBERING_FORM_CODE");
  return buildCoreListQuery({
    page: options.page,
    limit: NUMBERING_PAGE_SIZE,
    search: options.search,
    sortBy: options.sortBy ?? "code",
    sortDir: options.sortDir ?? "ASC",
    filters: { companyId: options.companyId, code: normalizedCode || undefined },
  });
}

/**
 * Matches `NumberingSequencesService.format`: `${prefix ?? ''}${value.padStart(padding, '0')}`.
 * `value` stays a string throughout — never converted to a JS number.
 */
export function formatNumberingValue(prefix: string, padding: number, value: string): string {
  return `${prefix}${value.padStart(padding, "0")}`;
}

export function buildCreateNumberingRequest(
  values: NumberingFormValues,
): CreateNumberingSequenceRequest {
  const code = values.code.trim().toUpperCase();
  if (!NUMBERING_CODE_PATTERN.test(code)) throw new Error("NUMBERING_FORM_CODE");

  const request: CreateNumberingSequenceRequest = { code };
  const prefix = parsePrefix(values.prefix);
  if (prefix.length > 0) request.prefix = prefix;
  request.padding = parsePadding(values.padding);
  request.startValue = parseCounterValue(values.startValue);
  if (values.companyId !== null) {
    if (!isUuidV7(values.companyId)) throw new Error("NUMBERING_FORM_COMPANY");
    request.companyId = values.companyId;
  }
  return request;
}

export function buildUpdateNumberingRequest(
  current: NumberingSequence,
  values: NumberingFormValues,
): UpdateNumberingSequenceRequest {
  const request: UpdateNumberingSequenceRequest = {};
  const prefix = parsePrefix(values.prefix);
  if (prefix !== (current.prefix ?? "")) request.prefix = prefix;

  const padding = parsePadding(values.padding);
  if (padding !== current.padding) request.padding = padding;

  const next = values.startValue.trim();
  if (next !== current.nextValue) {
    if (!/^\d+$/u.test(next)) throw new Error("NUMBERING_FORM_VALUE");
    // String comparison first because the stored value may exceed MAX_SAFE_INTEGER.
    if (!isHigherOrEqualCounter(next, current.nextValue)) {
      throw new Error("NUMBERING_FORM_BACKWARD");
    }
    request.nextValue = parseCounterValue(next);
  }
  return request;
}

/** Typed padding, or `null` while outside the DTO's 1–12 bound. */
export function paddingOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,2}$/u.test(trimmed)) return null;
  const padding = Number(trimmed);
  return padding >= NUMBERING_PADDING_MIN && padding <= NUMBERING_PADDING_MAX ? padding : null;
}

export function isValidNumberingCode(value: string): boolean {
  return NUMBERING_CODE_PATTERN.test(value.trim().toUpperCase());
}

/** Normalized prefix (`""` clears), or `null` on whitespace-only/control/bidi/overflow input. */
export function normalizeNumberingPrefix(value: string): string | null {
  const prefix = value.trim() !== "" ? value.trim() : value;
  return [...prefix].length <= NUMBERING_PREFIX_MAX_LENGTH && NUMBERING_PREFIX_PATTERN.test(prefix) ? prefix : null;
}

export const MAX_SAFE_COUNTER_STRING = "9007199254740991";

/** `@IsInt() @Min(1)` — refuses counters beyond `Number.MAX_SAFE_INTEGER` rather than truncating. */
export function counterWriteOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/u.test(trimmed) || !isHigherOrEqualCounter(MAX_SAFE_COUNTER_STRING, trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}

/** Compares two unsigned integer strings without converting either to a number. */
export function isHigherOrEqualCounter(candidate: string, current: string): boolean {
  const left = candidate.replace(/^0+(?=\d)/u, "");
  const right = current.replace(/^0+(?=\d)/u, "");
  return left.length !== right.length ? left.length > right.length : left >= right;
}

export function parseNumberingSequencesResponse(envelope: { data: unknown; meta: unknown }): CorePage<NumberingSequence> {
  return parseCorePage(envelope, parseNumberingSequenceResponse);
}

export function parseNumberingSequenceResponse(payload: unknown): NumberingSequence {
  const sequence = record(payload);
  if (
    !sequence ||
    !isUuidV7(sequence.id) ||
    !isNonEmptyString(sequence.code, NUMBERING_CODE_MAX_LENGTH) ||
    !isBoundedInteger(sequence.padding, NUMBERING_PADDING_MIN, NUMBERING_PADDING_MAX) ||
    !isUnsignedIntegerString(sequence.nextValue) ||
    !isTimestamp(sequence.updatedAt) ||
    !isOptionalPrefix(sequence.prefix) ||
    !isNullableCompanyId(sequence.companyId)
  ) {
    invalidResponse();
  }

  return {
    id: sequence.id,
    code: sequence.code,
    prefix: (sequence.prefix as string | null | undefined) ?? null,
    padding: sequence.padding,
    nextValue: sequence.nextValue,
    companyId: (sequence.companyId as string | null | undefined) ?? null,
    updatedAt: sequence.updatedAt,
  };
}

export function parseNumberingPeekResponse(payload: unknown): NumberingPeek {
  const peek = record(payload);
  if (
    !peek ||
    !isNonEmptyString(peek.code, NUMBERING_CODE_MAX_LENGTH) ||
    !isUnsignedIntegerString(peek.nextValue) ||
    !isNonEmptyString(peek.formatted, 128) ||
    !isNullableCompanyId(peek.companyId)
  ) {
    invalidResponse();
  }
  return {
    code: peek.code,
    companyId: (peek.companyId as string | null | undefined) ?? null,
    nextValue: peek.nextValue,
    formatted: peek.formatted,
  };
}

function parseCounterValue(value: string): number {
  const parsed = counterWriteOrNull(value);
  if (parsed === null) throw new Error("NUMBERING_FORM_VALUE");
  return parsed;
}

function parsePadding(value: string): number {
  const padding = paddingOrNull(value);
  if (padding === null) throw new Error("NUMBERING_FORM_PADDING");
  return padding;
}

function parsePrefix(value: string): string {
  const prefix = normalizeNumberingPrefix(value);
  if (prefix === null) throw new Error("NUMBERING_FORM_PREFIX");
  return prefix;
}

function isOptionalPrefix(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && [...value].length <= NUMBERING_PREFIX_MAX_LENGTH)
  );
}

function isNullableCompanyId(value: unknown): boolean {
  return value === null || value === undefined || isUuidV7(value);
}

function invalidResponse(): never {
  throw new Error("Invalid Core numbering response.");
}
