// CRM's tag vocabulary — the one contract every CRM screen reads a tag through.
//
//   GET    /api/tenant/crm/v1/tags        raw, name-sorted array    crm.tags.read
//   POST   /api/tenant/crm/v1/tags        { name, backgroundColor?, textColor? }
//   GET    /api/tenant/crm/v1/tags/:id
//   PATCH  /api/tenant/crm/v1/tags/:id    { name?, backgroundColor?, textColor? }
//   DELETE /api/tenant/crm/v1/tags/:id    204                       crm.tags.manage
//
// Verified against crm-app/src/crm/tags/tags.controller.ts and dto/tag.dto.ts
// on 2026-09-24. CRM does not wrap bodies in `data`.
//
// The same `{ id, name, backgroundColor, textColor }` summary is embedded in
// the lead, customer-profile and opportunity read models and returned by each
// record's `/:id/tags` route, so one parser serves all of them.

import { toTagColor, type TagColor } from "@/design-system";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { isUUIDv7 } from "@/lib/uuid";

export const CRM_TAGS_PATH = "/api/tenant/crm/v1/tags";

export function crmTagPath(id: string): string {
  return `${CRM_TAGS_PATH}/${encodeURIComponent(id)}`;
}

// CreateTagDto/UpdateTagDto `@MaxLength(60)`, which counts code points.
export const CRM_TAG_NAME_MAX_LENGTH = 60;
// crm-app/src/crm/tags/tags.service.ts — live tag ceiling per tenant.
const CRM_TAG_CATALOGUE_LIMIT = 500;

export interface CrmTag {
  id: string;
  name: string;
  /** Upper-case `#RRGGBB`, or `null` for an uncoloured tag. Set together with `textColor`. */
  backgroundColor: string | null;
  textColor: string | null;
}

export interface CrmTagCatalogueItem extends CrmTag {
  createdAt: string;
  updatedAt: string;
}

const INVALID_TAGS = "Invalid CRM tags response.";

function invalid(message: string = INVALID_TAGS): never {
  throw new Error(message);
}

function record(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid(message);
  return value as Record<string, unknown>;
}

/**
 * One tag. The id and name are the contract and throw when wrong; the colour
 * is cosmetic and degrades — a missing, half-set or malformed pair is read as
 * an uncoloured tag rather than taking the whole record down with it.
 */
function parseCrmTag(value: unknown, message: string): CrmTag {
  const tag = record(value, message);
  if (!isUUIDv7(tag.id)) invalid(message);
  if (typeof tag.name !== "string" || tag.name.trim().length === 0) invalid(message);
  const color = toTagColor(tag.backgroundColor, tag.textColor);
  return {
    id: tag.id,
    name: tag.name,
    backgroundColor: color?.backgroundColor ?? null,
    textColor: color?.textColor ?? null,
  };
}

function assertUniqueIds(tags: readonly CrmTag[], message: string): void {
  if (new Set(tags.map(({ id }) => id.toLowerCase())).size !== tags.length) invalid(message);
}

/**
 * A record's embedded tags, in the order the server sent them.
 *
 * Absent and `null` are both "no tags" — a crm-app that does not project the
 * field yet, or a record nobody has tagged. Anything else that is not an array
 * of well-formed tags throws — with the embedding response's own message, so
 * a bad tag fails exactly as the lead, profile or opportunity carrying it.
 */
export function parseCrmTags(value: unknown, invalidMessage: string = INVALID_TAGS): CrmTag[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > CRM_TAG_CATALOGUE_LIMIT) invalid(invalidMessage);
  const tags = value.map((entry) => parseCrmTag(entry, invalidMessage));
  assertUniqueIds(tags, invalidMessage);
  return tags;
}

export function parseCrmTagCatalogueItem(value: unknown): CrmTagCatalogueItem {
  const tag = parseCrmTag(value, INVALID_TAGS);
  // class-validator and varchar count Unicode code points, not UTF-16 units.
  if ([...tag.name].length > CRM_TAG_NAME_MAX_LENGTH) invalid();
  const { createdAt, updatedAt } = record(value, INVALID_TAGS);
  if (typeof createdAt !== "string" || typeof updatedAt !== "string") invalid();
  return { ...tag, createdAt, updatedAt };
}

/** `GET /tags` — the tenant-wide catalogue: a raw array, never an envelope. */
export function parseCrmTagCatalogue(payload: unknown): CrmTagCatalogueItem[] {
  if (!Array.isArray(payload) || payload.length > CRM_TAG_CATALOGUE_LIMIT) invalid();
  const tags = payload.map(parseCrmTagCatalogueItem);
  assertUniqueIds(tags, INVALID_TAGS);
  return tags;
}

/** The pair a tag carries, for a picker or a chip, or `null` when uncoloured. */
export function crmTagColor(tag: Pick<CrmTag, "backgroundColor" | "textColor">): TagColor | null {
  return toTagColor(tag.backgroundColor, tag.textColor);
}

export interface CreateCrmTagBody {
  name: string;
  backgroundColor?: string;
  textColor?: string;
}

/** `POST /tags` — both colours or neither; the DTO rejects unknown keys. */
export function buildCreateCrmTagBody(name: string, color: TagColor | null): CreateCrmTagBody {
  const body: CreateCrmTagBody = { name: name.trim() };
  if (color) {
    body.backgroundColor = color.backgroundColor;
    body.textColor = color.textColor;
  }
  return body;
}

export interface UpdateCrmTagBody {
  name?: string;
  backgroundColor?: string | null;
  textColor?: string | null;
}

/**
 * `PATCH /tags/:id` carrying only what changed, or `null` when nothing did —
 * an empty body is `422 CRM_TAG_UPDATE_EMPTY`, so it is never sent. The colours
 * always travel as a pair: `null` for both clears the colour, and a half-set
 * pair is `422 CRM_TAG_COLOR_INCOMPLETE`.
 */
export function buildUpdateCrmTagBody(
  original: CrmTag,
  name: string,
  color: TagColor | null,
): UpdateCrmTagBody | null {
  const body: UpdateCrmTagBody = {};
  const trimmed = name.trim();
  if (trimmed !== original.name) body.name = trimmed;
  const before = crmTagColor(original);
  const changed =
    before?.backgroundColor !== color?.backgroundColor || before?.textColor !== color?.textColor;
  if (changed) {
    body.backgroundColor = color?.backgroundColor ?? null;
    body.textColor = color?.textColor ?? null;
  }
  return Object.keys(body).length > 0 ? body : null;
}

/** The documented tag error codes — docs/api/crm-catalogues.md#tags. */
type CrmTagErrorCode =
  | "CRM_TAG_NAME_TAKEN"
  | "CRM_TAG_LIMIT_EXCEEDED"
  | "CRM_TAG_COLOR_INCOMPLETE"
  | "CRM_TAG_UPDATE_EMPTY"
  | "CRM_TAG_NOT_FOUND";

const CRM_TAG_ERROR_CODES: readonly CrmTagErrorCode[] = [
  "CRM_TAG_NAME_TAKEN",
  "CRM_TAG_LIMIT_EXCEEDED",
  "CRM_TAG_COLOR_INCOMPLETE",
  "CRM_TAG_UPDATE_EMPTY",
  "CRM_TAG_NOT_FOUND",
];

export interface CrmTagError {
  status: number;
  code: CrmTagErrorCode | null;
}

/**
 * What a failed tag write answered, or `null` when it never reached a
 * definite answer (network failure) — a caller treats that as uncertain.
 *
 * Reads the transport's `TenantApiClientError` and, for the tests that stub
 * the client, any object of the same `response` shape.
 */
export function readCrmTagError(error: unknown): CrmTagError | null {
  const response =
    error instanceof TenantApiClientError
      ? error.response
      : typeof error === "object" && error !== null && "response" in error
        ? (error as { response?: { status?: unknown; data?: unknown } }).response
        : undefined;
  if (!response || typeof response.status !== "number") return null;
  const data = typeof response.data === "object" && response.data !== null ? (response.data as Record<string, unknown>) : {};
  const code = CRM_TAG_ERROR_CODES.find((candidate) => candidate === data.errorCode) ?? null;
  return { status: response.status, code };
}

export interface CrmTagErrorMessages {
  nameTaken: string;
  limitExceeded: string;
  colorIncomplete: string;
  updateEmpty: string;
  notFound: string;
  forbidden: string;
  saveFailed: string;
}

/** One message per documented outcome; the code decides before the status. */
export function crmTagErrorMessage(error: CrmTagError, messages: CrmTagErrorMessages): string {
  switch (error.code) {
    case "CRM_TAG_NAME_TAKEN":
      return messages.nameTaken;
    case "CRM_TAG_LIMIT_EXCEEDED":
      return messages.limitExceeded;
    case "CRM_TAG_COLOR_INCOMPLETE":
      return messages.colorIncomplete;
    case "CRM_TAG_UPDATE_EMPTY":
      return messages.updateEmpty;
    case "CRM_TAG_NOT_FOUND":
      return messages.notFound;
    default:
      if (error.status === 409) return messages.nameTaken;
      if (error.status === 403) return messages.forbidden;
      if (error.status === 404) return messages.notFound;
      return messages.saveFailed;
  }
}
