export const AUDIT_SOURCE_APPS = [
  'CORE',
  'CRM',
  'TRADE',
  'WORKER',
  'GATEWAY',
  'REALTIME',
  'ACCOUNTING',
  'HR',
] as const;

export type AuditSourceApp = (typeof AUDIT_SOURCE_APPS)[number];

export const AUDIT_SOURCE_KINDS = [
  'HTTP_COMMAND',
  'DOMAIN_MUTATION',
  'BROKER_CONSUMER',
  'CRON_JOB',
  'DB_FALLBACK',
  'SECURITY_EVENT',
] as const;

export type AuditSourceKind = (typeof AUDIT_SOURCE_KINDS)[number];

export const AUDIT_OUTCOMES = ['SUCCESS', 'FAILURE'] as const;

export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

export const AUDIT_SENSITIVITIES = ['LOW', 'NORMAL', 'HIGH'] as const;

export type AuditSensitivity = (typeof AUDIT_SENSITIVITIES)[number];

export type AuditViewMode = 'all' | 'deleted';

export interface AuditDiffItem {
  field: string;
  before: unknown;
  after: unknown;
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  actorUserId: string | null;
  actorType: string;
  actorLabel: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: AuditDiffItem[] | null;
  changedFields: string[] | null;
  correlationId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  schemaVersion: number | null;
  sourceApp: AuditSourceApp | null;
  sourceKind: AuditSourceKind | null;
  outcome: AuditOutcome | null;
  sensitivity: AuditSensitivity | null;
  branchId: string | null;
  subjectOwnerUserId: string | null;
  entityLabel: string | null;
  onBehalfOfUserId: string | null;
  sourceEventId: string | null;
  requestId: string | null;
  operationId: string | null;
  idempotencyKey: string | null;
  reason: string | null;
  createdAt: string;
}

export interface AuditQuery {
  cursor?: string;
  limit?: number;
  entityType?: string;
  entityId?: string;
  action?: string;
  actorUserId?: string;
  correlationId?: string;
  branchId?: string;
  ownerUserId?: string;
  sourceApp?: AuditSourceApp;
  sourceKind?: AuditSourceKind;
  includeRequests?: boolean;
  outcome?: AuditOutcome;
  sensitivity?: AuditSensitivity;
  from?: string;
  to?: string;
  /** Only `DELETE` and `SOFT_DELETE` events (`TenantAuditQueryDto.deletedOnly`). */
  deletedOnly?: boolean;
  /** Literal, case-sensitive stored label prefix (max 256). 400 `AUDIT_QUERY_INVALID` unless `deletedOnly` is true. */
  q?: string;
}

export type AuditDeletedQuery = AuditQuery;

export interface AuditPage {
  items: AuditEvent[];
  nextCursor: string | null;
}

/** `HISTORY_SUBJECT_CATEGORIES` in `core-app/src/tenant/audit/related-history-priority.ts`. */
export const AUDIT_HISTORY_CATEGORIES = [
  'lead',
  'contact',
  'quotation',
  'salesOrder',
  'invoice',
  'activity',
] as const;

export type AuditHistoryCategory = (typeof AUDIT_HISTORY_CATEGORIES)[number];

export type AuditHistorySubjectKind = AuditHistoryCategory | 'note' | 'attachment' | 'record';

/** `GET tenant/audit/entities/:entityType/:entityId` with related parties: grouped response. */
export interface AuditRelatedHistoryQuery extends AuditQuery {
  /** 1 to 21 unique UUIDv7 party IDs, sent comma-separated. */
  relatedPartyIds: readonly string[];
  /** Accepted only together with `relatedPartyIds`. */
  historyCategory?: AuditHistoryCategory;
}

export interface AuditHistoryChange {
  field: string;
  before: unknown;
  after: unknown;
  subjectId?: string;
  subjectLabel?: string;
}

/** One grouped history row (`relatedHistoryView` in `related-history.view.ts`). */
export interface AuditHistoryGroup {
  id: string;
  action: string;
  subjectKind: AuditHistorySubjectKind;
  subjectId: string | null;
  referenceLabel: string | null;
  createdAt: string;
  actorLabel: string | null;
  actorType: string;
  outcome: AuditOutcome | null;
  reason: string | null;
  diff: AuditHistoryChange[];
}

export interface AuditHistoryPage {
  items: AuditHistoryGroup[];
  nextCursor: string | null;
}

/** `RecordHistoryParamDto`: only CRM leads are supported. */
export interface RecordHistoryTarget {
  targetApp: 'CRM';
  targetType: 'LEAD';
  targetId: string;
}

/** `RecordHistoryQueryDto`: no subject or audit-wide scope filters by design. */
export interface RecordHistoryQuery {
  cursor?: string;
  limit?: number;
  historyCategory?: AuditHistoryCategory;
}

export const AUDIT_LIMITS = {
  cursor: 512,
  minLimit: 1,
  maxLimit: 100,
  defaultLimit: 25,
  entityType: 128,
  entityId: 512,
  action: 64,
  deletedQueryPrefix: 256,
  maxRelatedPartyIds: 21,
  maxRangeDays: 92,
  defaultRangeDays: 7,
  maxExportRows: 500_000,
} as const;

export const AUDIT_EXPORT_STATUSES = ['QUEUED', 'RUNNING', 'READY', 'FAILED', 'EXPIRED'] as const;

export type AuditExportStatus = (typeof AUDIT_EXPORT_STATUSES)[number];

export type AuditExportFilters = Omit<AuditQuery, 'cursor' | 'limit'>;

export interface AuditExportReceipt {
  exportId: string;
  status: 'QUEUED';
}

export interface AuditExportJob {
  status: AuditExportStatus;
  rowsWritten: number;
  fileName: string;
  sizeBytes: number;
  expiresAt: string | null;
  errorCode?: string;
  details?: Record<string, string[]>;
  correlationId?: string;
}

export interface AuditExportFilterSummaryItem {
  label: string;
  value: string;
  ltr?: boolean;
}

export interface AuditExportContext {
  query: AuditExportFilters;
  dateRangeLabel: string;
  filters: readonly AuditExportFilterSummaryItem[];
}

const AUDIT_EXPORT_ERROR_KEYS: Readonly<Record<string, string>> = {
  AUDIT_EXPORT_LIMIT_EXCEEDED: 'wsAudit.errors.AUDIT_EXPORT_LIMIT_EXCEEDED',
  AUDIT_EXPORT_STALLED: 'wsAudit.errors.AUDIT_EXPORT_STALLED',
  AUDIT_EXPORT_FORBIDDEN: 'wsAudit.errors.AUDIT_EXPORT_FORBIDDEN',
  AUDIT_EXPORT_EXPIRED: 'wsAudit.errors.AUDIT_EXPORT_EXPIRED',
  AUDIT_EXPORT_RANGE_INVALID: 'wsAudit.errors.AUDIT_EXPORT_RANGE_INVALID',
  AUDIT_EXPORT_IN_PROGRESS: 'wsAudit.errors.AUDIT_EXPORT_IN_PROGRESS',
};

export function auditExportErrorKey(code: string | null | undefined): string {
  return (code && AUDIT_EXPORT_ERROR_KEYS[code]) || 'wsAudit.errors.exportFailed';
}

const AVATAR_TONES = [
  'bg-icon-blue',
  'bg-icon-navy',
  'bg-icon-teal',
  'bg-icon-green',
  'bg-icon-orange',
  'bg-icon-red',
  'bg-icon-violet',
  'bg-icon-gray',
] as const;

export function humanizeActionCode(code: string): string {
  const words = code
    .trim()
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase());
  if (words.length === 0) return code;
  const joined = words.join(' ');
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function areValuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!areValuesEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, key)) return false;
    if (!areValuesEqual(objA[key], objB[key])) return false;
  }
  return true;
}

export function computeEventDiff(
  event: Pick<AuditEvent, 'diff' | 'before' | 'after'>,
): AuditDiffItem[] {
  if (Array.isArray(event.diff) && event.diff.length > 0) {
    return event.diff;
  }
  const beforeObj = isPlainRecord(event.before) ? event.before : null;
  const afterObj = isPlainRecord(event.after) ? event.after : null;
  if (!beforeObj && !afterObj) return [];

  const keys: string[] = [];
  const seen = new Set<string>();
  for (const key of Object.keys(beforeObj ?? {})) {
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }
  for (const key of Object.keys(afterObj ?? {})) {
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }

  const rows: AuditDiffItem[] = [];
  for (const field of keys) {
    const beforeVal = beforeObj ? (beforeObj[field] ?? null) : null;
    const afterVal = afterObj ? (afterObj[field] ?? null) : null;
    if (!areValuesEqual(beforeVal, afterVal)) {
      rows.push({ field, before: beforeVal, after: afterVal });
    }
  }
  return rows;
}

export function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

export function avatarToneForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export function formatAuditDateTime(iso: string, language: 'ar' | 'en'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const locale = `${language}-u-nu-latn`;
  const datePart = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
  const timePart = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${datePart} · ${timePart}`;
}

export function correlationIdOf(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const direct = (error as { correlationId?: unknown }).correlationId;
  if (typeof direct === 'string' && direct) return direct;
  const details = (error as { details?: unknown }).details;
  if (typeof details === 'object' && details !== null) {
    const nested = (details as { correlationId?: unknown }).correlationId;
    if (typeof nested === 'string' && nested) return nested;
  }
  return null;
}
