import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bindAnalyticsPermissions } from '../analytics-permissions';
import { ANALYTICS_PERMISSIONS_FIXTURE } from '../analytics-permissions.fixture';
import { errorText } from '../panel-state';
import { toExportPeriod } from './exports.api';
import {
  ApiError,
  newIdempotencyKey,
  FAKE_NOW,
  fakeId,
  idempotencyKeyOf,
  isUuidV7,
  pageOf,
  replayOf,
  requestFingerprint,
  validationFailed,
} from '../analytics-api';
import { can } from '../analytics-permissions';
import { FAKE_ME } from '../fake/fake-org';
import type {
  CreateExportRequest,
  CreateExportResponse,
  DeliveryCapabilities,
  Export,
  ExportListPage,
  ExportStatus,
} from './exports.model';

// Test-only in-memory export fixture; never imported by the application.
// Mirrors crm-app crm/dashboards/delivery/exports (controller, export.service.ts, exports.dto.ts).

const DAY_MS = 24 * 60 * 60 * 1000;
/** A single export may not span more than five calendar years (366 * 5 days). */
const MAX_PERIOD_DAYS = 366 * 5;
const QUEUE_LIMIT_PER_USER = 5;
const SPEC_MAX_BYTES = 16_384;
const LIST_LIMIT_DEFAULT = 25;
const LIST_LIMIT_MAX = 100;
const MAX_REVISION = 2_147_483_647;
const PANEL_KEY_LIMIT = 60;
const EXPIRY_DAYS = 7;
const FORMATS = ['XLSX', 'CSV', 'PDF'] as const;
const LOCALES = ['ar', 'en'] as const;
const STATUSES: readonly ExportStatus[] = ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'];
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const REPORT_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const PANEL_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const BODY_KEYS = new Set(['dashboardId', 'reportKey', 'format', 'locale', 'filters', 'period', 'scope', 'panelKeys']);
const PERIOD_KEYS = new Set(['from', 'to', 'kind']);

/** Operator switch CRM_EXPORT_PDF_ENABLED: off until the Worker PDF renderer is deployed. */
let pdfRendererAvailable = false;
let clockTick = 0;

/** Seed dashboards (UUID v7, as the backend stores them); a report export points at its report's backing dashboard. */
const DASH = {
  executive: '01934a10-0000-7000-8000-000000000001',
  cairoOverview: '01934a10-0000-7000-8000-000000000002',
  mySalesBoard: '01934a10-0000-7000-8000-000000000003',
  leadAcquisition: '01934a10-0000-7000-8000-0000000000a1',
  opportunitiesByStage: '01934a10-0000-7000-8000-0000000000a2',
  firstResponse: '01934a10-0000-7000-8000-0000000000a3',
  activitiesByType: '01934a10-0000-7000-8000-0000000000a4',
  wonSalesCycle: '01934a10-0000-7000-8000-0000000000a5',
} as const;

const DASHBOARD_NAMES: Readonly<Record<string, { en: string; ar: string }>> = {
  [DASH.executive]: { en: 'Executive', ar: 'الإدارة التنفيذية' },
  [DASH.cairoOverview]: { en: 'Cairo branch overview', ar: 'نظرة عامة على فرع القاهرة' },
  [DASH.mySalesBoard]: { en: 'My sales board', ar: 'لوحة مبيعاتي' },
};

const REPORT_NAMES: Readonly<Record<string, { en: string; ar: string }>> = {
  'lead-acquisition': { en: 'Lead acquisition', ar: 'اكتساب العملاء المحتملين' },
  'lead-source-mix': { en: 'Lead source mix', ar: 'توزيع مصادر العملاء المحتملين' },
  'opportunities-by-stage': { en: 'Opportunities by stage', ar: 'توزيع الفرص على المراحل' },
  'won-sales-cycle': { en: 'Won sales cycle', ar: 'دورة بيع الصفقات الناجحة' },
  'activities-by-type': { en: 'Activities by type', ar: 'الأنشطة حسب النوع' },
  'first-response-time-summary': { en: 'First response time', ar: 'زمن الاستجابة الأولى' },
};

/** The stored row: the DTO plus what the backend keeps but never returns (requester and request spec). */
interface ExportRow extends Export {
  requestedByUserId: string;
  period: { from: string; to: string; kind: string | null };
}

interface ExportSpec {
  reportKey: string | null;
  period: { from: string; to: string; kind: string | null };
  filters: Record<string, unknown>;
  scope: Record<string, unknown> | null;
  panelKeys: string[] | null;
}

function offsetIso(baseIso: string, deltaMs: number): string {
  return new Date(Date.parse(baseIso) + deltaMs).toISOString();
}

function nextFakeInstant(): string {
  clockTick += 1000;
  return offsetIso(FAKE_NOW, clockTick);
}

function seed(
  n: number,
  row: Pick<ExportRow, 'dashboardId' | 'reportKey' | 'format' | 'locale' | 'status' | 'queuedAt'> &
    Partial<ExportRow> & { period: ExportRow['period'] },
): ExportRow {
  return {
    id: `01934b60-0000-7000-8000-00000000000${n}`,
    origin: 'USER',
    requestedByUserId: FAKE_ME.id,
    rowCount: null,
    pageCount: null,
    byteSize: null,
    failureCode: null,
    completedAt: null,
    expiresAt: null,
    revision: 3,
    ...row,
  };
}

const seedExports: ExportRow[] = [
  seed(1, {
    dashboardId: DASH.executive, reportKey: null, format: 'CSV', locale: 'en', status: 'QUEUED', revision: 1,
    period: { kind: 'CURRENT_MONTH', from: '2026-11-01', to: '2026-11-21' }, queuedAt: '2026-11-21T08:58:00.000Z',
  }),
  seed(2, {
    dashboardId: DASH.leadAcquisition, reportKey: 'lead-acquisition', format: 'XLSX', locale: 'ar', status: 'RUNNING',
    revision: 2, period: { kind: 'LAST_30_DAYS', from: '2026-10-23', to: '2026-11-21' }, queuedAt: '2026-11-21T08:55:10.000Z',
  }),
  seed(3, {
    dashboardId: DASH.executive, reportKey: null, format: 'CSV', locale: 'en', status: 'SUCCEEDED',
    period: { kind: 'LAST_MONTH', from: '2026-10-01', to: '2026-10-31' }, rowCount: 1420, byteSize: 1258291,
    queuedAt: '2026-11-21T08:15:00.000Z', completedAt: '2026-11-21T08:15:09.000Z',
    expiresAt: offsetIso('2026-11-21T08:15:09.000Z', EXPIRY_DAYS * DAY_MS),
  }),
  seed(4, {
    dashboardId: DASH.opportunitiesByStage, reportKey: 'opportunities-by-stage', format: 'XLSX', locale: 'en',
    status: 'SUCCEEDED', period: { kind: 'CURRENT_QUARTER', from: '2026-10-01', to: '2026-11-21' }, rowCount: 648,
    byteSize: 482304, queuedAt: '2026-11-20T16:40:00.000Z', completedAt: '2026-11-20T16:40:08.000Z',
    expiresAt: offsetIso('2026-11-20T16:40:08.000Z', EXPIRY_DAYS * DAY_MS),
  }),
  seed(5, {
    origin: 'SUBSCRIPTION', dashboardId: DASH.cairoOverview, reportKey: null, format: 'CSV', locale: 'ar',
    status: 'SUCCEEDED', period: { kind: 'LAST_COMPLETED_WEEK', from: '2026-11-08', to: '2026-11-14' }, rowCount: 312,
    byteSize: 94208, queuedAt: '2026-11-19T09:00:00.000Z', completedAt: '2026-11-19T09:00:06.000Z',
    expiresAt: offsetIso('2026-11-19T09:00:06.000Z', EXPIRY_DAYS * DAY_MS),
  }),
  seed(6, {
    dashboardId: DASH.firstResponse, reportKey: 'first-response-time-summary', format: 'CSV', locale: 'en',
    status: 'FAILED', failureCode: 'RUN_TIMEOUT', period: { kind: 'LAST_90_DAYS', from: '2026-08-24', to: '2026-11-21' },
    queuedAt: '2026-11-18T14:20:00.000Z', completedAt: '2026-11-18T14:21:03.000Z',
  }),
  seed(7, {
    dashboardId: DASH.mySalesBoard, reportKey: null, format: 'XLSX', locale: 'en', status: 'FAILED',
    failureCode: 'TOO_LARGE', period: { kind: 'LAST_YEAR', from: '2025-01-01', to: '2025-12-31' },
    queuedAt: '2026-11-17T11:10:00.000Z', completedAt: '2026-11-17T11:10:25.000Z',
  }),
  seed(8, {
    dashboardId: DASH.activitiesByType, reportKey: 'activities-by-type', format: 'XLSX', locale: 'ar',
    status: 'CANCELLED', period: { kind: 'CURRENT_YEAR', from: '2026-01-01', to: '2026-11-21' },
    queuedAt: '2026-11-16T10:05:00.000Z', completedAt: '2026-11-16T10:05:05.000Z',
  }),
  seed(9, {
    origin: 'SUBSCRIPTION', dashboardId: DASH.wonSalesCycle, reportKey: 'won-sales-cycle', format: 'CSV',
    locale: 'en', status: 'EXPIRED', revision: 4, period: { kind: 'LAST_COMPLETED_MONTH', from: '2026-10-01', to: '2026-10-31' },
    rowCount: 890, byteSize: 215040, queuedAt: '2026-11-10T09:00:00.000Z', completedAt: '2026-11-10T09:00:08.000Z',
    expiresAt: offsetIso('2026-11-10T09:00:08.000Z', EXPIRY_DAYS * DAY_MS),
  }),
];

const store: ExportRow[] = structuredClone(seedExports);
/** Keyed by `(requester, idempotency key)`, as the unique index on `crm_dashboard_exports`. */
const idempotencyStore = new Map<string, { fingerprint: string; response: CreateExportResponse }>();
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>[]>();

function toDto(row: ExportRow): Export {
  const { requestedByUserId: _requester, period: _period, ...dto } = row;
  return structuredClone(dto);
}

function clearExportTimers(id: string): void {
  for (const timer of pendingTimers.get(id) ?? []) clearTimeout(timer);
  pendingTimers.delete(id);
}

function scheduleProgression(exportId: string): void {
  const toRunning = setTimeout(() => {
    const item = store.find((row) => row.id === exportId);
    if (!item || item.status !== 'QUEUED') return;
    item.status = 'RUNNING';
    item.revision += 1;
  }, 3000);

  const toSucceeded = setTimeout(() => {
    const item = store.find((row) => row.id === exportId);
    pendingTimers.delete(exportId);
    if (!item || (item.status !== 'QUEUED' && item.status !== 'RUNNING')) return;
    const completedAt = nextFakeInstant();
    item.status = 'SUCCEEDED';
    item.completedAt = completedAt;
    item.expiresAt = offsetIso(completedAt, EXPIRY_DAYS * DAY_MS);
    item.rowCount = 486;
    item.byteSize = 74240;
    item.revision += 1;
  }, 6000);

  pendingTimers.set(exportId, [toRunning, toSucceeded]);
}

/** RequirePermissions runs before the ValidationPipe: 403 `CRM_PERMISSION_DENIED`. */
function requirePermissions(...keys: string[]): void {
  if (keys.some((key) => !can(key))) throw new ApiError(403, 'CRM_PERMISSION_DENIED');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireIdParam(id: string): void {
  if (!isUuidV7(id)) throw validationFailed('id', 'is_uuid');
}

/** The global ValidationPipe on `CreateExportDto` (whitelist + forbidNonWhitelisted). */
function validateCreateBody(body: CreateExportRequest): void {
  const raw = body as unknown as Record<string, unknown>;
  const unknownKey = Object.keys(raw).find((key) => !BODY_KEYS.has(key));
  if (unknownKey) throw validationFailed(unknownKey, 'whitelist_validation');
  if (raw['dashboardId'] !== undefined && raw['dashboardId'] !== null && !isUuidV7(raw['dashboardId'])) {
    throw validationFailed('dashboardId', 'is_uuid');
  }
  if (raw['reportKey'] != null && (typeof raw['reportKey'] !== 'string' || !REPORT_KEY.test(raw['reportKey']))) {
    throw validationFailed('reportKey', 'matches');
  }
  if (!FORMATS.includes(raw['format'] as never)) throw validationFailed('format', 'is_in');
  if (raw['locale'] != null && !LOCALES.includes(raw['locale'] as never)) throw validationFailed('locale', 'is_in');
  if (raw['filters'] != null && !isPlainObject(raw['filters'])) throw validationFailed('filters', 'is_object');
  if (raw['scope'] != null && !isPlainObject(raw['scope'])) throw validationFailed('scope', 'is_object');
  const panelKeys = raw['panelKeys'];
  if (panelKeys != null) {
    if (!Array.isArray(panelKeys)) throw validationFailed('panelKeys', 'is_array');
    if (panelKeys.length > PANEL_KEY_LIMIT) throw validationFailed('panelKeys', 'array_max_size');
    if (!panelKeys.every((key) => typeof key === 'string' && PANEL_KEY.test(key))) {
      throw validationFailed('panelKeys', 'matches');
    }
  }
  const period = raw['period'];
  if (!isPlainObject(period)) throw validationFailed('period', 'nested_validation');
  const unknownPeriodKey = Object.keys(period).find((key) => !PERIOD_KEYS.has(key));
  if (unknownPeriodKey) throw validationFailed(`period.${unknownPeriodKey}`, 'whitelist_validation');
  for (const key of ['from', 'to'] as const) {
    if (typeof period[key] !== 'string' || !CIVIL_DATE.test(period[key] as string)) {
      throw validationFailed(`period.${key}`, 'matches');
    }
  }
  if (period['kind'] != null && (typeof period['kind'] !== 'string' || period['kind'].length > 32)) {
    throw validationFailed('period.kind', 'max_length');
  }
}

function isRealDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

function specOf(body: CreateExportRequest): ExportSpec {
  const panelKeys = body.panelKeys && body.panelKeys.length > 0 ? [...new Set(body.panelKeys)] : null;
  return {
    reportKey: body.reportKey ?? null,
    period: { from: body.period.from, to: body.period.to, kind: body.period.kind ?? null },
    filters: body.filters ?? {},
    scope: body.scope ?? null,
    panelKeys,
  };
}

function fakeCapabilities(): DeliveryCapabilities {
  return {
    formats: [
      { format: 'CSV', available: true },
      { format: 'XLSX', available: true },
      {
        format: 'PDF',
        available: pdfRendererAvailable,
        ...(!pdfRendererAvailable ? { reason: 'PDF_RENDERER_UNAVAILABLE' } : {}),
      },
    ],
  };
}

function pdfAvailable(): boolean {
  return pdfRendererAvailable;
}

/** Fake-only display name: the real ExportDto carries no name, the page resolves it from the dashboards it knows. */
function fakeResolveExportSource(
  item: Pick<Export, 'dashboardId' | 'reportKey'>,
  lang: 'ar' | 'en',
): string | null {
  if (item.reportKey) {
    const match = REPORT_NAMES[item.reportKey];
    if (match) return match[lang];
    const words = item.reportKey.replace(/[-_.]/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  return DASHBOARD_NAMES[item.dashboardId]?.[lang] ?? null;
}

/** POST crm/analytics/exports (202), in the backend order of checks. */
async function createExport(
  body: CreateExportRequest,
  key: string | undefined,
): Promise<CreateExportResponse> {
  requirePermissions('crm.exports.create', 'crm.dashboards.read');
  validateCreateBody(body);
  const idempotencyKey = idempotencyKeyOf(key);

  if ((typeof body.dashboardId === 'string') === (typeof body.reportKey === 'string')) {
    throw new ApiError(422, 'CRM_EXPORT_TARGET_INVALID');
  }
  const { from, to } = body.period;
  if (!isRealDate(from) || !isRealDate(to) || from > to || daysBetween(from, to) > MAX_PERIOD_DAYS) {
    throw new ApiError(422, 'CRM_DASHBOARD_DATE_RANGE_EXCEEDED', { maxDays: [String(MAX_PERIOD_DAYS)] });
  }
  // export.service.ts formatInvalid: the reason travels as `details.reason` (lowercase), never top-level.
  if (body.format === 'PDF' && !pdfRendererAvailable) {
    throw new ApiError(422, 'CRM_EXPORT_FORMAT_INVALID', { reason: ['pdf_renderer_unavailable'] });
  }
  const spec = specOf(body);
  if (new TextEncoder().encode(JSON.stringify(spec)).length > SPEC_MAX_BYTES) {
    throw new ApiError(422, 'CRM_EXPORT_FORMAT_INVALID', { reason: ['spec_too_large'] });
  }

  const locale = body.locale ?? 'ar';
  const storeKey = `${FAKE_ME.id}:${idempotencyKey}`;
  const fingerprint = requestFingerprint({
    format: body.format,
    locale,
    target: body.dashboardId ?? body.reportKey,
    spec,
  });
  const replay = replayOf(idempotencyStore, storeKey, fingerprint);
  if (replay) return structuredClone(replay);

  const active = store.filter(
    (row) => row.requestedByUserId === FAKE_ME.id && (row.status === 'QUEUED' || row.status === 'RUNNING'),
  ).length;
  if (active >= QUEUE_LIMIT_PER_USER) throw new ApiError(429, 'CRM_EXPORT_QUEUE_LIMIT');

  const id = fakeId();
  store.unshift({
    id,
    origin: 'USER',
    requestedByUserId: FAKE_ME.id,
    // A report export runs against the report's backing dashboard (ReportDashboardResolver).
    dashboardId: body.dashboardId ?? fakeId(),
    reportKey: body.reportKey ?? null,
    format: body.format,
    locale,
    status: 'QUEUED',
    period: spec.period,
    rowCount: null,
    pageCount: null,
    byteSize: null,
    failureCode: null,
    queuedAt: nextFakeInstant(),
    completedAt: null,
    expiresAt: null,
    revision: 1,
  });
  scheduleProgression(id);

  const response: CreateExportResponse = { exportId: id, status: 'QUEUED' };
  idempotencyStore.set(storeKey, { fingerprint, response });
  return structuredClone(response);
}

/** GET crm/analytics/exports: the requester's own exports, newest first, keyset page plus capabilities. */
async function listExports(
  cursor: string | null = null,
  limit: number = LIST_LIMIT_DEFAULT,
  status?: ExportStatus,
): Promise<ExportListPage> {
  requirePermissions('crm.exports.create');
  if (!Number.isInteger(limit)) throw validationFailed('limit', 'is_int');
  if (limit < 1) throw validationFailed('limit', 'min');
  if (limit > LIST_LIMIT_MAX) throw validationFailed('limit', 'max');
  if (status !== undefined && !STATUSES.includes(status)) throw validationFailed('status', 'is_in');
  if (cursor && cursor.length > 512) throw validationFailed('cursor', 'max_length');
  const mine = store
    .filter((row) => row.requestedByUserId === FAKE_ME.id && (!status || row.status === status))
    .sort((a, b) => (a.queuedAt === b.queuedAt ? b.id.localeCompare(a.id) : b.queuedAt.localeCompare(a.queuedAt)));
  const page = pageOf(mine, cursor?.trim() || null, limit);
  return { items: page.items.map(toDto), pageInfo: page.pageInfo, capabilities: fakeCapabilities() };
}

function readMine(id: string): ExportRow {
  requireIdParam(id);
  const item = store.find((row) => row.id === id && row.requestedByUserId === FAKE_ME.id);
  if (!item) throw new ApiError(404, 'CRM_EXPORT_NOT_FOUND');
  return item;
}

/** GET crm/analytics/exports/:id */
async function getExport(id: string): Promise<Export> {
  requirePermissions('crm.exports.create');
  return toDto(readMine(id));
}

/**
 * POST crm/analytics/exports/:id/cancel. The revision (body or If-Match) is required; the stale check runs
 * before the status check, as in the service.
 */
async function cancelExport(id: string, revision: number | undefined): Promise<Export> {
  requirePermissions('crm.exports.create');
  requireIdParam(id);
  if (revision !== undefined && (!Number.isInteger(revision) || revision < 1 || revision > MAX_REVISION)) {
    throw validationFailed('revision', 'is_int');
  }
  if (revision === undefined) throw new ApiError(400, 'CRM_DASHBOARD_REVISION_MISMATCH');
  const item = readMine(id);
  if (item.revision !== revision) throw new ApiError(409, 'CRM_EXPORT_REVISION_STALE');
  if (item.status !== 'QUEUED' && item.status !== 'RUNNING') throw new ApiError(409, 'CRM_EXPORT_NOT_CANCELLABLE');

  clearExportTimers(id);
  item.status = 'CANCELLED';
  item.completedAt = nextFakeInstant();
  item.revision += 1;
  return toDto(item);
}

/** GET crm/analytics/exports/:id/download (binary stream through the Gateway). */
async function downloadExport(id: string): Promise<Blob> {
  requirePermissions('crm.exports.create');
  const item = readMine(id);
  const expired = item.expiresAt !== null && item.expiresAt <= FAKE_NOW;
  if (item.status === 'EXPIRED' || (item.status === 'SUCCEEDED' && expired)) {
    throw new ApiError(410, 'CRM_EXPORT_EXPIRED');
  }
  if (item.status !== 'SUCCEEDED') throw new ApiError(409, 'CRM_EXPORT_NOT_READY');

  const source = fakeResolveExportSource(item, item.locale) ?? item.reportKey ?? item.dashboardId;
  const rows = [
    ['Export ID', 'Source', 'Format', 'Period From', 'Period To', 'Rows'],
    [item.id, source, item.format, item.period.from, item.period.to, String(item.rowCount ?? 0)],
  ];
  const csv = rows.map((line) => line.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\r\n');
  return new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
}

/** Test hook: the operator switch CRM_EXPORT_PDF_ENABLED. */
function setFakePdfRenderer(available: boolean): void {
  pdfRendererAvailable = available;
}

beforeEach(() => bindAnalyticsPermissions(() => ANALYTICS_PERMISSIONS_FIXTURE));
afterEach(() => bindAnalyticsPermissions(() => []));

const DASHBOARD = '01934a10-0000-7000-8000-000000000001';
const body = (extra: Partial<CreateExportRequest> = {}): CreateExportRequest => ({
  reportKey: 'lead-acquisition',
  format: 'CSV',
  locale: 'en',
  period: { from: '2026-11-01', to: '2026-11-21', kind: 'CURRENT_MONTH' },
  ...extra,
});
const failure = (status: number, code: string, details?: Record<string, string[]>) =>
  expect.objectContaining({ status, code, ...(details ? { details } : {}) });

describe('test-only export fixture follows crm/analytics/exports', () => {
  it('lists the requester exports as a keyset page with format capabilities and the ExportDto fields only', async () => {
    const page = await listExports(null, 2);
    expect(page.items).toHaveLength(2);
    expect(page.pageInfo).toEqual({ limit: 2, hasMore: true, nextCursor: expect.any(String) });
    expect(page.capabilities.formats.find((f) => f.format === 'PDF')).toEqual({
      format: 'PDF',
      available: false,
      reason: 'PDF_RENDERER_UNAVAILABLE',
    });
    expect(pdfAvailable()).toBe(false);
    expect(Object.keys(page.items[0]).sort()).toEqual(
      ['byteSize', 'completedAt', 'dashboardId', 'expiresAt', 'failureCode', 'format', 'id', 'locale', 'origin',
        'pageCount', 'queuedAt', 'reportKey', 'revision', 'rowCount', 'status'].sort(),
    );
    const next = await listExports(page.pageInfo.nextCursor, 2);
    expect(next.items.map((i) => i.id)).not.toContain(page.items[0].id);
  });

  it('validates the list query like the DTO (400 CRM_VALIDATION_FAILED) and a bad cursor (400 cursor invalid)', async () => {
    await expect(listExports(null, 101)).rejects.toEqual(failure(400, 'CRM_VALIDATION_FAILED', { limit: ['max'] }));
    await expect(listExports('***', 5)).rejects.toEqual(failure(400, 'CRM_DASHBOARD_LIST_CURSOR_INVALID'));
  });

  it('rejects a malformed idempotency key with 400 CRM_IDEMPOTENCY_KEY_INVALID', async () => {
    await expect(createExport(body(), 'not-a-uuid')).rejects.toEqual(failure(400, 'CRM_IDEMPOTENCY_KEY_INVALID'));
  });

  it('replays the same key and body, and answers a different body with 422 CRM_IDEMPOTENCY_KEY_REUSED', async () => {
    const key = newIdempotencyKey();
    const first = await createExport(body(), key);
    expect(first).toEqual({ exportId: expect.any(String), status: 'QUEUED' });
    await expect(createExport(body(), key)).resolves.toEqual(first);
    await expect(createExport(body({ format: 'XLSX' }), key)).rejects.toEqual(failure(422, 'CRM_IDEMPOTENCY_KEY_REUSED'));
    await cancelExport(first.exportId, (await getExport(first.exportId)).revision);
  });

  it('refuses unknown keys, a non-v7 dashboard id and a period preset with field-keyed 400 details', async () => {
    const preset = { from: '2026-11-01', to: '2026-11-21', preset: 'CURRENT_MONTH' } as never;
    await expect(createExport(body({ period: preset }), newIdempotencyKey())).rejects.toEqual(
      failure(400, 'CRM_VALIDATION_FAILED', { 'period.preset': ['whitelist_validation'] }),
    );
    await expect(
      createExport(body({ reportKey: undefined, dashboardId: 'dash-base-executive' }), newIdempotencyKey()),
    ).rejects.toEqual(failure(400, 'CRM_VALIDATION_FAILED', { dashboardId: ['is_uuid'] }));
    expect(toExportPeriod(preset)).toEqual({ from: '2026-11-01', to: '2026-11-21', kind: 'CURRENT_MONTH' });
  });

  it('answers the service rules in order: target, period (maxDays), PDF (details.reason)', async () => {
    await expect(createExport(body({ dashboardId: DASHBOARD }), newIdempotencyKey())).rejects.toEqual(
      failure(422, 'CRM_EXPORT_TARGET_INVALID'),
    );
    const range = createExport(body({ period: { from: '2026-11-21', to: '2026-11-01' } }), newIdempotencyKey());
    await expect(range).rejects.toEqual(failure(422, 'CRM_DASHBOARD_DATE_RANGE_EXCEEDED', { maxDays: ['1830'] }));
    const rangeText = errorText(await range.catch((error: unknown) => error));
    expect(rangeText).toEqual({ key: 'analytics.errorDetail.dateRangeMax', params: { maxDays: '1830' } });
    const pdf = createExport(body({ format: 'PDF' }), newIdempotencyKey());
    await expect(pdf).rejects.toEqual(failure(422, 'CRM_EXPORT_FORMAT_INVALID', { reason: ['pdf_renderer_unavailable'] }));
    await expect(pdf).rejects.not.toHaveProperty('reason');
    expect(errorText(await pdf.catch((error: unknown) => error))).toEqual({ key: 'analytics.reason.PDF_RENDERER_UNAVAILABLE' });
  });

  it('never reads details on a 5xx (they carry none) and falls back to the code text', () => {
    expect(errorText(new ApiError(503, 'CRM_DASHBOARD_DATE_RANGE_EXCEEDED', { maxDays: ['92'] }))).toEqual({
      key: 'analytics.error.CRM_DASHBOARD_DATE_RANGE_EXCEEDED',
    });
    expect(errorText(new ApiError(500, 'INTERNAL'))).toEqual({ key: 'analytics.error.GENERIC' });
  });

  it('checks the revision before the status on cancel, and maps download states to 410 and 409', async () => {
    const succeeded = '01934b60-0000-7000-8000-000000000003';
    await expect(cancelExport(succeeded, 1)).rejects.toEqual(failure(409, 'CRM_EXPORT_REVISION_STALE'));
    await expect(cancelExport(succeeded, 3)).rejects.toEqual(failure(409, 'CRM_EXPORT_NOT_CANCELLABLE'));
    await expect(downloadExport('01934b60-0000-7000-8000-000000000009')).rejects.toEqual(failure(410, 'CRM_EXPORT_EXPIRED'));
    await expect(downloadExport('01934b60-0000-7000-8000-000000000006')).rejects.toEqual(failure(409, 'CRM_EXPORT_NOT_READY'));
    await expect(getExport('nope')).rejects.toEqual(failure(400, 'CRM_VALIDATION_FAILED', { id: ['is_uuid'] }));
    await expect(getExport('01934b60-0000-7000-8000-0000000000ff')).rejects.toEqual(failure(404, 'CRM_EXPORT_NOT_FOUND'));
    await expect(downloadExport(succeeded)).resolves.toBeInstanceOf(Blob);
  });
});
