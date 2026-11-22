import { FAKE_COMPANIES } from '../../../core/scope/scope.fake';
import {
  type FakeBulkModule,
  fakeSubmitBulkJob,
  registerFakeBulkModule,
} from '../../../shared/bulk-jobs/bulk-jobs.fake';
import type {
  BulkJob,
  BulkJobItem,
  BulkJobItemStatus,
  BulkJobSubmit,
  BulkJobSubmitResult,
} from '../../../shared/bulk-jobs/bulk-jobs.model';
import { ApiError, type TradeContext, fakeDelay } from '../shared/trade-api';
import { clone, nowIso } from '../shared/trade-foundation.fake';
import type { Page } from '../shared/trade-foundation.model';
import {
  FAKE_ME,
  type WriteOptions,
  checkIfMatch,
  fakeIdem,
  getFakeActor,
  requireIdempotencyKey,
  requireIfMatch,
} from './automation-fake-actors';
import { validateAutomationReason } from './automation-reasons.seed';
import {
  type BulkResolveExceptionsInput,
  type ListTowerExceptionsQuery,
  type ResolveExceptionInput,
  TOWER_CATEGORIES,
  TOWER_EVIDENCE_LIMITS,
  TOWER_SEVERITIES,
  TOWER_STATUSES,
  type TowerAttempt,
  type TowerCategory,
  type TowerCounts,
  type TowerCountsQuery,
  type TowerException,
  type TowerFilterQuery,
  type TowerResolutionCode,
  type TowerResolutionEvidence,
  type TowerSelectionQuery,
  type TowerSeverity,
  type TowerSource,
  type TowerStatus,
  isForbiddenEvidenceKey,
  isResolvableStatus,
  resolutionCodesFor,
} from './tower.model';

const idem = fakeIdem();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface StoredException {
  id: string;
  version: number;
  companyId: string | null;
  branchId: string | null; // null = company-level (or tenant-level) source
  category: TowerCategory;
  severity: TowerSeverity;
  status: TowerStatus;
  retryClass: string;
  safeErrorCode: string;
  correlationId: string;
  sourceOwner: string;
  sourceType: string;
  sourceId: string;
  sourceVersion: number;
  source: TowerSource;
  attempts: TowerAttempt[];
  resolutionReasonCode: string | null;
  resolutionReasonNote: string | null;
  resolutionEvidence: TowerResolutionEvidence;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function todayPrefixUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function todayUtcAt(hour: number, minute: number): string {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${todayPrefixUtc()}T${hh}:${mm}:00.000Z`;
}

function profileSource(id: string, profileId: string, label: string): TowerSource {
  return {
    type: 'DOCUMENT_PROFILE_VERSION',
    id,
    label,
    documentType: 'QUOTATION',
    link: { kind: 'DOCUMENT_PROFILE_VERSION', id, parentId: profileId },
  };
}

function quotationPdfSource(jobId: string, quotationId: string, number: string): TowerSource {
  return {
    type: 'QUOTATION_PDF_RENDER',
    id: jobId,
    label: number,
    documentType: 'QUOTATION',
    documentNumber: number,
    link: { kind: 'QUOTATION', id: quotationId },
  };
}

function businessPdfSource(
  jobId: string,
  documentType: string,
  documentId: string,
  number: string,
): TowerSource {
  const linkable = documentType === 'SALES_ORDER' || documentType === 'PURCHASE_ORDER';
  return {
    type: 'BUSINESS_PDF_RENDER',
    id: jobId,
    label: number,
    documentType,
    documentNumber: number,
    ...(linkable
      ? { link: { kind: documentType as 'SALES_ORDER' | 'PURCHASE_ORDER', id: documentId } }
      : {}),
  };
}

function attempt(
  n: number,
  ownerCode: string,
  source: TowerSource,
  status: string,
  attemptCount: number,
  lastErrorCode: string | null,
  nextAttemptAt: string | null = null,
): TowerAttempt {
  return {
    id: `att-${String(n).padStart(3, '0')}`,
    ownerCode,
    sourceType: source.type,
    sourceId: source.id,
    sourceVersion: 1,
    status,
    retryClass: 'TRANSIENT',
    attemptCount,
    nextAttemptAt,
    lastErrorCode,
    version: attemptCount,
    updatedAt: '2026-11-20T15:05:00.000Z',
  };
}

function seed(
  partial: Omit<
    StoredException,
    | 'sourceType'
    | 'sourceId'
    | 'sourceVersion'
    | 'retryClass'
    | 'sourceOwner'
    | 'resolutionReasonCode'
    | 'resolutionReasonNote'
    | 'resolutionEvidence'
    | 'resolvedAt'
    | 'attempts'
  > &
    Partial<StoredException>,
): StoredException {
  return {
    sourceType: partial.source.type,
    sourceId: partial.source.id,
    sourceVersion: 1,
    retryClass: 'MANUAL',
    sourceOwner: 'trade',
    attempts: [],
    resolutionReasonCode: null,
    resolutionReasonNote: null,
    resolutionEvidence: {},
    resolvedAt: null,
    ...partial,
  };
}

function buildSeedTowerExceptions(): StoredException[] {
  const tToday1 = todayUtcAt(8, 20);
  const tToday2 = todayUtcAt(9, 45);

  const s002 = quotationPdfSource('qpdf-0142', 'qt-2026-0142', 'QT-2026-0142');
  const s003 = businessPdfSource('bpdf-0089', 'SALES_ORDER', 'so-2026-0089', 'SO-2026-0089');
  const s004 = businessPdfSource('bpdf-0094', 'SALES_ORDER', 'so-2026-0094', 'SO-2026-0094');
  const s005 = businessPdfSource('bpdf-0077', 'PURCHASE_ORDER', 'po-2026-0077', 'PO-2026-0077');
  const s006 = quotationPdfSource('qpdf-0138', 'qt-2026-0138', 'QT-2026-0138');

  return [
    seed({
      id: 'ct-001',
      version: 1,
      companyId: 'c1',
      branchId: null,
      category: 'PROFILE_ACTIVATION_CONFLICT',
      severity: 'HIGH',
      status: 'OPEN',
      safeErrorCode: 'TRADE.DOCUMENT_PROFILE.EFFECTIVE_OVERLAP',
      correlationId: 'corr-ct-2026-0001',
      source: profileSource('profv-qt-3', 'prof-quotation-default', 'DEFAULT · v3'),
      createdAt: '2026-11-21T09:14:00.000Z',
      updatedAt: '2026-11-21T09:14:00.000Z',
    }),
    seed({
      id: 'ct-002',
      version: 1,
      companyId: 'c1',
      branchId: 'b1',
      category: 'RESULT_CONFLICT',
      severity: 'HIGH',
      status: 'OPEN',
      safeErrorCode: 'TRADE.DOCUMENT.DUPLICATE_ARTIFACT_CONFLICT',
      correlationId: 'corr-ct-2026-0002',
      source: s002,
      attempts: [attempt(1, 'template-renderer', s002, 'CONFLICT', 2, 'ARTIFACT_DIGEST_MISMATCH')],
      createdAt: '2026-11-20T16:40:00.000Z',
      updatedAt: '2026-11-20T16:42:00.000Z',
    }),
    seed({
      id: 'ct-003',
      version: 1,
      companyId: 'c1',
      branchId: 'b1',
      category: 'OWNER_TRANSPORT_EXHAUSTED',
      severity: 'CRITICAL',
      status: 'OPEN',
      retryClass: 'TRANSIENT',
      safeErrorCode: 'TRADE.OWNER.TRANSPORT_TIMEOUT',
      correlationId: 'corr-ct-2026-0003',
      source: s003,
      attempts: [
        attempt(2, 'accounting-ledger', s003, 'EXHAUSTED', 5, 'UPSTREAM_TIMEOUT'),
        attempt(3, 'inventory-reservation', s003, 'SUCCEEDED', 1, null),
      ],
      createdAt: '2026-11-20T14:15:00.000Z',
      updatedAt: '2026-11-20T15:05:00.000Z',
    }),
    seed({
      id: 'ct-004',
      version: 1,
      companyId: 'c1',
      branchId: 'b2',
      category: 'DATA_CORRECTION_REQUIRED',
      severity: 'HIGH',
      status: 'OPEN',
      safeErrorCode: 'TRADE.TAX.CLASSIFICATION_MISSING',
      correlationId: 'corr-ct-2026-0004',
      source: s004,
      attempts: [attempt(4, 'einvoice-bridge', s004, 'FAILED', 1, 'TAX_CODE_REQUIRED')],
      createdAt: '2026-11-19T11:30:00.000Z',
      updatedAt: '2026-11-19T11:31:00.000Z',
    }),
    seed({
      id: 'ct-005',
      version: 1,
      companyId: 'c2',
      branchId: 'b4',
      category: 'OWNER_TRANSPORT_EXHAUSTED',
      severity: 'HIGH',
      status: 'OPEN',
      retryClass: 'TRANSIENT',
      safeErrorCode: 'TRADE.OWNER.TRANSPORT_HTTP_503',
      correlationId: 'corr-ct-2026-0005',
      source: s005,
      attempts: [attempt(5, 'warehouse-dispatch', s005, 'EXHAUSTED', 4, 'SERVICE_UNAVAILABLE')],
      createdAt: '2026-11-18T08:50:00.000Z',
      updatedAt: '2026-11-18T09:10:00.000Z',
    }),
    seed({
      id: 'ct-006',
      version: 1,
      companyId: 'c2',
      branchId: 'b4',
      category: 'OWNER_TRANSPORT_EXHAUSTED',
      severity: 'HIGH',
      status: 'ACTION_PENDING',
      retryClass: 'TRANSIENT',
      safeErrorCode: 'TRADE.OWNER.TRANSPORT_RATE_LIMITED',
      correlationId: 'corr-ct-2026-0006',
      source: s006,
      attempts: [
        attempt(6, 'crm-sync', s006, 'RETRY_SCHEDULED', 2, 'TOO_MANY_REQUESTS', '2026-11-21T11:15:00.000Z'),
      ],
      createdAt: '2026-11-21T07:05:00.000Z',
      updatedAt: '2026-11-21T07:10:00.000Z',
    }),
    seed({
      id: 'ct-007',
      version: 2,
      companyId: 'c1',
      branchId: 'b2',
      category: 'DATA_CORRECTION_REQUIRED',
      severity: 'HIGH',
      status: 'RESOLVED',
      safeErrorCode: 'TRADE.ACCOUNT.PARTY_REFERENCE_INACTIVE',
      correlationId: 'corr-ct-2026-0007',
      // Invoice PDFs carry a number and type but no supported link kind.
      source: businessPdfSource('bpdf-0115', 'INVOICE', 'inv-2026-0115', 'INV-2026-0115'),
      resolutionReasonCode: 'SOURCE_FIXED',
      resolutionReasonNote: 'Updated commercial account reference.',
      resolutionEvidence: {
        resolutionCode: 'SOURCE_CORRECTED',
        reasonCode: 'SOURCE_FIXED',
        note: 'Updated commercial account reference.',
        evidence: { ticket: 'INC-0107' },
        resolvedBy: FAKE_ME,
      },
      resolvedAt: tToday1,
      createdAt: '2026-11-20T10:15:00.000Z',
      updatedAt: tToday1,
    }),
    seed({
      id: 'ct-008',
      version: 2,
      companyId: 'c2',
      branchId: null,
      category: 'PROFILE_ACTIVATION_CONFLICT',
      severity: 'HIGH',
      status: 'RESOLVED',
      safeErrorCode: 'TRADE.DOCUMENT_PROFILE.EFFECTIVE_OVERLAP',
      correlationId: 'corr-ct-2026-0008',
      source: profileSource('profv-qt-2', 'prof-quotation-default', 'DEFAULT · v2'),
      resolutionReasonCode: 'SOURCE_FIXED',
      resolutionReasonNote: 'Set end date on prior version.',
      resolutionEvidence: {
        resolutionCode: 'SOURCE_CORRECTED',
        reasonCode: 'SOURCE_FIXED',
        note: 'Set end date on prior version.',
        evidence: { ticket: 'INC-0108' },
        resolvedBy: FAKE_ME,
      },
      resolvedAt: tToday2,
      createdAt: '2026-11-19T15:40:00.000Z',
      updatedAt: tToday2,
    }),
    seed({
      id: 'ct-009',
      version: 1,
      companyId: null, // tenant-level row: visible only in the tenant context
      branchId: null,
      category: 'DATA_CORRECTION_REQUIRED',
      severity: 'WARNING',
      status: 'ACKNOWLEDGED',
      safeErrorCode: 'TRADE.DATA_CORRECTION_REQUIRED',
      correlationId: 'corr-ct-2026-0009',
      // A missing source: label null and no link.
      source: { type: 'DOCUMENT_PROFILE_VERSION', id: 'profv-missing', label: null },
      createdAt: '2026-11-17T12:00:00.000Z',
      updatedAt: '2026-11-17T12:00:00.000Z',
    }),
    seed({
      id: 'ct-010',
      version: 1,
      companyId: 'c1',
      branchId: 'b3',
      category: 'OWNER_TRANSPORT_EXHAUSTED',
      severity: 'INFO',
      status: 'QUARANTINED',
      safeErrorCode: 'TRADE.OWNER.CALLBACK_REJECTED',
      correlationId: 'corr-ct-2026-0010',
      source: businessPdfSource('bpdf-0061', 'CONTRACT', 'ct-2026-0061', 'CT-2026-0061'),
      createdAt: '2026-11-16T10:00:00.000Z',
      updatedAt: '2026-11-16T10:00:00.000Z',
    }),
  ];
}

const DB: { exceptions: StoredException[] } = {
  exceptions: buildSeedTowerExceptions(),
};

/** Same as the backend safeException: evidence and its note only for the recorded resolver. */
function toExceptionDto(ex: StoredException, detail: boolean): TowerException {
  const visible = ex.status === 'RESOLVED' && ex.resolutionEvidence.resolvedBy === getFakeActor();
  return {
    id: ex.id,
    version: ex.version,
    companyId: ex.companyId,
    branchId: ex.branchId,
    sourceOwner: ex.sourceOwner,
    sourceType: ex.sourceType,
    sourceId: ex.sourceId,
    sourceVersion: ex.sourceVersion,
    category: ex.category,
    severity: ex.severity,
    status: ex.status,
    retryClass: ex.retryClass,
    safeErrorCode: ex.safeErrorCode,
    intentKey: null,
    correlationId: ex.correlationId,
    assignedUserId: null,
    resolvedAt: ex.resolvedAt,
    resolutionReasonCode: ex.resolutionReasonCode,
    resolutionReasonNote: visible ? ex.resolutionReasonNote : undefined,
    resolutionEvidence: visible ? clone(ex.resolutionEvidence) : undefined,
    source: clone(ex.source),
    ...(detail
      ? {
          allowedResolutionCodes: isResolvableStatus(ex.status) ? resolutionCodesFor(ex.category) : [],
          attempts: clone(ex.attempts),
        }
      : {}),
    createdAt: ex.createdAt,
    updatedAt: ex.updatedAt,
  };
}

function requireException(id: string): StoredException {
  const found = DB.exceptions.find((e) => e.id === id);
  if (!found) {
    throw new ApiError(404, 'TRADE.CONTROL_TOWER.NOT_FOUND');
  }
  return found;
}

function resolutionInvalid(reason: string): never {
  throw new ApiError(422, 'TRADE.CONTROL_TOWER.RESOLUTION_INVALID', { reason: [reason] });
}

function utf8ByteLength(value: unknown): number {
  const json = JSON.stringify(value) ?? '';
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(json).length;
  }
  return json.length;
}

function measureEvidenceNode(value: unknown, depth: number): void {
  if (depth > TOWER_EVIDENCE_LIMITS.maxDepth) resolutionInvalid('evidence_invalid');
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    if (value.length > TOWER_EVIDENCE_LIMITS.maxKeys) resolutionInvalid('evidence_invalid');
    for (const item of value) measureEvidenceNode(item, depth + 1);
    return;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > TOWER_EVIDENCE_LIMITS.maxKeys) resolutionInvalid('evidence_invalid');
  for (const [k, v] of entries) {
    if (isForbiddenEvidenceKey(k)) resolutionInvalid('evidence_invalid');
    measureEvidenceNode(v, depth + 1);
  }
}

function validateEvidence(evidence: Record<string, unknown> | undefined | null): void {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    resolutionInvalid('evidence_invalid');
  }
  if (Object.keys(evidence).length < TOWER_EVIDENCE_LIMITS.minKeys) resolutionInvalid('evidence_invalid');
  measureEvidenceNode(evidence, 1);
  if (utf8ByteLength(evidence) > TOWER_EVIDENCE_LIMITS.maxBytes) resolutionInvalid('evidence_invalid');
}

/** The DTO is forbidNonWhitelisted: only resolutionCode, reasonCode, note, reason, evidence. */
const RESOLVE_BODY_KEYS: ReadonlySet<string> = new Set([
  'resolutionCode',
  'reasonCode',
  'note',
  'reason',
  'evidence',
]);

function assertResolveBodyShape(body: unknown): void {
  if (!body || typeof body !== 'object') throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  for (const key of Object.keys(body)) {
    if (!RESOLVE_BODY_KEYS.has(key)) throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
}

// ---------------------------------------------------------------------------
// Scope (control-tower-query.ts): the context decides the rows, branchId/includeBranches narrow.
// ---------------------------------------------------------------------------

/** Active, not deleted branches of the company: the only ones a branchId filter may name. */
function companyBranchIds(companyId: string): readonly string[] {
  return FAKE_COMPANIES.find((c) => c.id === companyId)?.branches.map((b) => b.id) ?? [];
}

function scopeDenied(reason: string): ApiError {
  return new ApiError(403, 'TRADE.CONTROL_TOWER.SCOPE_DENIED', { reason: [reason] });
}

/** Same order as assertBranchFilter + assertExceptionQueryScope in the backend. */
function assertScopeFilter(ctx: TradeContext, q: TowerFilterQuery): void {
  // companyId is never a query parameter (forbidNonWhitelisted): the company comes from the context.
  if ('companyId' in q) throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  const companyContext = !!ctx.companyId && !ctx.branchId;
  if (q.branchId && !companyContext) throw scopeDenied('branch_filter_requires_company');
  if (q.includeBranches && !companyContext) throw scopeDenied('include_branches_requires_company');
  // A foreign, missing, inactive or deleted branch is one answer, so its existence never leaks.
  if (q.branchId && !companyBranchIds(ctx.companyId as string).includes(q.branchId)) {
    throw scopeDenied('branch_not_accessible');
  }
  if (q.createdFrom && q.createdTo && Date.parse(q.createdFrom) > Date.parse(q.createdTo)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { reason: ['date_range_invalid'] });
  }
}

function inScope(ex: StoredException, ctx: TradeContext, q: TowerFilterQuery): boolean {
  if (!ctx.companyId) return ex.companyId === null && ex.branchId === null;
  if (ex.companyId !== ctx.companyId) return false;
  if (ctx.branchId) return ex.branchId === ctx.branchId;
  if (q.branchId) return ex.branchId === q.branchId;
  return q.includeBranches ? true : ex.branchId === null;
}

const SEVERITY_ORDER: Record<TowerSeverity, number> = { CRITICAL: 0, HIGH: 1, WARNING: 2, INFO: 3 };

function filterExceptions(ctx: TradeContext, q: TowerSelectionQuery): StoredException[] {
  assertScopeFilter(ctx, q);
  const statuses = q.status?.length ? new Set(q.status) : null;
  return DB.exceptions
    .filter((ex) => {
      if (!inScope(ex, ctx, q)) return false;
      if (statuses && !statuses.has(ex.status)) return false;
      if (q.severity && ex.severity !== q.severity) return false;
      if (q.category && ex.category !== q.category) return false;
      if (q.sourceType && ex.sourceType !== q.sourceType) return false;
      if (q.createdFrom && ex.createdAt < q.createdFrom) return false;
      if (q.createdTo && ex.createdAt > q.createdTo) return false;
      return true;
    })
    .slice()
    .sort((a, b) => {
      if (q.sort === 'severity') {
        const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        if (bySeverity !== 0) return bySeverity;
      }
      const cmp = b.createdAt.localeCompare(a.createdAt);
      return cmp !== 0 ? cmp : b.id.localeCompare(a.id);
    });
}

function applyResolveToStored(
  ex: StoredException,
  input: { resolutionCode: TowerResolutionCode; evidence: Record<string, unknown> },
  reasonCode: string,
  note: string,
): void {
  if (!isResolvableStatus(ex.status)) {
    throw new ApiError(409, 'TRADE.CONTROL_TOWER.RESOLUTION_CONFLICT');
  }
  if (ex.attempts.some((a) => a.status === 'IN_PROGRESS' || a.status === 'RETRYING')) {
    throw new ApiError(409, 'TRADE.CONTROL_TOWER.RETRY_IN_PROGRESS', { reason: ['attempt_in_progress'] });
  }
  if (!resolutionCodesFor(ex.category).includes(input.resolutionCode)) {
    resolutionInvalid('category_not_resolvable');
  }
  if (input.resolutionCode === 'RESULT_ACCEPTED') {
    const kept = input.evidence['keptArtifactId'];
    if (typeof kept !== 'string' || !UUID_RE.test(kept)) resolutionInvalid('evidence_invalid');
  }

  const now = nowIso();
  ex.status = 'RESOLVED';
  ex.resolutionReasonCode = reasonCode;
  ex.resolutionReasonNote = note || null;
  ex.resolutionEvidence = {
    resolutionCode: input.resolutionCode,
    reasonCode,
    ...(note ? { note } : {}),
    evidence: clone(input.evidence),
    resolvedBy: getFakeActor(),
  };
  ex.resolvedAt = now;
  ex.version += 1;
  ex.updatedAt = now;
}

function emptyBuckets<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

// ---------------------------------------------------------------------------
// Register trading.control-tower-exceptions FakeBulkModule (trade-control-tower-bulk.handler.ts)
// ---------------------------------------------------------------------------

function contextOf(scope: BulkJobSubmit['scope']): TradeContext {
  return {
    ...(scope.companyId ? { companyId: scope.companyId } : {}),
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
  };
}

function itemLabel(ex: StoredException): string {
  return `${ex.category} · ${ex.source.label ?? ex.sourceType}`.slice(0, 200);
}

const CONTROL_TOWER_BULK_MODULE: FakeBulkModule = {
  module: 'trading.control-tower-exceptions',

  chunkSize(): number {
    return 100;
  },

  validate(body: BulkJobSubmit): void {
    if (body.action !== 'RESOLVE') {
      throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
    }
    if (!body.scope.companyId) {
      // scopeRule = COMPANY
      throw new ApiError(403, 'TRADE.CONTROL_TOWER.SCOPE_DENIED');
    }
    assertResolveBodyShape(body.params);
    const params = body.params as Partial<ResolveExceptionInput>;
    if (!params.resolutionCode) {
      throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
    }
    validateAutomationReason('CONTROL_TOWER_RESOLVE', params.reasonCode, params.note);
    validateEvidence(params.evidence);
  },

  async resolve(body: BulkJobSubmit) {
    const params = body.params as ResolveExceptionInput;
    const ctx = contextOf(body.scope);
    const filters: TowerSelectionQuery =
      body.selection.kind === 'QUERY'
        ? ((body.selection.query ?? {}) as TowerSelectionQuery)
        : { includeBranches: !ctx.branchId };

    let targets = filterExceptions(ctx, filters);
    if (body.selection.kind === 'IDS') {
      const byId = new Map(targets.map((ex) => [ex.id, ex]));
      // Out-of-scope or missing ids reject the whole submit, as in the backend.
      if (body.selection.ids.some((id) => !byId.has(id))) {
        throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
      }
      targets = body.selection.ids.map((id) => byId.get(id) as StoredException);
    } else if (body.selection.excludedIds?.length) {
      const excluded = new Set(body.selection.excludedIds);
      targets = targets.filter((ex) => !excluded.has(ex.id));
    }

    return targets.map((ex) => ({
      entityId: ex.id,
      label: itemLabel(ex),
      // Selection snapshot: the worker re-reads each row through the same branch filter.
      data: {
        includeBranches: filters.branchId || filters.includeBranches ? 1 : 0,
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
      },
      ...(ex.status === 'RESOLVED'
        ? { preStatus: 'SKIPPED' as const, code: 'ALREADY_RESOLVED' }
        : !isResolvableStatus(ex.status) ||
            !resolutionCodesFor(ex.category).includes(params.resolutionCode)
          ? { preStatus: 'SKIPPED' as const, code: 'CATEGORY_NOT_RESOLVABLE' }
          : {}),
    }));
  },

  async executeChunk(
    job: BulkJob,
    rawParams: unknown,
    items: BulkJobItem[],
  ): Promise<{ ordinal: number; status: BulkJobItemStatus; code?: string }[]> {
    const params = rawParams as ResolveExceptionInput;
    const { reasonCode, reasonNote } = validateAutomationReason(
      'CONTROL_TOWER_RESOLVE',
      params.reasonCode,
      params.note,
    );
    const ctx = contextOf(job.scope);

    const results: { ordinal: number; status: BulkJobItemStatus; code?: string }[] = [];
    for (const item of items) {
      const includeBranches = item.data?.['includeBranches'] === 1;
      const rawBranch = item.data?.['branchId'];
      const branchId = typeof rawBranch === 'string' ? rawBranch : undefined;
      try {
        assertScopeFilter(ctx, { branchId });
      } catch (err) {
        // The branch was deactivated or deleted after submit: the item fails with the backend code.
        results.push({ ordinal: item.ordinal, status: 'FAILED', code: (err as ApiError).code });
        continue;
      }
      const ex = DB.exceptions.find(
        (e) => e.id === item.entityId && inScope(e, ctx, { includeBranches, branchId }),
      );
      if (!ex) {
        results.push({ ordinal: item.ordinal, status: 'SKIPPED', code: 'TRADE.CONTROL_TOWER.NOT_FOUND' });
        continue;
      }
      if (ex.status === 'RESOLVED') {
        results.push({ ordinal: item.ordinal, status: 'UNCHANGED', code: 'ALREADY_RESOLVED' });
        continue;
      }
      if (!isResolvableStatus(ex.status) || !resolutionCodesFor(ex.category).includes(params.resolutionCode)) {
        results.push({ ordinal: item.ordinal, status: 'SKIPPED', code: 'CATEGORY_NOT_RESOLVABLE' });
        continue;
      }
      try {
        applyResolveToStored(ex, params, reasonCode, reasonNote);
        results.push({ ordinal: item.ordinal, status: 'SUCCEEDED' });
      } catch (err) {
        const code = err instanceof ApiError ? err.code : 'TRADE.CONTROL_TOWER.RESOLUTION_INVALID';
        results.push({ ordinal: item.ordinal, status: 'FAILED', code });
      }
    }

    return results;
  },

  async current(entityIds: string[]) {
    return new Map(
      DB.exceptions
        .filter((ex) => entityIds.includes(ex.id))
        .map((ex) => [ex.id, { status: ex.status }] as const),
    );
  },

  paramsSummary(body: BulkJobSubmit): Record<string, string | number | null> {
    const params = body.params as Partial<ResolveExceptionInput> | null;
    return {
      resolutionCode: params?.resolutionCode ?? null,
      reasonCode: params?.reasonCode ?? null,
    };
  },
};

registerFakeBulkModule('trading', CONTROL_TOWER_BULK_MODULE);

/** Same as the backend reportRoute(jobId). */
export function towerBulkReportRoute(jobId: string): string {
  return `/trade/automation/control-tower?job=${jobId}`;
}

function mapBulkError(err: unknown): never {
  if (err && typeof err === 'object' && 'code' in err && 'status' in err) {
    const raw = err as { status: number; code: string; details?: Record<string, string[]> };
    if (raw.code === 'BULK_JOB_ACTIVE') {
      throw new ApiError(409, 'TRADE.BULK_JOB.ACTIVE', raw.details);
    }
    throw new ApiError(raw.status, raw.code, raw.details);
  }
  throw err;
}

// ---------------------------------------------------------------------------
// Public Fake API Functions
// ---------------------------------------------------------------------------

/** One aggregate over the same scope and filters as the list, never filtered by status. */
export async function fakeGetTowerCounts(
  ctx: TradeContext,
  q: TowerCountsQuery = {},
): Promise<TowerCounts> {
  await fakeDelay(120);
  if ('status' in q || 'page' in q || 'limit' in q) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }

  const today = todayPrefixUtc();
  const byStatus = emptyBuckets(TOWER_STATUSES);
  const bySeverity = emptyBuckets(TOWER_SEVERITIES);
  const byCategory = emptyBuckets(TOWER_CATEGORIES);
  let resolvedToday = 0;

  const scoped = filterExceptions(ctx, { ...q, sort: undefined });
  for (const ex of scoped) {
    byStatus[ex.status] += 1;
    bySeverity[ex.severity] += 1;
    byCategory[ex.category] += 1;
    if (ex.status === 'RESOLVED' && ex.resolvedAt?.slice(0, 10) === today) resolvedToday += 1;
  }

  return { total: scoped.length, byStatus, bySeverity, byCategory, resolvedToday };
}

export async function fakeListTowerExceptions(
  ctx: TradeContext,
  q: ListTowerExceptionsQuery = {},
): Promise<Page<TowerException> & { asOf: string }> {
  await fakeDelay();

  const page = q.page ?? 1;
  const limit = q.limit ?? 25;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  if (q.status && (q.status.length < 1 || q.status.length > 6)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }

  const filtered = filterExceptions(ctx, q);
  const total = filtered.length;
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit).map((ex) => toExceptionDto(ex, false));

  return clone({ items, total, page, limit, asOf: nowIso() });
}

/** Specs: the stored version of an exception (1 when unknown), read without the fake delay. */
export function fakeTowerExceptionVersion(id: string): number {
  return DB.exceptions.find((e) => e.id === id)?.version ?? 1;
}

export async function fakeGetTowerException(id: string): Promise<TowerException> {
  await fakeDelay();
  return clone(toExceptionDto(requireException(id), true));
}

export async function fakeResolveTowerException(
  id: string,
  input: ResolveExceptionInput,
  opts: WriteOptions = {},
): Promise<TowerException> {
  await fakeDelay();
  assertResolveBodyShape(input);
  const key = requireIdempotencyKey(opts.idempotencyKey);
  const expected = requireIfMatch(opts.ifMatch);

  return idem.run(
    `tower:resolve:${id}`,
    key,
    { id, input, expected },
    () => {
      const ex = requireException(id);
      checkIfMatch(expected, ex.version);

      const { reasonCode, reasonNote } = validateAutomationReason(
        'CONTROL_TOWER_RESOLVE',
        input.reasonCode,
        input.note,
      );
      validateEvidence(input.evidence);
      applyResolveToStored(ex, input, reasonCode, reasonNote);

      return toExceptionDto(ex, true);
    },
  );
}

export async function fakeBulkResolveTowerExceptions(
  ctx: TradeContext,
  input: BulkResolveExceptionsInput,
  idempotencyKey?: string,
): Promise<BulkJobSubmitResult> {
  const key = requireIdempotencyKey(idempotencyKey);
  return idem.runAsync('tower:bulkResolve', key, { ctx, input }, async () => {
    const body: BulkJobSubmit = {
      module: 'trading.control-tower-exceptions',
      action: 'RESOLVE',
      scope: {
        ...(ctx.companyId ? { companyId: ctx.companyId } : {}),
        ...(ctx.branchId ? { branchId: ctx.branchId } : {}),
      },
      selection: input.selection,
      params: {
        resolutionCode: input.resolutionCode,
        reasonCode: input.reasonCode,
        ...(input.note ? { note: input.note } : {}),
        evidence: input.evidence,
      },
    };

    try {
      return await fakeSubmitBulkJob('trading', body, key);
    } catch (err) {
      mapBulkError(err);
    }
  });
}
