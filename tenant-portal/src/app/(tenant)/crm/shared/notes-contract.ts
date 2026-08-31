// CRM notes — MASTER-PLAN 8.24.
//
// Routes (docs/api/crm-reference.md, Gateway-verified):
//   GET    /api/tenant/crm/v1/notes      ?branchId&sourceType&sourceId&page&limit
//   POST   /api/tenant/crm/v1/notes
//   PATCH  /api/tenant/crm/v1/notes/:id
//   DELETE /api/tenant/crm/v1/notes/:id   -> 204, no body
//
// DTOs verified against
// crm-app/src/crm/notes-attachments/dto/notes-attachments.dto.ts:
//   CreateNoteDto { branchId, sourceType, sourceId, body }   body 1..20000
//   UpdateNoteDto { body }                                    body 1..20000
// `forbidNonWhitelisted` is on, so those four keys are the whole payload.
//
// The response row is `CrmNoteEntity`, returned raw — no envelope, no
// projection (`notes-attachments.service.ts` returns the repository result).
// Its columns are id / createdAt / updatedAt / deletedAt from BaseTenantEntity
// plus branchId, sourceType, sourceId, body, createdByUserId.

import { isUUIDv7 } from "@/lib/uuid";
import { crmRecord } from "./crm-capabilities";

export const CRM_NOTES_PATH = "/api/tenant/crm/v1/notes";
export const CRM_NOTE_BODY_MAX_LENGTH = 20_000;

/**
 * `CrmNoteSourceTypeDto`. **`NOTE` is deliberately absent** — a note cannot
 * hang off a note, though an attachment can. The two enums differ by exactly
 * that member.
 */
export const CRM_NOTE_SOURCE_TYPES = [
  "LEAD",
  "CUSTOMER_PROFILE",
  "PARTY",
  "OPPORTUNITY",
  "ACTIVITY",
] as const;

export type CrmNoteSourceType = (typeof CRM_NOTE_SOURCE_TYPES)[number];

export interface CrmNote {
  id: string;
  branchId: string;
  sourceType: CrmNoteSourceType;
  sourceId: string;
  body: string;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmNotesPage {
  items: CrmNote[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

function invalid(): never {
  throw new Error("Invalid CRM notes response.");
}

function requiredIsoTimestamp(value: unknown): string {
  if (typeof value !== "string" || Number.isNaN(new Date(value).getTime())) {
    invalid();
  }
  return value;
}

export function parseCrmNote(payload: unknown): CrmNote {
  const note = crmRecord(payload);
  if (
    !note ||
    !isUUIDv7(note.id) ||
    !isUUIDv7(note.branchId) ||
    !isUUIDv7(note.sourceId) ||
    !CRM_NOTE_SOURCE_TYPES.includes(note.sourceType as CrmNoteSourceType) ||
    typeof note.body !== "string" ||
    note.body.length === 0 ||
    note.body.length > CRM_NOTE_BODY_MAX_LENGTH ||
    (note.createdByUserId !== null &&
      note.createdByUserId !== undefined &&
      !isUUIDv7(note.createdByUserId))
  ) {
    invalid();
  }
  return {
    id: note.id,
    branchId: note.branchId,
    sourceType: note.sourceType as CrmNoteSourceType,
    sourceId: note.sourceId,
    body: note.body,
    createdByUserId: isUUIDv7(note.createdByUserId) ? note.createdByUserId : null,
    createdAt: requiredIsoTimestamp(note.createdAt),
    updatedAt: requiredIsoTimestamp(note.updatedAt),
  };
}

export function parseCrmNotesPageResponse(
  payload: unknown,
  expected: { branchId: string; sourceType: CrmNoteSourceType; sourceId: string },
): CrmNotesPage {
  const page = crmRecord(payload);
  if (
    !page ||
    !Array.isArray(page.items) ||
    !Number.isSafeInteger(page.total) ||
    !Number.isSafeInteger(page.page) ||
    !Number.isSafeInteger(page.limit) ||
    !Number.isSafeInteger(page.totalPages) ||
    typeof page.hasNext !== "boolean" ||
    typeof page.hasPrev !== "boolean"
  ) {
    invalid();
  }
  const items = page.items.map(parseCrmNote);
  // A note for another record reaching this list would render under the wrong
  // heading, so the filter the request asked for is re-checked on the way back.
  if (
    items.some(
      (note) =>
        note.branchId !== expected.branchId ||
        note.sourceType !== expected.sourceType ||
        note.sourceId !== expected.sourceId,
    )
  ) {
    invalid();
  }
  const limit = page.limit as number;
  if (limit < 1 || items.length > limit) invalid();
  return {
    items,
    total: page.total as number,
    page: page.page as number,
    limit,
    totalPages: page.totalPages as number,
    hasNext: page.hasNext,
    hasPrev: page.hasPrev,
  };
}

export function buildCrmNotesListPath(query: {
  branchId: string;
  sourceType: CrmNoteSourceType;
  sourceId: string;
  page: number;
  limit: number;
}): string {
  const search = new URLSearchParams({
    branchId: query.branchId,
    sourceType: query.sourceType,
    sourceId: query.sourceId,
    page: String(query.page),
    limit: String(query.limit),
  });
  return `${CRM_NOTES_PATH}?${search.toString()}`;
}

export function crmNotePath(id: string): string {
  if (!isUUIDv7(id)) throw new Error("Invalid CRM note id.");
  return `${CRM_NOTES_PATH}/${encodeURIComponent(id)}`;
}

export interface CreateCrmNoteRequest {
  branchId: string;
  sourceType: CrmNoteSourceType;
  sourceId: string;
  body: string;
}

export function buildCreateCrmNoteRequest(input: {
  branchId: string;
  sourceType: CrmNoteSourceType;
  sourceId: string;
  body: string;
}): CreateCrmNoteRequest {
  return {
    branchId: input.branchId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    body: requireNoteBody(input.body),
  };
}

export function buildUpdateCrmNoteRequest(body: string): { body: string } {
  return { body: requireNoteBody(body) };
}

/**
 * `@IsNotEmpty()` runs on the trimmed-by-nobody value the client sends, so a
 * body of only whitespace is a 422. Trimming here keeps that impossible.
 */
function requireNoteBody(value: string): string {
  const body = value.trim();
  if (body.length === 0 || body.length > CRM_NOTE_BODY_MAX_LENGTH) {
    throw new Error("A CRM note body must be 1-20000 characters.");
  }
  return body;
}
