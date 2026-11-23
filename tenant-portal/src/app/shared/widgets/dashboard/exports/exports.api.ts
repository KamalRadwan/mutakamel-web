import { ApiError, isRetryableWriteError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { crmHttp, crmQueries } from '../../../../features/crm/shared/crm-http';
import type {
  CreateExportRequest,
  CreateExportResponse,
  DeliveryCapabilities,
  Export,
  ExportListPage,
  ExportPeriod,
  ExportStatus,
} from './exports.model';

const exportsKey = ['crm-analytics', 'exports'] as const;
const path = '/analytics/exports';
const cancelKeys = new Map<string, { revision: number; key: string }>();

/** Capabilities belong to the latest list, never a client-side PDF feature flag. */
export function exportCapabilities(): DeliveryCapabilities {
  return crmQueries().getQueryData<DeliveryCapabilities>([...exportsKey, 'capabilities']) ?? { formats: [] };
}

// POST {B}/analytics/exports  (header x-idempotency-key: UUID v7)
export async function createExport(body: CreateExportRequest, key: string): Promise<CreateExportResponse> {
  await crmQueries().cancelQueries({ queryKey: exportsKey });
  try {
    return (await crmHttp().write<CreateExportResponse>('POST', path, body, { key })).data;
  } finally {
    await crmQueries().invalidateQueries({ queryKey: exportsKey, refetchType: 'none' });
  }
}

// GET {B}/analytics/exports?cursor&limit&status
export async function listExports(
  cursor: string | null = null,
  limit = 25,
  status?: ExportStatus,
): Promise<ExportListPage> {
  const page = await crmQueries().fetchQuery<ExportListPage>({
    queryKey: [...exportsKey, 'list', cursor, limit, status],
    queryFn: () => crmHttp().read(path, { cursor, limit, status }),
    staleTime: 0,
  });
  crmQueries().setQueryDefaults([...exportsKey, 'capabilities'], { gcTime: Infinity });
  crmQueries().setQueryData([...exportsKey, 'capabilities'], page.capabilities);
  return page;
}

// GET {B}/analytics/exports/:id
export function getExport(id: string): Promise<Export> {
  return crmQueries().fetchQuery({
    queryKey: [...exportsKey, 'detail', id],
    queryFn: () => crmHttp().read<Export>(`${path}/${encodeURIComponent(id)}`),
    staleTime: 0,
  });
}

// POST {B}/analytics/exports/:id/cancel  body { revision } (or If-Match)
export async function cancelExport(id: string, revision: number): Promise<Export> {
  const previous = cancelKeys.get(id);
  const key = previous?.revision === revision ? previous.key : newIdempotencyKey();
  cancelKeys.set(id, { revision, key });
  await crmQueries().cancelQueries({ queryKey: exportsKey });
  try {
    const result = await crmHttp().write<Export>('POST', `${path}/${encodeURIComponent(id)}/cancel`, { revision }, {
      key, ifMatch: `"export:${id}:${revision}"`,
    });
    cancelKeys.delete(id);
    return result.data;
  } catch (error) {
    if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) cancelKeys.delete(id);
    throw error;
  } finally {
    await crmQueries().invalidateQueries({ queryKey: exportsKey, refetchType: 'none' });
  }
}

// GET {B}/analytics/exports/:id/download
export async function downloadExport(id: string): Promise<Blob> {
  const blob = await crmQueries().fetchQuery({
    queryKey: [...exportsKey, 'download', id],
    queryFn: () => crmHttp().readBlob(`${path}/${encodeURIComponent(id)}/download`),
    staleTime: 0,
    gcTime: 0,
  });
  const row = await getExport(id);
  const source = await crmQueries().fetchQuery({
    queryKey: sourceKey(row),
    queryFn: () => row.reportKey
      ? crmHttp().read<ExportSource>(`/dashboards/reports/${encodeURIComponent(row.reportKey)}/manifest`)
      : crmHttp().read<ExportSource>(`/dashboards/${encodeURIComponent(row.dashboardId)}`),
    staleTime: 0,
  });
  const name = source.report?.title[row.locale] ?? source.name ?? row.reportKey ?? row.dashboardId;
  return new File([blob], exportFilename(row, name), { type: blob.type });
}

export function exportFilename(row: Pick<Export, 'queuedAt' | 'format'>, sourceName: string): string {
  const stem = sourceName.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '-').replace(/[. ]+$/g, '-') || 'export';
  return `${stem}-${row.queuedAt.slice(0, 10)}.${row.format.toLowerCase()}`;
}

export function pdfAvailable(): boolean {
  return exportCapabilities().formats.some((f) => f.format === 'PDF' && f.available);
}

/** `ExportPeriodDto` accepts only from, to and kind; an older `preset` is sent as `kind`. */
export function toExportPeriod(period: ExportPeriod & { preset?: string }): ExportPeriod {
  const kind = period.kind ?? period.preset;
  return { from: period.from, to: period.to, ...(kind ? { kind } : {}) };
}

interface ExportSource {
  name?: string;
  report?: { title: { ar: string; en: string } };
}

function sourceKey(item: Pick<Export, 'dashboardId' | 'reportKey'>) {
  return [...exportsKey, 'source', item.reportKey ? 'report' : 'dashboard', item.reportKey ?? item.dashboardId];
}

export function resolveExportSource(
  item: Pick<Export, 'dashboardId' | 'reportKey'>,
  lang: 'ar' | 'en',
): string | null {
  const source = crmQueries().getQueryData<ExportSource>(sourceKey(item));
  return source?.report?.title[lang] ?? source?.name ?? item.reportKey ?? item.dashboardId ?? null;
}
