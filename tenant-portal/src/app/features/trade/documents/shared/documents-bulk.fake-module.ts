import {
  fakeGetBulkJob,
  fakeListBulkJobItems,
  registerFakeBulkModule,
  type FakeBulkModule,
} from '../../../../shared/bulk-jobs/bulk-jobs.fake';
import {
  BULK_JOB_LIMITS,
  isBulkJobActive,
  type BulkJob,
  type BulkJobItem,
  type BulkJobItemStatus,
  type BulkJobSubmit,
} from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { ApiError, errorCodeOf } from '../../shared/trade-api';
import type { ReasonKind } from '../../shared/trade-foundation.model';
import { KIND_CONFIG } from './document-kinds';
import type { DocumentKind, ListQuery, PrintLocale } from './document.model';
import {
  fakeCancelPurchaseQuotation,
  fakeGetDocumentForBulk,
  fakeIssuePurchaseQuotation,
  fakeListPrintTemplates,
  fakeProjectCurrentDocuments,
  fakePurchaseOrderAction,
  fakeQuotationAction,
  fakeRenderPdf,
  fakeSalesOrderAction,
  fakeSelectDocumentsForBulk,
  fakeValidateReasonForBulk,
  notifyDocumentKindMutated,
  type BulkPrintArtifact,
  type ReasonInput,
} from './documents.fake';

// Follows trade-app src/modules/documents/bulk: trade-documents-bulk.handler.ts, trade-documents-bulk.schemas.ts,
// trade-documents-bulk-render.service.ts, document-bulk-prints.service.ts and document-bulk-zip.ts.

interface ResolvedDocBulkItem {
  entityId: string;
  label: string;
  preStatus?: 'SKIPPED' | 'FAILED';
  code?: string;
}

interface ChunkResult {
  ordinal: number;
  status: BulkJobItemStatus;
  code?: string;
  field?: string;
  refId?: string;
}

type ParamsShape = 'empty' | 'reason' | 'print';

/** DOCUMENT_BULK_CONFIG permissions: the actions each handler registers, with the params schema each uses. */
const ACTION_PARAMS: Readonly<Record<DocumentKind, Readonly<Record<string, ParamsShape>>>> = {
  quotation: { SEND: 'empty', CANCEL: 'reason', PRINT: 'print' },
  'sales-order': { HOLD: 'reason', RELEASE_HOLD: 'reason', CANCEL: 'reason', PRINT: 'print' },
  'purchase-order': { SUBMIT: 'empty', CANCEL: 'reason', PRINT: 'print' },
  'purchase-quotation': { ISSUE: 'empty', CANCEL: 'reason', PRINT: 'print' },
};

const REASON_KIND_FOR_BULK_ACTION: Readonly<Record<string, ReasonKind>> = {
  CANCEL: 'DOCUMENT_CANCEL',
  HOLD: 'DOCUMENT_HOLD',
  RELEASE_HOLD: 'DOCUMENT_HOLD_RELEASE',
};

/** Only state-transition refusals are SKIPPED; validation, policy and infrastructure failures stay FAILED. */
const TRANSITION_CODES: ReadonlySet<string> = new Set([
  'TRADE.QUOTE.TRANSITION_NOT_ALLOWED',
  'TRADE.SALES_ORDER.HOLD_TRANSITION_INVALID',
  'TRADE.SALES_ORDER.CANCEL_NOT_ALLOWED',
  'TRADE.PURCHASE_ORDER.CANCEL_NOT_ALLOWED',
  'TRADE.PURCHASE_QUOTATION.CANCEL_NOT_ALLOWED',
  'TRADE.PURCHASE_QUOTATION.DRAFT_NOT_MUTABLE',
]);

/** DOCUMENT_LIST_STATUSES in document-list-query.ts. */
const LIST_STATUSES: Readonly<Record<DocumentKind, readonly string[]>> = {
  quotation: ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'CONVERTED', 'EXPIRED'],
  'sales-order': ['DRAFT', 'CONFIRMED', 'CANCELLED', 'CLOSED'],
  'purchase-order': ['DRAFT', 'CONFIRMED', 'CANCELLED', 'CLOSED'],
  'purchase-quotation': ['DRAFT', 'ISSUED', 'CONVERTED', 'CANCELLED'],
};

const QUERY_KEYS: readonly string[] = [
  'partyId',
  'search',
  'currencyCode',
  'crmOpportunityId',
  'businessDateFrom',
  'businessDateTo',
  'status',
  'sort',
  'order',
];
const PARAM_KEYS: Readonly<Record<ParamsShape, readonly string[]>> = {
  empty: [],
  reason: ['reasonCode', 'reasonNote'],
  print: ['templateVersionId', 'templateChoice', 'locale'],
};
const PO_SUBMITTABLE_APPROVAL: ReadonlySet<string> = new Set(['NOT_REQUIRED', 'REJECTED', 'WITHDRAWN']);
const SORT_FIELDS: ReadonlySet<string> = new Set(['createdAt', 'updatedAt', 'businessDate', 'documentNumber', 'grandTotal']);
const LOCALE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** MAX_SIZE_BYTES[BUCKETS.TEMPLATE_RENDER]: the whole ZIP, headers and directory included. */
export const BULK_PRINT_ZIP_MAX_BYTES = 25 * 1024 * 1024;
/** The artifact route signs a fresh URL for 300 seconds on every call. */
const ARTIFACT_URL_TTL_MS = 300 * 1000;
// Valid 22-byte empty PKZIP End of Central Directory archive.
const ZIP_DATA_URL = 'data:application/zip;base64,UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==';

/**
 * Test/demo hooks. pdfBytes: size of each rendered PDF (about 540 documents fit in 25 MiB).
 * renderFailures: the next N rendered items come back FAILED from the PDF worker with renderFailureCode
 * (the stored render lastFailureCode), or TRADE.BUSINESS_DOCUMENT.PDF_RENDER_FAILED when it is null.
 */
export const FAKE_DOCUMENTS_BULK_PRINT = {
  pdfBytes: 48 * 1024,
  renderFailures: 0,
  renderFailureCode: null as string | null,
};

/** The trade_document_bulk_prints witness: written once per job, never updated. */
const zipWitnesses = new Map<string, { fileCount: number; byteSize: number }>();

function paramsInvalid(): ApiError {
  // parseBulkJobInput details carry issues, paths and codes; the transform schemas report one "custom" issue.
  return new ApiError(400, 'BULK_JOB_PARAMS_INVALID', { codes: ['custom'] });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(record).every((key) => allowed.includes(key));
}

function isOptionalString(value: unknown, max: number): boolean {
  return value === undefined || (typeof value === 'string' && value.length <= max);
}

function isOptionalId(value: unknown): boolean {
  // The backend wants a UUIDv7 here; fake seed IDs are not UUIDs, so only the type is checked.
  return value === undefined || (typeof value === 'string' && value.length > 0 && value.length <= 64);
}

function isOptionalDate(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

/** documentsBulk{Empty,Reason,Print}Schema: whitelist + forbidNonWhitelisted, no implicit conversion. */
function assertParams(shape: ParamsShape, raw: unknown): void {
  const params = asRecord(raw);
  if (!params || !hasOnlyKeys(params, PARAM_KEYS[shape])) throw paramsInvalid();

  if (shape === 'reason') {
    const { reasonCode, reasonNote } = params;
    // reasonNote is optional but, when present, a string: null is rejected.
    if (typeof reasonCode !== 'string' || reasonCode.length > 80 || !isOptionalString(reasonNote, 500)) {
      throw paramsInvalid();
    }
  } else if (shape === 'print') {
    const { templateVersionId, templateChoice, locale } = params;
    const localeOk =
      locale === undefined || (typeof locale === 'string' && locale.length <= 35 && LOCALE_PATTERN.test(locale));
    if (!isOptionalId(templateVersionId) || (templateChoice !== undefined && templateChoice !== 'BUILT_IN') || !localeOk) {
      throw paramsInvalid();
    }
  }
}

/** DocumentsBulkQueryDto = DocumentListQueryDto without page and limit. */
function assertQuery(raw: unknown): Partial<ListQuery> {
  const query = asRecord(raw);
  if (!query || !hasOnlyKeys(query, QUERY_KEYS)) throw paramsInvalid();
  const search = typeof query['search'] === 'string' ? query['search'].trim() : query['search'];
  const { partyId, currencyCode, crmOpportunityId, businessDateFrom, businessDateTo, status, sort, order } = query;
  const valid =
    isOptionalId(partyId) &&
    isOptionalString(search, 120) &&
    (currencyCode === undefined || (typeof currencyCode === 'string' && /^[A-Z]{3}$/.test(currencyCode))) &&
    isOptionalId(crmOpportunityId) &&
    isOptionalDate(businessDateFrom) &&
    isOptionalDate(businessDateTo) &&
    (businessDateFrom === undefined || businessDateTo === undefined || String(businessDateTo) >= String(businessDateFrom)) &&
    isOptionalString(status, 32) &&
    (sort === undefined || (typeof sort === 'string' && SORT_FIELDS.has(sort))) &&
    (order === undefined || order === 'asc' || order === 'desc');
  if (!valid) throw paramsInvalid();
  return { ...(query as Partial<ListQuery>), ...(typeof search === 'string' ? { search } : {}) };
}

function extractReasonInput(params: Record<string, unknown> | null): ReasonInput {
  const reasonCode = typeof params?.['reasonCode'] === 'string' ? params['reasonCode'] : '';
  const rawNote = params?.['reasonNote'];
  return { reasonCode, reasonNote: typeof rawNote === 'string' ? rawNote : null };
}

function notFoundCode(kind: DocumentKind): string {
  switch (kind) {
    case 'quotation':
      return 'TRADE.QUOTE.NOT_FOUND';
    case 'sales-order':
      return 'TRADE.SALES_ORDER.SOURCE_NOT_FOUND';
    case 'purchase-order':
      return 'TRADE.PURCHASE_ORDER.NOT_FOUND';
    case 'purchase-quotation':
      return 'TRADE.PURCHASE_QUOTATION.NOT_FOUND';
  }
}

/** mapError: a < 500 HttpException becomes the item code, and details.field[0] the item field. */
function mapError(err: unknown): { code: string; field?: string } {
  const code = errorCodeOf(err);
  if (!code) return { code: 'generic' };
  const field = err instanceof ApiError ? err.details?.['field']?.[0] : undefined;
  return field ? { code, field } : { code };
}

/** TradeDocumentsBulkRenderService.validateChoice, run in prepare (after resolve). */
async function validatePrintChoice(kind: DocumentKind, params: Record<string, unknown>): Promise<void> {
  const templateVersionId = params['templateVersionId'];
  if (params['templateChoice'] !== undefined && (kind !== 'quotation' || templateVersionId !== undefined)) {
    throw new ApiError(422, 'TRADE.BUSINESS_DOCUMENT.PDF_TEMPLATE_INCOMPATIBLE', {
      reason: ['template_choice_invalid'],
    });
  }
  // Without a template the default can vary with each record's locale; the render path checks it per item.
  if (templateVersionId === undefined) return;
  const published = await fakeListPrintTemplates(kind);
  if (!published.some((tpl) => tpl.versionId === templateVersionId)) {
    throw new ApiError(
      422,
      kind === 'quotation' ? 'TRADE.QUOTE.PDF_TEMPLATE_INCOMPATIBLE' : 'TRADE.BUSINESS_DOCUMENT.PDF_TEMPLATE_INCOMPATIBLE',
    );
  }
}

/**
 * PRINT dispatches a queued render per item; the PDF worker reply later completes the item (SUCCEEDED with
 * refId = render job id, or FAILED with the render failure code). The shared fake runner has no delegated
 * completion, so the worker reply is applied in the same chunk.
 */
async function printItem(
  kind: DocumentKind,
  entityId: string,
  data: Record<string, string | number | null>,
  params: Record<string, unknown> | null,
): Promise<{ status: BulkJobItemStatus; code?: string; refId?: string }> {
  const templateVersionId = typeof params?.['templateVersionId'] === 'string' ? params['templateVersionId'] : '';
  const locale = params?.['locale'] as PrintLocale | undefined;
  const templateChoice = params?.['templateChoice'] === 'BUILT_IN' ? 'BUILT_IN' : undefined;
  const version = typeof data['version'] === 'number' ? data['version'] : 1;
  const revisionId = typeof data['currentRevisionId'] === 'string' ? data['currentRevisionId'] : undefined;
  const render = await fakeRenderPdf(
    kind,
    entityId,
    {
      purpose: KIND_CONFIG[kind].printPurpose,
      ...(kind === 'quotation' ? { revisionId } : { sourceVersion: version }),
      ...(templateVersionId ? { templateVersionId } : {}),
      ...(locale ? { locale } : {}),
      ...(templateChoice ? { templateChoice } : {}),
    },
    { skipDelay: true },
  );
  if (FAKE_DOCUMENTS_BULK_PRINT.renderFailures > 0) {
    FAKE_DOCUMENTS_BULK_PRINT.renderFailures -= 1;
    return {
      status: 'FAILED',
      code: FAKE_DOCUMENTS_BULK_PRINT.renderFailureCode ?? 'TRADE.BUSINESS_DOCUMENT.PDF_RENDER_FAILED',
      refId: render.renderJobId,
    };
  }
  return { status: 'SUCCEEDED', refId: render.renderJobId };
}

async function runCommand(
  kind: DocumentKind,
  action: string,
  entityId: string,
  version: number,
  params: Record<string, unknown> | null,
): Promise<void> {
  const reason = extractReasonInput(params);
  const opts = { skipDelay: true };
  if (kind === 'quotation') {
    const command = action === 'SEND' ? 'send' : 'cancel';
    await fakeQuotationAction(entityId, version, command, command === 'send' ? undefined : reason, opts);
  } else if (kind === 'sales-order') {
    const command = action === 'HOLD' ? 'hold' : action === 'RELEASE_HOLD' ? 'release-hold' : 'cancel';
    await fakeSalesOrderAction(entityId, version, command, reason, opts);
  } else if (kind === 'purchase-order') {
    const command = action === 'SUBMIT' ? 'submit' : 'cancel';
    await fakePurchaseOrderAction(entityId, version, command, command === 'submit' ? undefined : reason, opts);
  } else if (action === 'ISSUE') {
    await fakeIssuePurchaseQuotation(entityId, version, opts);
  } else {
    await fakeCancelPurchaseQuotation(entityId, version, reason, opts);
  }
}

async function resolveItems(kind: DocumentKind, body: BulkJobSubmit): Promise<ResolvedDocBulkItem[]> {
  if (body.selection.kind === 'QUERY') {
    const query = assertQuery(body.selection.query);
    if (query.status && !LIST_STATUSES[kind].includes(query.status)) throw paramsInvalid();
    const res = await fakeSelectDocumentsForBulk(kind, query, BULK_JOB_LIMITS.maxItems + 1);
    const excluded = new Set(body.selection.excludedIds ?? []);
    const rows = res.items.filter((item) => !excluded.has(item.entityId));
    if (rows.length > BULK_JOB_LIMITS.maxItems) {
      throw new ApiError(422, 'BULK_SELECTION_TOO_LARGE', { max: [String(BULK_JOB_LIMITS.maxItems)] });
    }
    return rows.map((item) => ({ entityId: item.entityId, label: item.label }));
  }

  const resolved: ResolvedDocBulkItem[] = [];
  for (const id of body.selection.ids) {
    const found = await fakeGetDocumentForBulk(kind, id);
    resolved.push(
      found
        ? { entityId: found.entityId, label: found.label }
        : { entityId: id, label: id, preStatus: 'FAILED', code: notFoundCode(kind) },
    );
  }
  return resolved;
}

function createDocumentBulkModule(kind: DocumentKind): FakeBulkModule {
  const actions = ACTION_PARAMS[kind];

  return {
    module: `trading.${KIND_CONFIG[kind].segment}`,

    // BulkJobsSubmitService.submit: handler lookup, params schema, query schema, then the BRANCH scope rule.
    validate(body: BulkJobSubmit): void {
      const shape = actions[body.action];
      if (!shape) throw new ApiError(400, 'BULK_JOB_MODULE_UNKNOWN');
      assertParams(shape, body.params);
      if (body.selection.kind === 'QUERY') assertQuery(body.selection.query);
      if (!body.scope.branchId) throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID', { path: ['scope'] });
    },

    // resolve, then prepare: the reason and template checks run after the active-job conflict and the item limit.
    async resolve(body: BulkJobSubmit): Promise<ResolvedDocBulkItem[]> {
      const resolved = await resolveItems(kind, body);
      const params = asRecord(body.params) ?? {};
      const reasonKind = REASON_KIND_FOR_BULK_ACTION[body.action];
      if (reasonKind) fakeValidateReasonForBulk(reasonKind, extractReasonInput(params));
      else if (body.action === 'PRINT') await validatePrintChoice(kind, params);
      return resolved;
    },

    async executeChunk(job: BulkJob, rawParams: unknown, items: BulkJobItem[]): Promise<ChunkResult[]> {
      const params = asRecord(rawParams);
      const results: ChunkResult[] = [];
      let mutated = false;

      for (const item of items) {
        const current = await fakeGetDocumentForBulk(kind, item.entityId);
        if (!current) {
          results.push({ ordinal: item.ordinal, status: 'FAILED', code: notFoundCode(kind) });
          continue;
        }

        // SUBMIT's approval code also covers policy errors; only its state precondition is a skip.
        if (
          kind === 'purchase-order' &&
          job.action === 'SUBMIT' &&
          (current.data['lifecycleStatus'] !== 'DRAFT' ||
            !PO_SUBMITTABLE_APPROVAL.has(String(current.data['approvalStatus'])))
        ) {
          results.push({ ordinal: item.ordinal, status: 'SKIPPED', code: 'TRADE.PURCHASE_ORDER.APPROVAL_INVALID' });
          continue;
        }

        try {
          if (job.action === 'PRINT') {
            results.push({ ordinal: item.ordinal, ...(await printItem(kind, item.entityId, current.data, params)) });
            continue;
          }
          const version = typeof current.data['version'] === 'number' ? current.data['version'] : 1;
          await runCommand(kind, job.action, item.entityId, version, params);
          mutated = true;
          results.push({ ordinal: item.ordinal, status: 'SUCCEEDED' });
        } catch (err) {
          const mapped = mapError(err);
          results.push({
            ordinal: item.ordinal,
            status: TRANSITION_CODES.has(mapped.code) ? 'SKIPPED' : 'FAILED',
            ...mapped,
          });
        }
      }

      if (mutated) notifyDocumentKindMutated(kind);
      return results;
    },

    async current(entityIds: string[]): Promise<Map<string, Record<string, string | number | null>>> {
      return fakeProjectCurrentDocuments(kind, entityIds);
    },

    // paramsSummary: every string-valued param.
    paramsSummary(body: BulkJobSubmit): Record<string, string | number | null> {
      const params = asRecord(body.params) ?? {};
      const summary: Record<string, string> = {};
      for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'string') summary[key] = value;
      }
      return summary;
    },
  };
}

const DOCUMENT_BULK_MODULES: ReadonlySet<string> = new Set(
  (['quotation', 'sales-order', 'purchase-order', 'purchase-quotation'] as const).map(
    (kind) => `trading.${KIND_CONFIG[kind].segment}`,
  ),
);

/** DocumentBulkZip size: 22 end record + per entry 76 + the name twice + the PDF bytes. Null over the cap. */
async function zipWitnessFor(job: BulkJob): Promise<{ fileCount: number; byteSize: number } | null> {
  const encoder = new TextEncoder();
  const names = new Set<string>();
  let byteSize = 22;
  let fileCount = 0;
  for (let page = 1; ; page++) {
    const res = await fakeListBulkJobItems('trading', job.id, {
      status: 'SUCCEEDED',
      page,
      limit: BULK_JOB_LIMITS.maxPageSize,
    });
    for (const item of res.items) {
      const base = item.label.slice(0, 160) || 'document';
      let name = `${base}.pdf`;
      for (let n = 2; names.has(name.toLowerCase()); n++) name = `${base} (${n}).pdf`;
      names.add(name.toLowerCase());
      byteSize += 76 + encoder.encode(name).length * 2 + FAKE_DOCUMENTS_BULK_PRINT.pdfBytes;
      fileCount++;
      if (byteSize > BULK_PRINT_ZIP_MAX_BYTES) return null;
    }
    if (page * BULK_JOB_LIMITS.maxPageSize >= res.total) break;
  }
  return { fileCount, byteSize };
}

/**
 * GET /api/tenant/trade/v1/documents/bulk-prints/:jobId/artifact (READ, no idempotency key, no-store).
 * 404 BULK_JOB_NOT_FOUND: no job, not a documents PRINT job, or another submitter's job.
 * 409 TRADE.BULK_JOB.ARTIFACT_NOT_READY: no witness yet. The ZIP is built once the job is terminal; a job with
 * no succeeded PDF never gets one, and a ZIP over 25 MiB cannot be stored, so its finalization keeps failing
 * and the route keeps answering 409 (there is no separate "too large" code).
 */
export async function getBulkPrintArtifact(jobId: string): Promise<BulkPrintArtifact> {
  let job: BulkJob;
  try {
    job = await fakeGetBulkJob('trading', jobId);
  } catch {
    throw new ApiError(404, 'BULK_JOB_NOT_FOUND');
  }
  if (job.action !== 'PRINT' || !DOCUMENT_BULK_MODULES.has(job.module)) {
    throw new ApiError(404, 'BULK_JOB_NOT_FOUND');
  }
  if (!zipWitnesses.has(job.id) && !isBulkJobActive(job.status) && job.counts.succeeded > 0) {
    const witness = await zipWitnessFor(job);
    if (witness) zipWitnesses.set(job.id, witness);
  }
  if (!zipWitnesses.has(job.id)) throw new ApiError(409, 'TRADE.BULK_JOB.ARTIFACT_NOT_READY');
  return { downloadUrl: ZIP_DATA_URL, downloadExpiresAt: new Date(Date.now() + ARTIFACT_URL_TTL_MS).toISOString() };
}

let registered = false;

export function registerTradeDocumentsFakeBulkModules(): void {
  if (registered) return;
  registered = true;
  registerFakeBulkModule('trading', createDocumentBulkModule('quotation'));
  registerFakeBulkModule('trading', createDocumentBulkModule('sales-order'));
  registerFakeBulkModule('trading', createDocumentBulkModule('purchase-order'));
  registerFakeBulkModule('trading', createDocumentBulkModule('purchase-quotation'));
}

registerTradeDocumentsFakeBulkModules();
