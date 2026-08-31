// CRM attachments — MASTER-PLAN 8.25.
//
// Routes (docs/api/crm-reference.md, Gateway-verified):
//   GET    /api/tenant/crm/v1/attachments  ?branchId&sourceType&sourceId&page&limit
//   POST   /api/tenant/crm/v1/attachments/upload   multipart/form-data
//   GET    /api/tenant/crm/v1/attachments/:id/download
//   DELETE /api/tenant/crm/v1/attachments/:id      -> 204, no body
//
// `POST /attachments` (metadata for an already-stored object) is deliberately
// not called: it needs a `storageKey` the browser has no way to obtain, since
// nothing client-side ever writes to tenant storage. `/attachments/upload` is
// the browser's route.

import { isUUIDv7 } from "@/lib/uuid";
import { crmRecord } from "./crm-capabilities";

export const CRM_ATTACHMENTS_PATH = "/api/tenant/crm/v1/attachments";

/**
 * The per-file cap, in bytes.
 *
 * **25 MiB, not 26.** Source:
 * `shared-libs/packages/storage/src/constants/buckets.constant.ts`,
 * `MAX_SIZE_BYTES[BUCKETS.ATTACHMENTS] = 25 * MB` where `MB = 1024 * 1024`.
 * crm-app enforces it twice — multer's `limits.fileSize` and an explicit
 * `PayloadTooLargeException` in `NotesAttachmentsController` — and its own
 * message calls it "25 MB".
 *
 * MASTER-PLAN 8.25 and 1.7 both say "26 MiB". That number is real but belongs
 * to a **different** limit: the Gateway's whole-body ceiling for this one path
 * is `MAX_ATTACHMENT_BODY_BYTES`, default 27_262_976 = 26 MiB
 * (`api-gateway-app/src/config/app.config.ts`), which is the file plus the
 * multipart envelope. Enforcing 26 MiB on the file would admit a file the
 * Gateway accepts and crm-app then rejects with 413.
 */
export const CRM_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

/**
 * `ALLOWED_MIME[BUCKETS.ATTACHMENTS]`, exact and in source order.
 *
 * The backend compares the declared MIME **exactly**, so an allowlist that
 * differs by one entry either blocks a file the server would take or waves
 * through one it rejects with 415.
 */
export const CRM_ATTACHMENT_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
  "text/plain",
] as const;

/** `CrmAttachmentSourceTypeDto` — this one **does** include `NOTE`. */
export const CRM_ATTACHMENT_SOURCE_TYPES = [
  "LEAD",
  "CUSTOMER_PROFILE",
  "PARTY",
  "OPPORTUNITY",
  "ACTIVITY",
  "NOTE",
] as const;

export type CrmAttachmentSourceType =
  (typeof CRM_ATTACHMENT_SOURCE_TYPES)[number];

export interface CrmAttachment {
  id: string;
  branchId: string;
  sourceType: CrmAttachmentSourceType;
  sourceId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: string | null;
  createdAt: string;
}

export interface CrmAttachmentsPage {
  items: CrmAttachment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * The three upload failures, kept apart on purpose.
 *
 * They need three different sentences: "you did not pick a file", "that kind of
 * file is not accepted here", and "that file is too big". One shared message
 * leaves the user guessing which of the three they hit.
 *
 * Codes copied from `NotesAttachmentsController.requireAttachmentUpload` and
 * its multer `fileFilter`, plus the Gateway's own body ceiling for this path.
 */
export type CrmAttachmentUploadFailure =
  | "missingFile"
  | "wrongType"
  | "tooLarge"
  | "other";

const MISSING_FILE_CODES = [
  "CRM_ATTACHMENT_FILE_REQUIRED",
  "CRM_ATTACHMENT_FILE_EMPTY",
];
const WRONG_TYPE_CODES = ["CRM_ATTACHMENT_FILE_TYPE_UNSUPPORTED"];
const TOO_LARGE_CODES = ["CRM_ATTACHMENT_FILE_TOO_LARGE", "GW.BODY.TOO_LARGE"];

export function classifyAttachmentUploadFailure(error: {
  status: number;
  code?: string;
}): CrmAttachmentUploadFailure {
  const code = error.code ?? "";
  if (MISSING_FILE_CODES.includes(code)) return "missingFile";
  if (WRONG_TYPE_CODES.includes(code)) return "wrongType";
  if (TOO_LARGE_CODES.includes(code)) return "tooLarge";
  // Status is the fallback so a Problem Details body that lost its `code` in
  // transit still lands on the right sentence. 415 and 413 mean only one thing
  // on this route each; 400 does not, so it is deliberately not mapped here.
  if (error.status === 415) return "wrongType";
  if (error.status === 413) return "tooLarge";
  return "other";
}

function invalid(): never {
  throw new Error("Invalid CRM attachments response.");
}

export function parseCrmAttachment(payload: unknown): CrmAttachment {
  const attachment = crmRecord(payload);
  if (
    !attachment ||
    !isUUIDv7(attachment.id) ||
    !isUUIDv7(attachment.branchId) ||
    !isUUIDv7(attachment.sourceId) ||
    !CRM_ATTACHMENT_SOURCE_TYPES.includes(
      attachment.sourceType as CrmAttachmentSourceType,
    ) ||
    typeof attachment.fileName !== "string" ||
    attachment.fileName.length === 0 ||
    attachment.fileName.length > 180 ||
    typeof attachment.mimeType !== "string" ||
    attachment.mimeType.length === 0 ||
    attachment.mimeType.length > 120 ||
    !Number.isSafeInteger(attachment.sizeBytes) ||
    (attachment.sizeBytes as number) < 1 ||
    (attachment.sizeBytes as number) > CRM_ATTACHMENT_MAX_BYTES ||
    typeof attachment.createdAt !== "string" ||
    Number.isNaN(new Date(attachment.createdAt).getTime())
  ) {
    invalid();
  }
  return {
    id: attachment.id,
    branchId: attachment.branchId,
    sourceType: attachment.sourceType as CrmAttachmentSourceType,
    sourceId: attachment.sourceId,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes as number,
    uploadedByUserId: isUUIDv7(attachment.uploadedByUserId)
      ? attachment.uploadedByUserId
      : null,
    createdAt: attachment.createdAt,
  };
}

export function parseCrmAttachmentsPageResponse(
  payload: unknown,
  expected: {
    branchId: string;
    sourceType: CrmAttachmentSourceType;
    sourceId: string;
  },
): CrmAttachmentsPage {
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
  const items = page.items.map(parseCrmAttachment);
  if (
    items.some(
      (attachment) =>
        attachment.branchId !== expected.branchId ||
        attachment.sourceType !== expected.sourceType ||
        attachment.sourceId !== expected.sourceId,
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

export function buildCrmAttachmentsListPath(query: {
  branchId: string;
  sourceType: CrmAttachmentSourceType;
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
  return `${CRM_ATTACHMENTS_PATH}?${search.toString()}`;
}

export function crmAttachmentPath(id: string): string {
  if (!isUUIDv7(id)) throw new Error("Invalid CRM attachment id.");
  return `${CRM_ATTACHMENTS_PATH}/${encodeURIComponent(id)}`;
}

/**
 * The download URL, for an anchor rather than a transport call.
 *
 * The route streams bytes with `Content-Disposition: attachment`, and the one
 * `fetch` in this app reads every response as **text** before parsing
 * (`axiosClient.readResponsePayload`), which would corrupt a binary body.
 * A same-origin navigation carries the session cookies and hands the stream
 * straight to the browser's own download path.
 */
export function crmAttachmentDownloadPath(id: string): string {
  return `${crmAttachmentPath(id)}/download`;
}

/**
 * The multipart body for `POST /attachments/upload`.
 *
 * Field names are fixed by the controller: the file part is `file`
 * (`FileInterceptor('file')`) and the rest is `UploadAttachmentDto`.
 */
export function buildCrmAttachmentUploadBody(input: {
  file: File;
  branchId: string;
  sourceType: CrmAttachmentSourceType;
  sourceId: string;
}): FormData {
  const form = new FormData();
  form.append("file", input.file);
  form.append("branchId", input.branchId);
  form.append("sourceType", input.sourceType);
  form.append("sourceId", input.sourceId);
  return form;
}
