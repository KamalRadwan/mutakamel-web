// Pipeline-wide Lead routes — the bulk bar, the KPI strip and the create
// form's duplicate warning.
//
//   POST /api/tenant/crm/v1/leads/bulk-stage        200 { stageId, updatedIds, unchangedIds }
//   POST /api/tenant/crm/v1/leads/bulk-update       200 { updatedIds, unchangedIds }
//   POST /api/tenant/crm/v1/leads/bulk-delete       200 { deletedIds }
//   POST /api/tenant/crm/v1/leads/kpis              200 LeadKpis
//   POST /api/tenant/crm/v1/leads/duplicate-check   200 { matches }
//   POST /api/tenant/crm/v1/leads/document-counts   200 { countsByPartyId }
//
// Backend: crm-app/src/crm/leads/leads.controller.ts and
// docs/LLD/04-crm-app/10_MVP/06_leads.md. Every bulk route takes 1-100 unique
// lead ids of ONE branch and is all-or-nothing: the first refused lead rolls
// the batch back and comes back in `details.leadId`. Larger selections are
// split into batches of 100 here.

import type { CardColor } from "@/design-system";
import type { TenantApiRequestConfig } from "@/lib/api/axiosClient";
import { isUUIDv7 } from "@/lib/uuid";

const LEADS_PATH = "/api/tenant/crm/v1/leads";

export const LEADS_BULK_STAGE_PATH = `${LEADS_PATH}/bulk-stage`;
export const LEADS_BULK_UPDATE_PATH = `${LEADS_PATH}/bulk-update`;
export const LEADS_BULK_DELETE_PATH = `${LEADS_PATH}/bulk-delete`;
export const LEADS_KPIS_PATH = `${LEADS_PATH}/kpis`;
export const LEADS_DUPLICATE_CHECK_PATH = `${LEADS_PATH}/duplicate-check`;
export const LEADS_DOCUMENT_COUNTS_PATH = `${LEADS_PATH}/document-counts`;

/** `MAX_BULK_LEAD_IDS` in crm-app's `lead-bulk.dto.ts`. */
export const MAX_BULK_LEAD_IDS = 100;

/**
 * The bulk writes are classified like the single-lead writes they batch
 * (`WRITE_SENSITIVE`, `idempotent: false`): no idempotency key, never replayed.
 */
export const BULK_WRITE_OPTIONS: TenantApiRequestConfig = {
  nonReplayable: true,
  skipAutoIdempotency: true,
  cache: "no-store",
  maxResponseBytes: 64 * 1024,
};

/**
 * Reads sent as POST bodies, configured like the board read: no idempotency
 * key, and safe to repeat once after a session refresh because they write
 * nothing.
 */
export const BODY_READ_OPTIONS: TenantApiRequestConfig = {
  skipAutoIdempotency: true,
  replayAfterRefresh: true,
  cache: "no-store",
  maxResponseBytes: 64 * 1024,
};

/** Unique ids of the given leads, in batches the backend accepts. */
export function leadIdBatches(leads: ReadonlyArray<{ id: string }>): string[][] {
  const ids = [...new Set(leads.map(({ id }) => id))];
  const batches: string[][] = [];
  for (let index = 0; index < ids.length; index += MAX_BULK_LEAD_IDS) {
    batches.push(ids.slice(index, index + MAX_BULK_LEAD_IDS));
  }
  return batches;
}

export function buildBulkMoveLeadStageRequest(
  branchId: string,
  leadIds: readonly string[],
  stageId: string,
): { branchId: string; leadIds: string[]; stageId: string } {
  if (!isUUIDv7(stageId)) throw new Error("Invalid lead stage id.");
  return { branchId, leadIds: [...leadIds], stageId };
}

/**
 * The only fields `POST /leads/bulk-update` accepts. `null` clears the colour
 * or the source; rating and owner cannot be cleared.
 */
export interface BulkLeadFieldsPatch {
  rating?: number;
  ownerUserId?: string;
  cardColor?: CardColor | null;
  acquisitionSourceId?: string | null;
}

/** Drops anything but the four bulk fields, so a wider patch cannot leak in. */
export function bulkLeadFields(patch: BulkLeadFieldsPatch): BulkLeadFieldsPatch {
  return {
    ...(patch.rating !== undefined ? { rating: patch.rating } : {}),
    ...(patch.ownerUserId !== undefined ? { ownerUserId: patch.ownerUserId } : {}),
    ...(patch.cardColor !== undefined ? { cardColor: patch.cardColor } : {}),
    ...(patch.acquisitionSourceId !== undefined ? { acquisitionSourceId: patch.acquisitionSourceId } : {}),
  };
}

/* ── KPIs ─────────────────────────────────────────────────────────────── */

interface LeadKpiStageCounts {
  stageId: string;
  total: number;
  hot: number;
  overdue: number;
}

export interface LeadKpis {
  totalLeads: number;
  newStageLeads: number;
  newTodayLeads: number;
  hotLeads: number;
  overdueActivityLeads: number;
  qualifiedLeads: number;
  byStage: LeadKpiStageCounts[];
}

function count(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid lead KPI response: ${field}.`);
  }
  return value;
}

export function parseLeadKpisResponse(value: unknown): LeadKpis {
  if (typeof value !== "object" || value === null) throw new Error("Invalid lead KPI response.");
  const body = value as Record<string, unknown>;
  if (!Array.isArray(body.byStage)) throw new Error("Invalid lead KPI response: byStage.");
  return {
    totalLeads: count(body.totalLeads, "totalLeads"),
    newStageLeads: count(body.newStageLeads, "newStageLeads"),
    newTodayLeads: count(body.newTodayLeads, "newTodayLeads"),
    hotLeads: count(body.hotLeads, "hotLeads"),
    overdueActivityLeads: count(body.overdueActivityLeads, "overdueActivityLeads"),
    qualifiedLeads: count(body.qualifiedLeads, "qualifiedLeads"),
    byStage: body.byStage.map((row) => {
      if (typeof row !== "object" || row === null) throw new Error("Invalid lead KPI response: stage row.");
      const stage = row as Record<string, unknown>;
      if (typeof stage.stageId !== "string" || !isUUIDv7(stage.stageId)) {
        throw new Error("Invalid lead KPI response: stageId.");
      }
      return {
        stageId: stage.stageId,
        total: count(stage.total, "byStage.total"),
        hot: count(stage.hot, "byStage.hot"),
        overdue: count(stage.overdue, "byStage.overdue"),
      };
    }),
  };
}

/* ── Duplicate check ──────────────────────────────────────────────────── */

const LEAD_DUPLICATE_MATCH_TYPES = [
  "TAX_NUMBER",
  "COMMERCIAL_REGISTRATION",
  "PHONE",
  "EMAIL",
  "NAME",
] as const;
type LeadDuplicateMatchType = (typeof LEAD_DUPLICATE_MATCH_TYPES)[number];

export interface LeadDuplicateCheckRequest {
  branchId: string;
  name?: string;
  phones?: string[];
  email?: string;
  taxNumber?: string;
  commercialRegistrationNumber?: string;
  excludePartyId?: string;
}

export interface LeadDuplicateMatch {
  partyId: string;
  /** Null when the Party belongs to another branch; the match is still real. */
  displayName: string | null;
  partyType: "PERSON" | "ORGANIZATION";
  matchTypes: LeadDuplicateMatchType[];
  leads: Array<{ id: string; stageId: string; stageFlag: string; status: string; ownerUserId: string | null }>;
  /** True when the backend withheld a name or leads the user may not read. */
  restricted: boolean;
}

/**
 * The probes the form has typed so far, trimmed; `null` when there is nothing
 * worth asking about yet (the backend refuses an empty probe set).
 */
export function buildLeadDuplicateCheckRequest(input: {
  branchId: string;
  name?: string;
  phones?: readonly string[];
  email?: string;
  taxNumber?: string;
  commercialRegistrationNumber?: string;
}): LeadDuplicateCheckRequest | null {
  const name = input.name?.trim() ?? "";
  const email = input.email?.trim() ?? "";
  const taxNumber = input.taxNumber?.trim() ?? "";
  const commercialRegistrationNumber = input.commercialRegistrationNumber?.trim() ?? "";
  const phones = [...new Set((input.phones ?? [])
    .map((phone) => phone.trim())
    .filter((phone) => phone.replace(/\D/gu, "").length >= 5))].slice(0, 10);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email);
  if (name.length < 3 && !emailValid && !taxNumber && !commercialRegistrationNumber && phones.length === 0) {
    return null;
  }
  return {
    branchId: input.branchId,
    ...(name.length >= 3 ? { name } : {}),
    ...(phones.length > 0 ? { phones } : {}),
    ...(emailValid ? { email } : {}),
    ...(taxNumber ? { taxNumber } : {}),
    ...(commercialRegistrationNumber ? { commercialRegistrationNumber } : {}),
  };
}

export function parseLeadDuplicateCheckResponse(value: unknown): LeadDuplicateMatch[] {
  if (typeof value !== "object" || value === null || !Array.isArray((value as { matches?: unknown }).matches)) {
    throw new Error("Invalid duplicate-check response.");
  }
  return ((value as { matches: unknown[] }).matches).map((row) => {
    if (typeof row !== "object" || row === null) throw new Error("Invalid duplicate-check response.");
    const match = row as Record<string, unknown>;
    if (typeof match.partyId !== "string" || !isUUIDv7(match.partyId)) {
      throw new Error("Invalid duplicate-check response: partyId.");
    }
    const matchTypes = Array.isArray(match.matchTypes)
      ? match.matchTypes.filter((type): type is LeadDuplicateMatchType =>
          (LEAD_DUPLICATE_MATCH_TYPES as readonly unknown[]).includes(type))
      : [];
    const leads = Array.isArray(match.leads)
      ? match.leads.flatMap((lead) => {
          if (typeof lead !== "object" || lead === null) return [];
          const item = lead as Record<string, unknown>;
          if (typeof item.id !== "string" || !isUUIDv7(item.id) || typeof item.stageId !== "string") return [];
          return [{
            id: item.id,
            stageId: item.stageId,
            stageFlag: typeof item.stageFlag === "string" ? item.stageFlag : "",
            status: typeof item.status === "string" ? item.status : "",
            ownerUserId: typeof item.ownerUserId === "string" ? item.ownerUserId : null,
          }];
        })
      : [];
    return {
      partyId: match.partyId,
      displayName: typeof match.displayName === "string" ? match.displayName : null,
      partyType: match.partyType === "PERSON" ? "PERSON" : "ORGANIZATION",
      matchTypes,
      leads,
      restricted: match.restricted === true,
    };
  });
}

/* ── Card document counters ───────────────────────────────────────────── */

export interface LeadCardDocumentCounts {
  opportunities: number | null;
  quotations: number | null;
  salesOrders: number | null;
  invoices: number | null;
}

function nullableCount(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Invalid document counts response.");
  }
  return value;
}

/**
 * `{ countsByPartyId: { [partyId]: { opportunities, quotations, salesOrders,
 * invoices } } }`, one entry for every requested Party; `null` means the user
 * may not see that counter (or the tenant has no Trade), never zero.
 */
export function parseLeadDocumentCountsResponse(
  value: unknown,
  requestedPartyIds: readonly string[],
): Map<string, LeadCardDocumentCounts> {
  const body = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
  const rows = body && typeof body.countsByPartyId === "object" && body.countsByPartyId !== null
    ? (body.countsByPartyId as Record<string, unknown>)
    : null;
  if (!rows) throw new Error("Invalid document counts response.");
  const counts = new Map<string, LeadCardDocumentCounts>();
  for (const partyId of requestedPartyIds) {
    const row = rows[partyId];
    if (typeof row !== "object" || row === null) throw new Error("Invalid document counts response.");
    const entry = row as Record<string, unknown>;
    counts.set(partyId, {
      opportunities: nullableCount(entry.opportunities),
      quotations: nullableCount(entry.quotations),
      salesOrders: nullableCount(entry.salesOrders),
      invoices: nullableCount(entry.invoices),
    });
  }
  return counts;
}
