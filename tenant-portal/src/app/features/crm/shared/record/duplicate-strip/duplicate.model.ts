export type DuplicateMatchType = 'TAX_NUMBER' | 'COMMERCIAL_REGISTRATION' | 'PHONE' | 'EMAIL' | 'NAME';

/** LeadStageFlagEnum (crm-app packages/common/src/enums/crm.enums.ts). */
export type DuplicateLeadStageFlag =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFYING'
  | 'QUALIFIED'
  | 'DISQUALIFIED'
  | 'CONVERTED'
  | 'NURTURING'
  | 'ON_HOLD';

/** LeadStatusEnum (crm-app packages/common/src/enums/crm.enums.ts). */
export type DuplicateLeadStatus = 'OPEN' | 'CONVERTED' | 'DISQUALIFIED' | 'ON_HOLD';

/** LeadDuplicateMatchLead (crm-app crm/leads/dto/lead-bulk.dto.ts). */
export interface DuplicateLeadRef {
  id: string;
  stageId: string;
  stageFlag: DuplicateLeadStageFlag;
  status: DuplicateLeadStatus;
  ownerUserId: string | null;
}

/** Scope at which the duplicate policy would block the save. */
export type DuplicateLevel = 'COMPANY' | 'BRANCH' | 'USER' | 'SAME_OWNER';

export interface DuplicateContactMethodHit {
  methodType: string;
  wouldBlock: boolean;
  level: DuplicateLevel;
}

/** LeadDuplicateMatch (crm-app crm/leads/dto/lead-bulk.dto.ts): every wire field is always sent. */
export interface DuplicateMatch {
  /** Per contact-method policy verdicts. */
  contactMethods: DuplicateContactMethodHit[];
  /** True when any contact method would be rejected by the duplicate policy. */
  wouldBlock: boolean;
  /** The blocking level, or null when nothing would block. */
  level: DuplicateLevel | null;
  partyId: string;
  /** Null when the party belongs to a branch other than the request's. */
  displayName: string | null;
  partyType: 'PERSON' | 'ORGANIZATION';
  matchTypes: DuplicateMatchType[];
  /** Live leads on the party that the caller may read (newest first, at most 5). */
  leads: DuplicateLeadRef[];
  /** True when anything about this match was withheld from the caller. */
  restricted: boolean;
  /**
   * Client-only: never sent by the server. The duplicate strip sets it on the `openRecord`
   * event to the lead the user picked; a customer caller may set it to its own record id.
   */
  recordId?: string;
}

/** POST /api/tenant/crm/v1/leads/duplicate-check response envelope (LeadDuplicateCheckResponse). */
export interface DuplicateCheckResponse {
  matches: DuplicateMatch[];
}

export interface DuplicateProbe {
  branchId: string | null;
  /** The record's owner; the server evaluates USER / SAME_OWNER levels against it. */
  ownerUserId?: string | null;
  name: string;
  phones: string[];
  email: string;
  taxNumber: string;
  commercialRegistrationNumber: string;
  excludePartyId: string | null;
  corporate: boolean;
}

/** LeadDuplicateCheckDto: at least one probe, else 422 LEAD_DUPLICATE_CHECK_EMPTY. */
export interface DuplicateCheckPayload {
  ownerUserId?: string;
  branchId: string;
  name?: string;
  phones?: string[];
  email?: string;
  taxNumber?: string;
  commercialRegistrationNumber?: string;
  excludePartyId?: string;
}

export interface DuplicateCompanySelection {
  partyId: string;
  displayName: string;
}
