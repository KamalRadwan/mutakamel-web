// Control tower contract, aligned with trade-app src/modules/control-tower (dto/control-tower.dto.ts,
// control-tower-query.ts, control-tower-sources.ts, control-tower.service.ts, bulk handler).

import type { Page } from '../shared/trade-foundation.model';

export const TOWER_STATUSES = [
  'OPEN',
  'ACKNOWLEDGED',
  'ACTION_PENDING',
  'RECONCILIATION_PENDING',
  'RESOLVED',
  'QUARANTINED',
] as const;
export type TowerStatus = (typeof TOWER_STATUSES)[number];

/** Same as the backend RESOLVABLE_EXCEPTION_STATUSES: RESOLVED and QUARANTINED never resolve. */
export const RESOLVABLE_TOWER_STATUSES: readonly TowerStatus[] = [
  'OPEN',
  'ACKNOWLEDGED',
  'RECONCILIATION_PENDING',
  'ACTION_PENDING',
];

export const TOWER_SEVERITIES = ['INFO', 'WARNING', 'HIGH', 'CRITICAL'] as const;
export type TowerSeverity = (typeof TOWER_SEVERITIES)[number];

export const TOWER_CATEGORIES = [
  'PROFILE_ACTIVATION_CONFLICT',
  'RESULT_CONFLICT',
  'OWNER_TRANSPORT_EXHAUSTED',
  'DATA_CORRECTION_REQUIRED',
] as const;
export type TowerCategory = (typeof TOWER_CATEGORIES)[number];

/** Known source types; the backend sends a free string (<= 64), so unknown values stay possible. */
export const TOWER_SOURCE_TYPES = [
  'DOCUMENT_PROFILE_VERSION',
  'QUOTATION_PDF_RENDER',
  'BUSINESS_PDF_RENDER',
] as const;
export type TowerSourceType = string;

export type TowerSourceLinkKind =
  | 'DOCUMENT_PROFILE_VERSION'
  | 'QUOTATION'
  | 'SALES_ORDER'
  | 'PURCHASE_ORDER';

export interface TowerSource {
  type: TowerSourceType;
  id: string;
  label: string | null; // null for deleted, missing or unknown sources
  documentType?: string;
  documentNumber?: string | null;
  link?: { kind: TowerSourceLinkKind; id: string; parentId?: string };
}

/** UI-only router target built from `TowerSource.link` (see `towerSourceRoute` in tower.util.ts). */
export interface TowerSourceRoute {
  commands: unknown[];
  queryParams?: Record<string, string>;
}

export interface TowerAttempt {
  id: string;
  ownerCode: string;
  sourceType: string;
  sourceId: string;
  sourceVersion: number;
  status: string;
  retryClass: string;
  attemptCount: number;
  nextAttemptAt: string | null;
  lastErrorCode: string | null;
  version: number;
  updatedAt: string;
}

export type TowerResolutionCode = 'SOURCE_CORRECTED' | 'OWNER_RESULT_APPLIED' | 'RESULT_ACCEPTED';

/** Visible only to the recorded resolver or view-sensitive readers; otherwise undefined. */
export interface TowerResolutionEvidence {
  resolutionCode?: TowerResolutionCode;
  reasonCode?: string;
  note?: string;
  evidence?: Record<string, unknown>;
  resolvedBy?: string;
  [key: string]: unknown;
}

export interface TowerException {
  id: string;
  version: number;
  companyId: string | null;
  branchId: string | null;
  sourceOwner?: string;
  sourceType: TowerSourceType;
  sourceId: string;
  sourceVersion?: number;
  category: TowerCategory;
  severity: TowerSeverity;
  status: TowerStatus;
  retryClass?: string;
  safeErrorCode: string;
  intentKey?: string | null;
  correlationId: string;
  assignedUserId?: string | null;
  resolvedAt: string | null;
  resolutionReasonCode: string | null;
  resolutionReasonNote?: string | null;
  resolutionEvidence?: TowerResolutionEvidence;
  source?: TowerSource;
  /** Detail only. */
  attempts?: TowerAttempt[];
  /** Detail only; list rows derive it with `allowedCodesFor`. */
  allowedResolutionCodes?: readonly TowerResolutionCode[];
  /** Present on detail responses (and list envelope). */
  asOf?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TowerExceptionPage extends Page<TowerException> {
  asOf: string;
}

/** Backend counts response: every enum bucket is present, zeros included. resolvedToday is UTC. */
export interface TowerCounts {
  total: number;
  byStatus: Record<TowerStatus, number>;
  bySeverity: Record<TowerSeverity, number>;
  byCategory: Record<TowerCategory, number>;
  resolvedToday: number;
}

/** Page cards and step counts, adapted from `TowerCounts` by `toTowerCardCounts`. */
export interface TowerCardCounts {
  open: number;
  actionPending: number;
  quarantined: number;
  resolved: number;
  resolvedToday: number;
  highOrCritical: number;
  total: number;
}

export function toTowerCardCounts(c: TowerCounts): TowerCardCounts {
  const s = c.byStatus;
  return {
    open: (s.OPEN ?? 0) + (s.ACKNOWLEDGED ?? 0),
    actionPending: (s.ACTION_PENDING ?? 0) + (s.RECONCILIATION_PENDING ?? 0),
    quarantined: s.QUARANTINED ?? 0,
    resolved: s.RESOLVED ?? 0,
    resolvedToday: c.resolvedToday,
    highOrCritical: (c.bySeverity.HIGH ?? 0) + (c.bySeverity.CRITICAL ?? 0),
    total: c.total,
  };
}

/**
 * Scope comes from the scope context (company/branch headers), never from query params:
 * tenant context = unscoped rows; branch context = that branch; company context = the company's own
 * rows, plus all its branch rows with includeBranches=true. `branchId` (company context only) narrows
 * to one active branch of the context company and overrides includeBranches. 403 SCOPE_DENIED reasons:
 * branch_filter_requires_company (tenant/branch context), branch_not_accessible (foreign, inactive or
 * deleted branch), include_branches_requires_company. companyId is never a query param (400).
 */
export interface TowerScopeFilter {
  includeBranches?: boolean;
  branchId?: string;
}

export type TowerSort = 'createdAt' | 'severity';

/** Nonpaging filters shared by list, counts and the bulk QUERY selection. */
export interface TowerFilterQuery extends TowerScopeFilter {
  severity?: TowerSeverity;
  category?: TowerCategory;
  sourceType?: string;
  createdFrom?: string;
  createdTo?: string;
  sort?: TowerSort;
}

/** Counts reject status/page/limit (whitelist validation). */
export type TowerCountsQuery = TowerFilterQuery;

export interface TowerSelectionQuery extends TowerFilterQuery {
  status?: TowerStatus[]; // sent as a comma list
}

export interface ListTowerExceptionsQuery extends TowerSelectionQuery {
  page?: number;
  limit?: number;
}

export interface ResolveExceptionInput {
  resolutionCode: TowerResolutionCode;
  reasonCode: string;
  note?: string | null;
  evidence: Record<string, unknown>;
}

export type BulkResolveSelection =
  | { kind: 'IDS'; ids: string[] }
  | { kind: 'QUERY'; query: TowerSelectionQuery; excludedIds?: string[] };

export interface BulkResolveExceptionsInput {
  selection: BulkResolveSelection;
  resolutionCode: TowerResolutionCode;
  reasonCode: string;
  note?: string | null;
  evidence: Record<string, unknown>;
}

export const TOWER_EVIDENCE_LIMITS = {
  minKeys: 1,
  maxKeys: 50,
  maxDepth: 4,
  maxBytes: 8192,
} as const;

export const FORBIDDEN_EVIDENCE_KEY_PATTERN =
  /(secret|password|token|rawpayload|authorization)/i;

export function isForbiddenEvidenceKey(key: string): boolean {
  return FORBIDDEN_EVIDENCE_KEY_PATTERN.test(key);
}

export function resolutionCodesFor(category: TowerCategory): readonly TowerResolutionCode[] {
  switch (category) {
    case 'PROFILE_ACTIVATION_CONFLICT':
    case 'DATA_CORRECTION_REQUIRED':
      return ['SOURCE_CORRECTED'];
    case 'OWNER_TRANSPORT_EXHAUSTED':
      return ['OWNER_RESULT_APPLIED'];
    case 'RESULT_CONFLICT':
      return ['RESULT_ACCEPTED'];
    default:
      return [];
  }
}

export function isResolvableStatus(status: TowerStatus): boolean {
  return RESOLVABLE_TOWER_STATUSES.includes(status);
}

/** Same rule as the backend detail: codes only while the status is resolvable. */
export function allowedCodesFor(
  ex: Pick<TowerException, 'status' | 'category' | 'allowedResolutionCodes'>,
): readonly TowerResolutionCode[] {
  if (ex.allowedResolutionCodes) return ex.allowedResolutionCodes;
  return isResolvableStatus(ex.status) ? resolutionCodesFor(ex.category) : [];
}
