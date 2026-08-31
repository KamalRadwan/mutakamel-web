// Wire contract for dashboard and widget sharing.
//
// One module for both because crm-app implements them with one service and one
// SQL shape — `DashboardSharesService`, `SHARE_CONFIG` — differing only in the
// table and the audit action. Source: dashboard-shares.service.ts,
// dashboard-access.service.ts (`shareTargets`, `validateShareTarget`) and
// `ShareResourceDto` / `DashboardShareTargetsQueryDto`.

import { isUUIDv7 } from "@/lib/uuid";
import {
  boundedArray,
  finiteNumber,
  invalidResponse,
  nonEmptyString,
  optionalString,
  record,
  timestamp,
} from "./dashboard-parse";
import { encodeId } from "./widget-contract";

const SHARE_SUBJECT_TYPES = ["USER", "TEAM"] as const;
export type ShareSubjectType = (typeof SHARE_SUBJECT_TYPES)[number];

export const SHARE_ACCESS_LEVELS = ["VIEW", "EDIT"] as const;
export type ShareAccessLevel = (typeof SHARE_ACCESS_LEVELS)[number];

/** `@Max(100)` on `limit`, `@Max(10000)` on `offset`. */
const SHARE_TARGET_PAGE_SIZE = 25;
const SHARE_TARGET_SEARCH_MAX_LENGTH = 80;
const MAX_SHARES_IN_RESPONSE = 500;

export interface ShareRecord {
  id: string;
  subjectType: ShareSubjectType;
  subjectId: string;
  accessLevel: ShareAccessLevel;
  sharedByUserId: string | null;
  expiresAt: string | null;
  createdAt: string;
  /** List-only projection; `POST /:id/shares` does not return these. */
  subjectName: string | null;
  subjectEmail: string | null;
  context: string | null;
}

export interface ShareTarget {
  id: string;
  type: ShareSubjectType;
  name: string;
  /** Users only. */
  email: string | null;
  /** Teams only. */
  code: string | null;
}

export interface ShareTargetPage {
  items: ShareTarget[];
  /**
   * Present only when a category filled its page. The server pages **users and
   * teams with the same offset**, so a next page can return one category only.
   */
  nextOffset: number | null;
}

export function shareTargetsQuery(search: string, offset: number): string {
  const parameters = new URLSearchParams({
    limit: String(SHARE_TARGET_PAGE_SIZE),
    offset: String(offset),
  });
  const trimmed = search.trim().slice(0, SHARE_TARGET_SEARCH_MAX_LENGTH);
  if (trimmed.length > 0) parameters.set("search", trimmed);
  return `?${parameters.toString()}`;
}

export function resourceSharesPath(resourcePath: string): string {
  return `${resourcePath}/shares`;
}

export function resourceSharePath(resourcePath: string, shareId: string): string {
  return `${resourcePath}/shares/${encodeId(shareId)}`;
}

/**
 * `ShareResourceDto`.
 *
 * `expiresAt` is omitted when empty rather than sent as `null`: it is
 * `@IsOptional() @IsDateString()`, and a past instant is a
 * `422 CRM_SHARE_EXPIRY_INVALID`.
 */
export function buildShareRequest(input: {
  subjectType: ShareSubjectType;
  subjectId: string;
  accessLevel: ShareAccessLevel;
  expiresAt: string;
}): Record<string, unknown> {
  if (!isUUIDv7(input.subjectId)) throw new Error("CRM_SHARE_TARGET_INVALID");
  const body: Record<string, unknown> = {
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    accessLevel: input.accessLevel,
  };
  const expiresAt = input.expiresAt.trim();
  if (expiresAt.length > 0) {
    const parsed = new Date(expiresAt);
    if (!Number.isFinite(parsed.getTime())) throw new Error("CRM_SHARE_EXPIRY_INVALID");
    body.expiresAt = parsed.toISOString();
  }
  return body;
}

export function parseSharesResponse(payload: unknown): ShareRecord[] {
  if (!boundedArray(payload, MAX_SHARES_IN_RESPONSE)) invalidResponse("shares");
  return payload.map(parseShareRecord);
}

function parseShareRecord(payload: unknown): ShareRecord {
  const source = record(payload);
  if (
    !source ||
    !isUUIDv7(source.id) ||
    !isSubjectType(source.subjectType) ||
    !isUUIDv7(source.subjectId) ||
    !isAccessLevel(source.accessLevel) ||
    !timestamp(source.createdAt)
  ) {
    invalidResponse("share");
  }
  return {
    id: source.id,
    subjectType: source.subjectType,
    subjectId: source.subjectId,
    accessLevel: source.accessLevel,
    sharedByUserId: isUUIDv7(source.sharedByUserId) ? source.sharedByUserId : null,
    expiresAt: timestamp(source.expiresAt) ? source.expiresAt : null,
    createdAt: source.createdAt,
    subjectName: optionalString(source.subjectName),
    subjectEmail: optionalString(source.subjectEmail),
    context: optionalString(source.context),
  };
}

export function parseShareTargetsResponse(payload: unknown): ShareTargetPage {
  const source = record(payload);
  if (!source || !boundedArray(source.items, SHARE_TARGET_PAGE_SIZE * 2)) {
    invalidResponse("share targets");
  }
  return {
    items: source.items.flatMap((entry) => {
      const row = record(entry);
      if (!row || !isUUIDv7(row.id) || !isSubjectType(row.type)) return [];
      const name = typeof row.name === "string" ? row.name.trim() : "";
      const email = optionalString(row.email);
      return [{
        id: row.id,
        type: row.type,
        // `CONCAT_WS` yields "" for a user with no names; the email — or, for a
        // team, the code — is then the only identifier the row carries.
        name: nonEmptyString(name) ? name : (email ?? optionalString(row.code) ?? row.id),
        email,
        code: optionalString(row.code),
      }];
    }),
    nextOffset: finiteNumber(source.nextOffset) ? source.nextOffset : null,
  };
}

function isSubjectType(value: unknown): value is ShareSubjectType {
  return SHARE_SUBJECT_TYPES.includes(value as ShareSubjectType);
}

function isAccessLevel(value: unknown): value is ShareAccessLevel {
  return SHARE_ACCESS_LEVELS.includes(value as ShareAccessLevel);
}
