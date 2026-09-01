import type { CorePath } from "@/lib/api/envelope";
import {
  isBoundedInteger,
  isNonEmptyString,
  isTimestamp,
  isUnsignedIntegerString,
  isUuidV7,
  parseCorePage,
  record,
  type CorePage,
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
  /**
   * A `bigint` column, serialised as a string, and it stays a string here.
   * A sequence can outrun `Number.MAX_SAFE_INTEGER`, so parsing it would
   * silently corrupt the value the user is looking at.
   */
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

/** The only sort fields GET /numbering-sequences accepts; else a 400. */
export const NUMBERING_SORT_FIELDS = ["code", "nextValue", "createdAt"] as const;
export type NumberingSortField = (typeof NUMBERING_SORT_FIELDS)[number];

export function numberingListPath(
  page: number,
  companyId: string | undefined,
  search: string,
  sortBy: NumberingSortField = "code",
  sortDir: "ASC" | "DESC" = "ASC",
): CorePath {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(NUMBERING_PAGE_SIZE),
    sortBy,
    sortDir,
  });
  if (companyId) query.set("companyId", companyId);
  if (search) query.set("search", search);
  return `${NUMBERING_PATH}?${query.toString()}` as CorePath;
}

/**
 * The exact rendering `NumberingSequencesService.format` performs:
 * `${prefix ?? ''}${value.padStart(padding, '0')}`.
 *
 * `value` stays a string throughout — this pads text, it never does
 * arithmetic on a bigint the browser cannot hold.
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
  const prefix = values.prefix;
  if (prefix.length > NUMBERING_PREFIX_MAX_LENGTH) throw new Error("NUMBERING_FORM_PREFIX");
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
  const prefix = values.prefix;
  if (prefix.length > NUMBERING_PREFIX_MAX_LENGTH) throw new Error("NUMBERING_FORM_PREFIX");
  if (prefix !== (current.prefix ?? "")) request.prefix = prefix;

  const padding = parsePadding(values.padding);
  if (padding !== current.padding) request.padding = padding;

  const next = values.startValue.trim();
  if (next !== current.nextValue) {
    // String comparison first, because the stored value may exceed what a JS
    // number can hold — only a value the DTO can actually carry is sent.
    if (!isHigherOrEqualCounter(next, current.nextValue)) {
      throw new Error("NUMBERING_FORM_BACKWARD");
    }
    request.nextValue = parseCounterValue(next);
  }
  return request;
}

/**
 * The typed padding, or `null` while it is not yet a value the DTO accepts.
 *
 * The live preview needs the same bound the request builder enforces, so both
 * read it from here rather than each restating 1–12.
 */
export function paddingOrNull(value: string): number | null {
  try {
    return parsePadding(value);
  } catch {
    return null;
  }
}

/** Compares two unsigned integer strings without converting either to a number. */
export function isHigherOrEqualCounter(candidate: string, current: string): boolean {
  const left = candidate.replace(/^0+(?=\d)/u, "");
  const right = current.replace(/^0+(?=\d)/u, "");
  if (left.length !== right.length) return left.length > right.length;
  return left >= right;
}

export function parseNumberingSequencesResponse(payload: unknown): CorePage<NumberingSequence> {
  return parseCorePage(payload, parseNumberingSequenceResponse, invalidResponse);
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

/**
 * `@IsInt() @Min(1)` — the DTO carries a JSON number, so a counter beyond
 * `Number.MAX_SAFE_INTEGER` cannot be expressed on the wire at all. Refusing
 * it here is honest; silently truncating it would not be.
 */
function parseCounterValue(value: string): number {
  const trimmed = value.trim();
  if (!/^\d{1,16}$/u.test(trimmed)) throw new Error("NUMBERING_FORM_VALUE");
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error("NUMBERING_FORM_VALUE");
  return parsed;
}

function parsePadding(value: string): number {
  const trimmed = value.trim();
  if (!/^\d{1,2}$/u.test(trimmed)) throw new Error("NUMBERING_FORM_PADDING");
  const padding = Number(trimmed);
  if (padding < NUMBERING_PADDING_MIN || padding > NUMBERING_PADDING_MAX) {
    throw new Error("NUMBERING_FORM_PADDING");
  }
  return padding;
}

function isOptionalPrefix(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.length <= NUMBERING_PREFIX_MAX_LENGTH)
  );
}

function isNullableCompanyId(value: unknown): boolean {
  return value === null || value === undefined || isUuidV7(value);
}

function invalidResponse(): never {
  throw new Error("Invalid Core numbering response.");
}
