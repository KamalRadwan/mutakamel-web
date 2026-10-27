// The Leads screen's list row, stage catalogue and action capabilities.
//
//   GET  /api/tenant/crm/v1/leads?branchId=…          200 LeadsPage
//   POST /api/tenant/crm/v1/leads/search               200 LeadsPage
//   GET  /api/tenant/crm/v1/lead-stages                200 LeadStageItem[]
//   GET  /api/tenant/crm/v1/leads/capabilities?branchId=…  200 capabilities
//
// Row shape verified against crm-app `LeadListReadModel`
// (src/common/party-read-model.ts): the lead entity, the Party-backed identity
// (`displayName`, `primaryMobile`, `companyPhone`, `phones`, …), the board
// fields (`owner`, `nextActivity`, `tags`), the Party's
// primary `address` and `primaryContact`. Tax and registration numbers exist
// only on the nested `party` summary.

import type { CardColor } from "@/design-system";
import { isUUIDv7 } from "@/lib/uuid";
import {
  parseLeadStageCatalogueResponse,
  type LeadStageFlag,
} from "../lead-stages/lead-stage-contract";
import {
  crmRecord,
  parseCrmActionCapability,
  type CrmActionCapability,
} from "../shared/crm-capabilities";
import { parseCrmTags, type CrmTag } from "../shared/tag-contract";
import {
  parseLeadCardColor,
  parseLeadNextActivity,
  parseLeadOwner,
  parseLeadRating,
  type LeadCardPatch,
  type LeadNextActivity,
  type LeadOwner,
} from "./lead-card-contract";

export interface LeadStage {
  id: string;
  nameAr: string;
  nameEn: string;
  flag: LeadStageFlag;
}

interface LeadPrimaryContact {
  partyId: string;
  displayName: string;
  jobTitle: string;
  email: string;
  phones: string[];
  isPrimary: boolean;
}

export interface LeadItem {
  id: string;
  partyId: string;
  leadProfileType: "INDIVIDUAL" | "CORPORATE";
  leadName: string;
  company: string;
  email: string;
  phone: string;
  /** Distinct contact and company numbers returned with the list row. */
  phones: string[];
  country: string;
  primaryContact: LeadPrimaryContact | null;
  sourceNameAr: string;
  sourceNameEn: string;
  sourceIconUrl: string | null;
  stageId: string;
  // `ownerUserId` is the capability key and is present on every lead; `owner`
  // carries the names the card draws initials from and is null when unknown.
  ownerUserId: string | null;
  rating: number;
  cardColor: CardColor | null;
  owner: LeadOwner | null;
  nextActivity: LeadNextActivity | null;
  tags: CrmTag[];
  primaryMobile?: string;
  firstName?: string;
  lastName?: string;
  companyWebsite?: string;
  acquisitionSourceId?: string;
  city?: string;
  taxNumber?: string;
  commercialRegistrationNumber?: string;
  interestSummary?: string;
  expectedNeed?: string;
  description?: string;
  /**
   * When the lead entered its current stage (`crm_leads.stage_entered_at`).
   * The stage-age badge counts from it; `updatedAt` moves on any edit.
   */
  stageEnteredAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeadsPage {
  items: LeadItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export type LeadsPageInfo = Omit<LeadsPage, "items">;

export interface LeadCapabilities {
  create: CrmActionCapability | null;
  update: CrmActionCapability | null;
  delete: CrmActionCapability | null;
}

const INVALID_LEADS = "Invalid leads response.";
const SOURCE_ICON_PATH =
  /^\/api\/tenant\/crm\/v1\/acquisition-sources\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/icon\?v=\d+$/iu;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** A trimmed optional field; undefined when the server sent nothing usable. */
function optionalText(value: unknown): string | undefined {
  return text(value).trim() || undefined;
}

function requiredUuid(value: unknown): string {
  if (!isUUIDv7(value)) throw new Error(INVALID_LEADS);
  return value;
}

function sourceIconUrl(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !SOURCE_ICON_PATH.test(value)) throw new Error(INVALID_LEADS);
  return value;
}

function leadPhoneNumbers(lead: Record<string, unknown>, corporate: boolean): string[] {
  const own = text(corporate ? lead.companyPhone : lead.primaryMobile);
  const listed: unknown[] = Array.isArray(lead.phones) ? lead.phones : [];
  const phones = new Set<string>();
  for (const candidate of [own, ...listed]) {
    if (typeof candidate !== "string" || !candidate.trim()) continue;
    phones.add(candidate.trim());
    if (phones.size === 10) break;
  }
  return [...phones];
}

function parsePrimaryContact(value: unknown): LeadPrimaryContact | null {
  if (value === null || value === undefined) return null;
  const contact = crmRecord(value);
  if (
    !contact ||
    !isUUIDv7(contact.partyId) ||
    typeof contact.displayName !== "string" ||
    !contact.displayName ||
    typeof contact.isPrimary !== "boolean" ||
    !Array.isArray(contact.phones) ||
    !contact.phones.every((phone) => typeof phone === "string")
  ) {
    throw new Error(INVALID_LEADS);
  }
  return {
    partyId: contact.partyId,
    displayName: contact.displayName,
    jobTitle: text(contact.jobTitle),
    email: text(contact.email),
    phones: contact.phones,
    isPrimary: contact.isPrimary,
  };
}

function sourceName(source: Record<string, unknown> | null, first: string, second: string): string {
  return source ? text(source[first]) || text(source[second]) || text(source.code) : "";
}

export function parseLeadResponse(value: unknown, expectedBranchId: string): LeadItem {
  const lead = crmRecord(value);
  if (!lead || typeof lead.displayName !== "string" || !lead.displayName) {
    throw new Error(INVALID_LEADS);
  }
  if (requiredUuid(lead.branchId) !== expectedBranchId) throw new Error(INVALID_LEADS);
  if (lead.leadProfileType !== "INDIVIDUAL" && lead.leadProfileType !== "CORPORATE") {
    throw new Error(INVALID_LEADS);
  }
  const corporate = lead.leadProfileType === "CORPORATE";
  const source = crmRecord(lead.acquisitionSource);
  const address = crmRecord(lead.address);
  const party = crmRecord(lead.party);
  const phones = leadPhoneNumbers(lead, corporate);

  return {
    id: requiredUuid(lead.id),
    partyId: requiredUuid(lead.partyId),
    leadProfileType: lead.leadProfileType,
    leadName: lead.displayName,
    company: text(lead.companyName) || lead.displayName,
    email: text(corporate ? lead.companyEmail : lead.email),
    phone: phones[0] ?? "",
    phones,
    country: text(address?.country),
    primaryContact: parsePrimaryContact(lead.primaryContact),
    sourceNameAr: sourceName(source, "nameAr", "nameEn"),
    sourceNameEn: sourceName(source, "nameEn", "nameAr"),
    sourceIconUrl: sourceIconUrl(lead.acquisitionSourceIconUrl),
    stageId: requiredUuid(lead.stageId),
    ownerUserId:
      lead.ownerUserId === null || lead.ownerUserId === undefined
        ? null
        : requiredUuid(lead.ownerUserId),
    rating: parseLeadRating(lead.rating),
    cardColor: parseLeadCardColor(lead.cardColor),
    owner: parseLeadOwner(lead.owner),
    nextActivity: parseLeadNextActivity(lead.nextActivity),
    tags: parseCrmTags(lead.tags, INVALID_LEADS),
    primaryMobile: optionalText(lead.primaryMobile),
    firstName: optionalText(lead.firstName),
    lastName: optionalText(lead.lastName),
    companyWebsite: optionalText(lead.companyWebsite),
    acquisitionSourceId: isUUIDv7(lead.acquisitionSourceId)
      ? lead.acquisitionSourceId
      : isUUIDv7(source?.id)
        ? source.id
        : undefined,
    city: optionalText(address?.city),
    taxNumber: optionalText(party?.taxNumber),
    commercialRegistrationNumber: optionalText(party?.commercialRegistrationNumber),
    interestSummary: optionalText(lead.interestSummary),
    expectedNeed: optionalText(lead.expectedNeed),
    description: optionalText(lead.description),
    stageEnteredAt: optionalText(lead.stageEnteredAt),
    createdAt: optionalText(lead.createdAt),
    updatedAt: optionalText(lead.updatedAt),
  };
}

function safeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(INVALID_LEADS);
  return value;
}

export function parseLeadsResponse(payload: unknown, expectedBranchId: string): LeadsPage {
  const body = crmRecord(payload);
  if (
    !body ||
    !Array.isArray(body.items) ||
    typeof body.hasNext !== "boolean" ||
    typeof body.hasPrev !== "boolean"
  ) {
    throw new Error(INVALID_LEADS);
  }
  const total = safeInteger(body.total);
  const page = safeInteger(body.page);
  const limit = safeInteger(body.limit);
  const totalPages = safeInteger(body.totalPages);
  const items = body.items.map((item) => parseLeadResponse(item, expectedBranchId));
  // An empty page past the end is valid: concurrent deletes can shrink the
  // result set between the request and the response.
  if (
    total < 0 ||
    page < 1 ||
    limit < 1 ||
    limit > 100 ||
    totalPages !== (total === 0 ? 0 : Math.ceil(total / limit)) ||
    items.length > limit ||
    body.hasPrev !== (page > 1 && totalPages > 0) ||
    body.hasNext !== page < totalPages
  ) {
    throw new Error(INVALID_LEADS);
  }
  return { items, total, page, limit, totalPages, hasNext: body.hasNext, hasPrev: body.hasPrev };
}

export function parseLeadStagesResponse(payload: unknown): LeadStage[] {
  return parseLeadStageCatalogueResponse(payload)
    .filter(({ isActive }) => isActive)
    .map(({ id, nameAr, nameEn, flag }) => ({ id, nameAr, nameEn, flag }));
}

export function parseLeadCapabilitiesResponse(
  payload: unknown,
  expectedBranchId: string,
): LeadCapabilities {
  const response = crmRecord(payload);
  const leads = response && crmRecord(response.leads);
  if (!response || response.branchId !== expectedBranchId || !leads) {
    throw new Error("Invalid lead capabilities response.");
  }
  return {
    create: parseCrmActionCapability(leads.create, "lead"),
    update: parseCrmActionCapability(leads.update, "lead"),
    delete: parseCrmActionCapability(leads.delete, "lead"),
  };
}

/**
 * The card fields a write owns, read from `source`. A card write never
 * replaces the whole row: a list refresh during the request may have brought
 * a richer primary contact or newer phones that the snapshot does not have.
 */
export function leadCardFields(
  patch: LeadCardPatch,
  source: Pick<LeadItem, "rating" | "cardColor">,
): LeadCardPatch {
  return {
    ...(patch.rating !== undefined ? { rating: source.rating } : {}),
    ...(patch.cardColor !== undefined ? { cardColor: source.cardColor } : {}),
  };
}
