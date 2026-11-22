import {
  fakeCancelExport,
  fakeCapabilities,
  fakeCreateExport,
  fakeDownloadExport,
  fakeGetExport,
  fakeListExports,
  fakeResolveExportSource,
} from './exports.fake';
import type {
  CreateExportRequest,
  CreateExportResponse,
  DeliveryCapabilities,
  Export,
  ExportListPage,
  ExportPeriod,
  ExportStatus,
} from './exports.model';

// {B} = /api/v1/crm. Gateway rows crm.exports.* (api-gateway-app crm.route-contracts.ts): create is WRITE_SENSITIVE with owner replay
// (CRM.EXPORT.CREATE), so the x-idempotency-key header is required and CRM replays it; download is BINARY_STREAM.

/** Format admission from the latest list answer; PDF stays off until the backend reports it available. */
let capabilities: DeliveryCapabilities = fakeCapabilities();

// POST {B}/analytics/exports  (header x-idempotency-key: UUID v7)
export function createExport(body: CreateExportRequest, key: string): Promise<CreateExportResponse> {
  return fakeCreateExport(body, key);
}

// GET {B}/analytics/exports?cursor&limit&status
export async function listExports(
  cursor: string | null = null,
  limit = 25,
  status?: ExportStatus,
): Promise<ExportListPage> {
  const page = await fakeListExports(cursor, limit, status);
  capabilities = page.capabilities;
  return page;
}

// GET {B}/analytics/exports/:id
export function getExport(id: string): Promise<Export> {
  return fakeGetExport(id);
}

// POST {B}/analytics/exports/:id/cancel  body { revision } (or If-Match)
export function cancelExport(id: string, revision: number): Promise<Export> {
  return fakeCancelExport(id, revision);
}

// GET {B}/analytics/exports/:id/download
export function downloadExport(id: string): Promise<Blob> {
  return fakeDownloadExport(id);
}

export function pdfAvailable(): boolean {
  return capabilities.formats.some((f) => f.format === 'PDF' && f.available);
}

/** `ExportPeriodDto` accepts only from, to and kind; an older `preset` is sent as `kind`. */
export function toExportPeriod(period: ExportPeriod & { preset?: string }): ExportPeriod {
  const kind = period.kind ?? period.preset;
  return { from: period.from, to: period.to, ...(kind ? { kind } : {}) };
}

export function resolveExportSource(
  item: Pick<Export, 'dashboardId' | 'reportKey'>,
  lang: 'ar' | 'en',
): string | null {
  return fakeResolveExportSource(item, lang);
}
