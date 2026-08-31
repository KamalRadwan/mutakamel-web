// Opportunity detail, stage history, create, edit and pipeline transfer —
// MASTER-PLAN 8.10-8.12.
//
//   GET  /api/tenant/crm/v1/opportunities/:id                200
//   GET  /api/tenant/crm/v1/opportunities/:id/stage-history  200, a plain array
//   POST /api/tenant/crm/v1/opportunities                    201
//   PATCH /api/tenant/crm/v1/opportunities/:id               200
//   PUT  /api/tenant/crm/v1/opportunities/:id/pipeline       200
//
// `GET /:id` returns the raw `OpportunityEntity` — `OpportunitiesService
// .findOne` hands the row straight back, with **no** read-model projection. So
// it carries none of the board's derived fields: no `activityState`, no
// `nextOpenActivityAt`, no customer or owner display name. Reading one of those
// here would be reading a field that does not exist on this route.
//
// `amount` is a **decimal string** on the way out (`amount?: string | null`)
// and a **number** on the way in (`@IsNumber({ maxDecimalPlaces: 2 })`). That
// asymmetry is the contract, not a mistake, and it is why the outbound builder
// converts once behind a bounded guard while nothing ever converts the
// inbound value.

import { isUUIDv7 } from "@/lib/uuid";
import type { OpportunityStatus, StageFlag } from "./hooks/pipeline-types";

export const OPPORTUNITIES_PATH = "/api/tenant/crm/v1/opportunities";

const OPPORTUNITY_STATUSES: readonly OpportunityStatus[] = [
  "IN_PROGRESS",
  "ON_HOLD",
  "WON",
  "LOST",
];

const STAGE_FLAGS: readonly StageFlag[] = [
  "NEW",
  "DISCOVERY",
  "QUALIFICATION",
  "PROPOSAL",
  "NEGOTIATION",
  "CONTRACTING",
  "ON_HOLD",
  "WON",
  "LOST",
];

/** A decimal string with no exponent — never converted, only rendered. */
const DECIMAL = /^-?\d+(\.\d+)?$/;

export interface OpportunityDetail {
  id: string;
  branchId: string;
  customerProfileId: string;
  customerPartyId: string | null;
  contactPartyId: string | null;
  leadId: string | null;
  pipelineId: string;
  stageId: string;
  stageFlag: StageFlag | null;
  status: OpportunityStatus;
  title: string;
  importance: number;
  /** Exact decimal string. Rendered through `Money`; never `Number()`d. */
  amount: string | null;
  currencyCode: string | null;
  description: string | null;
  expectedCloseDate: string | null;
  probabilityPercent: number | null;
  ownerUserId: string | null;
  wonAt: string | null;
  lostAt: string | null;
  lostReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityStageSnapshot {
  pipelineNameAr: string | null;
  pipelineNameEn: string | null;
  stageNameAr: string | null;
  stageNameEn: string | null;
  flag: StageFlag | null;
}

export interface OpportunityStageHistoryEntry {
  id: string;
  fromStatus: OpportunityStatus | null;
  toStatus: OpportunityStatus | null;
  changedAt: string | null;
  changedByUserId: string | null;
  reason: string | null;
  fromStageSnapshot: OpportunityStageSnapshot | null;
  toStageSnapshot: OpportunityStageSnapshot | null;
}

function invalid(): never {
  throw new Error("Invalid opportunity response.");
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableUuid(value: unknown): string | null {
  return isUUIDv7(value) ? value : null;
}

function isMember<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function nullableDecimal(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !DECIMAL.test(value)) invalid();
  return value;
}

function boundedInteger(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value)) invalid();
  const parsed = value as number;
  if (parsed < min || parsed > max) invalid();
  return parsed;
}

export function parseOpportunityDetailResponse(
  payload: unknown,
): OpportunityDetail {
  const item = record(payload);
  if (
    !item ||
    !isUUIDv7(item.id) ||
    !isUUIDv7(item.branchId) ||
    !isUUIDv7(item.customerProfileId) ||
    !isUUIDv7(item.pipelineId) ||
    !isUUIDv7(item.stageId) ||
    !isMember(OPPORTUNITY_STATUSES, item.status) ||
    typeof item.title !== "string" ||
    item.title.length === 0 ||
    typeof item.createdAt !== "string" ||
    typeof item.updatedAt !== "string"
  ) {
    invalid();
  }
  const importance = boundedInteger(item.importance, 0, 3);
  if (importance === null) invalid();

  return {
    id: item.id,
    branchId: item.branchId,
    customerProfileId: item.customerProfileId,
    customerPartyId: nullableUuid(item.customerPartyId),
    contactPartyId: nullableUuid(item.contactPartyId),
    leadId: nullableUuid(item.leadId),
    pipelineId: item.pipelineId,
    stageId: item.stageId,
    stageFlag: isMember(STAGE_FLAGS, item.stageFlag) ? item.stageFlag : null,
    status: item.status,
    title: item.title,
    importance,
    amount: nullableDecimal(item.amount),
    currencyCode: nullableText(item.currencyCode),
    description: nullableText(item.description),
    expectedCloseDate: nullableText(item.expectedCloseDate),
    probabilityPercent: boundedInteger(item.probabilityPercent, 0, 100),
    ownerUserId: nullableUuid(item.ownerUserId),
    wonAt: nullableText(item.wonAt),
    lostAt: nullableText(item.lostAt),
    lostReason: nullableText(item.lostReason),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

const MAX_STAGE_HISTORY_ROWS = 500;

function parseStageSnapshot(value: unknown): OpportunityStageSnapshot | null {
  const snapshot = record(value);
  if (!snapshot) return null;
  return {
    pipelineNameAr: nullableText(snapshot.pipelineNameAr),
    pipelineNameEn: nullableText(snapshot.pipelineNameEn),
    stageNameAr: nullableText(snapshot.stageNameAr),
    stageNameEn: nullableText(snapshot.stageNameEn),
    flag: isMember(STAGE_FLAGS, snapshot.flag) ? snapshot.flag : null,
  };
}

/**
 * `GET /:id/stage-history` — a plain array, **already ordered newest first**
 * (`order: { changedAt: 'DESC', createdAt: 'DESC', id: 'DESC' }`).
 *
 * The order is preserved exactly: `Timeline` never sorts, and re-sorting here
 * would silently disagree with the server on rows that share a timestamp.
 *
 * The label snapshots deliberately survive a retired stage or pipeline — the
 * service bypasses TypeORM's soft-delete scope for exactly that — so a
 * historical row keeps its names after the configuration behind it is gone.
 */
export function parseOpportunityStageHistory(
  payload: unknown,
): OpportunityStageHistoryEntry[] {
  if (!Array.isArray(payload) || payload.length > MAX_STAGE_HISTORY_ROWS) {
    invalid();
  }
  return payload.map((entry) => {
    const row = record(entry);
    if (!row || !isUUIDv7(row.id)) invalid();
    return {
      id: row.id,
      fromStatus: isMember(OPPORTUNITY_STATUSES, row.fromStatus)
        ? row.fromStatus
        : null,
      toStatus: isMember(OPPORTUNITY_STATUSES, row.toStatus)
        ? row.toStatus
        : null,
      changedAt: nullableText(row.changedAt) ?? nullableText(row.createdAt),
      changedByUserId: nullableUuid(row.changedByUserId),
      reason: nullableText(row.reason),
      fromStageSnapshot: parseStageSnapshot(row.fromStageSnapshot),
      toStageSnapshot: parseStageSnapshot(row.toStageSnapshot),
    };
  });
}

export function opportunityPath(id: string): string {
  if (!isUUIDv7(id)) throw new Error("Invalid opportunity id.");
  return `${OPPORTUNITIES_PATH}/${encodeURIComponent(id)}`;
}

export function opportunityStageHistoryPath(id: string): string {
  return `${opportunityPath(id)}/stage-history`;
}

export function opportunityPipelinePath(id: string): string {
  return `${opportunityPath(id)}/pipeline`;
}
