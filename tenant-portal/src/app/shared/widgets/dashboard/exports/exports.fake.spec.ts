import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError, newIdempotencyKey } from '../analytics-api';
import { bindAnalyticsPermissions } from '../analytics-permissions';
import { ANALYTICS_PERMISSIONS_FIXTURE } from '../analytics-permissions.fixture';
import { errorText } from '../panel-state';
import { pdfAvailable, toExportPeriod } from './exports.api';
import {
  fakeCancelExport as cancelExport, fakeCreateExport as createExport, fakeDownloadExport as downloadExport,
  fakeGetExport as getExport, fakeListExports as listExports,
} from './exports.fake';
import type { CreateExportRequest } from './exports.model';

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

describe('exports fake follows crm/analytics/exports', () => {
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
