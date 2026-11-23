import { ApiError } from '../../../core/api/api-errors';
import type { CardColor } from '../shared/record/fields/record-fields.model';
import { RecordNavContext } from '../shared/record/nav/record-nav';

export type LeadView = 'board' | 'cards' | 'table';
export const LEAD_VIEWS: readonly LeadView[] = ['board', 'cards', 'table'];

export type LeadProfileType = 'INDIVIDUAL' | 'CORPORATE';
export type LeadStatus = 'OPEN' | 'CONVERTED' | 'DISQUALIFIED' | 'ON_HOLD';
export type StageFlag = 'NEW' | 'CONTACTED' | 'QUALIFYING' | 'QUALIFIED' | 'DISQUALIFIED' | 'CONVERTED' | 'NURTURING' | 'ON_HOLD';
export type DueBucket = 'OVERDUE' | 'TODAY' | 'FUTURE';
export { CARD_COLORS } from '../shared/record/fields/record-fields.model';
export type { CardColor } from '../shared/record/fields/record-fields.model';

export interface Named {
  nameAr: string;
  nameEn: string;
}

export interface LeadStage extends Named {
  id: string;
  flag: StageFlag;
  sortOrder: number;
  isActive: boolean;
}

export interface LeadRow {
  id: string;
  leadProfileType: LeadProfileType;
  displayName: string;
  companyName: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  email: string | null;
  primaryMobile: string | null;
  phones: string[];
  stageId: string;
  stageFlag: StageFlag;
  status: LeadStatus;
  rating: number;
  cardColor: CardColor | null;
  owner: { userId: string; firstName: string | null; lastName: string | null; avatarUrl?: string | null } | null;
  nextActivity: { activityAt: string; bucket: DueBucket } | null;
  acquisitionSource: ({ id: string } & Named) | null;
  address: PartyAddressView | null;
  primaryContact: LeadPrimaryContact | null;
  interestSummary: string | null;
  tags: LeadTag[];
  updatedAt: string;
}

/** common/party-read-model.ts GeoPlaceView. */
export interface GeoPlaceView extends Named {
  id: string;
}

/**
 * common/party-read-model.ts PartyAddressView: the party's primary address on every lead read.
 * The legacy text fields keep their stored meaning (`country` is the country's English name,
 * `area` the state text, `street` / `apartment` are what the form sends as street1 / street2);
 * geography adds ids and resolved names.
 */
export interface PartyAddressView {
  addressType: string;
  label: string | null;
  country: string | null;
  city: string | null;
  area: string | null;
  street: string | null;
  buildingNo: string | null;
  floor: string | null;
  apartment: string | null;
  landmark: string | null;
  postalCode: string | null;
  countryId: string | null;
  stateId: string | null;
  cityId: string | null;
  districtId: string | null;
  countryName: GeoPlaceView | null;
  stateName: GeoPlaceView | null;
  cityName: GeoPlaceView | null;
  districtName: GeoPlaceView | null;
}

/** LeadPrimaryContactView. */
export interface LeadPrimaryContact {
  partyId: string;
  displayName: string;
  jobTitle: string | null;
  isPrimary: boolean;
  email: string | null;
  phones: string[];
}

export interface LeadTag {
  id: string;
  name: string;
  backgroundColor: string | null;
  textColor: string | null;
}

export interface LeadSearchOptions {
  stages: LeadStage[];
  sources: ({ id: string } & Named)[];
  tags: LeadTag[];
  unavailable?: ('stage' | 'source' | 'tag')[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** LeadBoardLaneResponse: POST /leads/board/stages/:id, and one entry of POST /leads/board. */
export interface BoardLane extends Page<LeadRow> {
  stage: LeadStage;
}

/** LeadBoardResponse: POST /leads/board. */
export interface LeadBoard {
  stages: BoardLane[];
}

/** LeadKpisResponse: POST /leads/kpis (the same filters as the list). */
export interface LeadKpis {
  totalLeads: number;
  newStageLeads: number;
  newTodayLeads: number;
  hotLeads: number;
  overdueActivityLeads: number;
  qualifiedLeads: number;
}

/** Stage filter counts, read from the board lane totals (the KPI endpoint has no per-stage counts). */
export interface StageCounts {
  total: number;
  byStage: Record<string, number>;
}

export function stageCountsOf(board: LeadBoard): StageCounts {
  const byStage: Record<string, number> = {};
  for (const lane of board.stages) byStage[lane.stage.id] = lane.total;
  return { total: board.stages.reduce((sum, lane) => sum + lane.total, 0), byStage };
}

export const BOARD_LIMIT = 50;
export const LIST_LIMIT = 20;

export type MoveErrorCode =
  | 'LEAD_CONVERSION_REQUIRED'
  | 'CRM_REASON_REQUIRED'
  | 'CRM_REASON_KIND_MISMATCH'
  | 'CRM_REASON_UNAVAILABLE'
  | 'LEAD_ALREADY_CONVERTED'
  | 'LEAD_STAGE_INVALID';

const MOVE_ERROR_STATUS: Record<MoveErrorCode, number> = {
  LEAD_CONVERSION_REQUIRED: 422,
  CRM_REASON_REQUIRED: 422,
  CRM_REASON_KIND_MISMATCH: 422,
  CRM_REASON_UNAVAILABLE: 422,
  LEAD_ALREADY_CONVERTED: 409,
  LEAD_STAGE_INVALID: 422,
};

/** A refused POST /leads/:id/stage: an ApiError with the backend status, typed by its code. */
export class LeadMoveError extends ApiError {
  declare readonly code: MoveErrorCode;

  constructor(code: MoveErrorCode) {
    super(MOVE_ERROR_STATUS[code], code);
  }
}

/**
 * 400 CRM_VALIDATION_FAILED from the ValidationPipe: the shared exceptions filter flattens the
 * class-validator errors into details keyed by dotted property path (`contacts.0.firstName`).
 */
export function validationPaths(error: unknown): string[] {
  if (!(error instanceof ApiError) || error.code !== 'CRM_VALIDATION_FAILED' || !error.details) return [];
  return Object.keys(error.details);
}

export interface DueCounts {
  OVERDUE: number;
  TODAY: number;
  FUTURE: number;
  NONE: number;
}

export function dueCounts(leads: readonly LeadRow[]): DueCounts {
  const counts: DueCounts = { OVERDUE: 0, TODAY: 0, FUTURE: 0, NONE: 0 };
  for (const lead of leads) {
    counts[lead.nextActivity?.bucket ?? 'NONE']++;
  }
  return counts;
}

export function ownerName(lead: LeadRow): string {
  return [lead.owner?.firstName, lead.owner?.lastName].filter(Boolean).join(' ');
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export function canMove(lead: LeadRow): boolean {
  return lead.status !== 'CONVERTED';
}

export function leadActionAllowed(scope: Scope | null | undefined, lead: LeadRow): boolean {
  return lead.status !== 'CONVERTED' && !!scope && (scope.scope === 'all'
    || !!lead.owner && !!scope.ownerUserIds?.includes(lead.owner.userId));
}

export function nameIn(item: Named, language: string): string {
  return language === 'ar' ? item.nameAr : item.nameEn;
}

export type CurrencyCode = string; // ISO 4217, 3 letters

export interface LeadContact {
  partyId: string;
  /** crm_lead_contacts.party_relationship_id: the company CONTACT_PERSON link, null when there is none. */
  relationshipId: string | null;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  honorificTitle: string | null;
  jobTitle: string | null;
  isPrimary: boolean;
  email: string | null;
  phones: string[];
}

/** LeadDetailReadModel: the list row plus every contact (and the form-only fields). */
export interface LeadDetail extends LeadRow {
  branchId: string;
  partyId: string;
  ownerUserId: string | null;
  acquisitionSourceId: string | null;
  firstName: string | null;
  lastName: string | null;
  honorificTitle: string | null;
  legalName: string | null;
  taxNumber: string | null;
  commercialRegistrationNumber: string | null;
  companyPhones: string[];
  companyWebsite: string | null;
  existingCompany: boolean;
  description: string | null;
  expectedNeed: string | null;
  expectedValue: string | null;
  currencyCode: CurrencyCode | null;
  contacts: LeadContact[];
  customFields: Record<string, unknown>;
  createdAt: string;
}

/** The `leads` part of GET /leads/capabilities. */
export interface LeadCapabilities {
  create: Scope | null;
  update: Scope | null;
  delete: Scope | null;
  convert: Scope | null;
}

/** LeadsCapabilitiesResponse: GET /leads/capabilities?branchId=. */
export interface LeadsCapabilities {
  branchId: string;
  leads: LeadCapabilities;
  activities: { create: Scope | null };
  notes: { create: Scope | null; delete: Scope | null };
  attachments: { create: Scope | null; delete: Scope | null };
  opportunities: { create: Scope | null };
}

export interface Scope {
  scope: 'own' | 'team' | 'all';
  ownerUserIds: string[] | null;
}

export interface BranchOption {
  id: string;
  name: string;
  companyName: string;
}

export interface OwnerOption {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface SourceOption extends Named {
  id: string;
  iconUrl: string | null;
}

export interface CurrencyOption {
  code: CurrencyCode;
  name: string;
  decimalPlaces: number;
  isDefault: boolean;
}

export interface CompanyOption {
  id: string;
  displayName: string;
  legalName: string | null;
  branchId: string | null;
}

export interface CompanyContactOption {
  partyId: string;
  displayName: string;
  jobTitle: string | null;
  primaryEmail: string | null;
  phones: string[];
  isPrimary: boolean;
}

export type CustomFieldType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'DATE'
  | 'DATETIME'
  | 'BOOLEAN'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'URL'
  | 'EMAIL'
  | 'PHONE';

export interface LeadCustomField extends Named {
  id: string;
  fieldKey: string;
  type: CustomFieldType;
  placeholderAr: string | null;
  placeholderEn: string | null;
  options: { key: string; nameAr: string; nameEn: string }[];
  requiredOnCreate: boolean;
  requiredOnUpdate: boolean;
  sortOrder: number;
}

export type LeadNavContext = RecordNavContext;
