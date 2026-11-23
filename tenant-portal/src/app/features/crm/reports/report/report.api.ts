import { raceAbort } from '../../../../shared/widgets/dashboard/analytics-api';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { crmHttp, crmQueries } from '../../shared/crm-http';
import { getCatalog } from '../../../../shared/widgets/dashboard/analytics.api';
import { listLeadSources } from '../../settings/lead-sources/lead-sources.api';
import { listPipelinesForRead } from '../../settings/pipelines/pipelines.api';
import { listActiveCoreCurrencyCodes } from '../../../../shared/lookups/core-currencies';
import { tenantWide } from '../../settings/shared/settings-access';
import type { Catalog, Visualization } from '../../../../shared/widgets/dashboard/analytics.model';
import type {
  DashboardListPage,
  DashboardListRow,
  PanelManifest,
  PanelRowsPage,
  PanelRowsRequest,
  PinPanelRequest,
  PinPanelResponse,
  PinTarget,
  ReportFilterLookups,
  ReportRunRequest,
} from './report.model';

// GET /api/v1/crm/dashboards/reports/:reportKey/manifest
export async function getManifest(reportKey: string): Promise<PanelManifest> {
  const manifest = await crmQueries().fetchQuery<PanelManifest>({
    queryKey: ['crm-analytics', 'reports', reportKey, 'manifest'],
    queryFn: () => crmHttp().read(`/dashboards/reports/${encodeURIComponent(reportKey)}/manifest`),
    staleTime: 0,
  });
  // Layout fallback sizes come from the real catalogue; its failure must not block the report.
  await getCatalog().catch(() => undefined);
  return manifest;
}

// POST /api/v1/crm/dashboards/reports/:reportKey (200)
export function runReport(reportKey: string, body: ReportRunRequest, signal?: AbortSignal): Promise<PanelManifest> {
  return raceAbort(() => crmQueries().fetchQuery<PanelManifest>({
    queryKey: ['crm-analytics', 'reports', reportKey, 'run', body],
    queryFn: async () => (await crmHttp().write<PanelManifest>('POST',
      `/dashboards/reports/${encodeURIComponent(reportKey)}`, body, { key: newIdempotencyKey() })).data,
    staleTime: 0,
  }), signal);
}

// POST /api/v1/crm/dashboards/reports/:reportKey/panels/:panelKey/rows (200)
export function getPanelRows(
  reportKey: string,
  panelKey: string,
  body: PanelRowsRequest = {},
  signal?: AbortSignal,
): Promise<PanelRowsPage> {
  return raceAbort(() => crmQueries().fetchQuery<PanelRowsPage>({
    queryKey: ['crm-analytics', 'reports', reportKey, 'rows', panelKey, body],
    queryFn: async () => (await crmHttp().write<PanelRowsPage>('POST',
      `/dashboards/reports/${encodeURIComponent(reportKey)}/panels/${encodeURIComponent(panelKey)}/rows`,
      body, { key: newIdempotencyKey() })).data,
    staleTime: 0,
  }), signal);
}

// POST /api/v1/crm/dashboards/reports/:reportKey/panels/:panelKey/pin (201, header x-idempotency-key)
export async function pinPanel(
  reportKey: string,
  panelKey: string,
  body: PinPanelRequest,
  key: string,
): Promise<PinPanelResponse> {
  const queries = crmQueries();
  await queries.cancelQueries({ queryKey: ['crm-analytics'] });
  const result = await crmHttp().write<PinPanelResponse>('POST',
    `/dashboards/reports/${encodeURIComponent(reportKey)}/panels/${encodeURIComponent(panelKey)}/pin`,
    body, { key, ifMatch: String(body.revision) });
  await queries.invalidateQueries({ queryKey: ['crm-analytics'] });
  return result.data;
}

// GET /api/v1/crm/dashboards?kind=DASHBOARD&cursor: cursor rows `{ items, nextCursor }`, each with the caller's accessLevel.
export async function listDashboards(cursor: string | null = null): Promise<DashboardListPage> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'reports', 'pin-targets', cursor],
    queryFn: () => crmHttp().read('/dashboards', { kind: 'DASHBOARD', cursor }),
    staleTime: 0,
  });
}

/** Every dashboard row the caller can see, read page by page by cursor. */
export async function listAllDashboards(): Promise<DashboardListRow[]> {
  const rows: DashboardListRow[] = [];
  let cursor: string | null = null;
  do {
    const page = await listDashboards(cursor);
    rows.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return rows;
}

const PIN_ACCESS: ReadonlySet<DashboardListRow['accessLevel']> = new Set(['OWNER', 'MANAGE', 'EDIT']);

// Pinning needs EDIT, so VIEW-only dashboards are left out.
export async function listPinTargets(): Promise<PinTarget[]> {
  const rows = await listAllDashboards();
  return rows
    .filter((row) => PIN_ACCESS.has(row.accessLevel))
    .map((row) => ({ id: row.id, name: row.name, revision: row.revision }));
}

/** Default catalogue height of a visualization, used only when a panel's manifest carries no layout. */
export function defaultPanelHeight(kind: Visualization): number {
  const catalog = crmQueries().getQueryData<Catalog>(['crm-analytics', 'catalog', 'dashboards']);
  return catalog?.visualizations.find((entry) => entry.key === kind)?.defaultSize.h ?? 46;
}

/**
 * Choices for the PIPELINE, SOURCE and CURRENCY report filters (lead decision): the existing CRM pipelines
 * (GET /api/tenant/crm/v1/pipelines, crm.pipelines.read), CRM lead sources (GET /api/tenant/crm/v1/acquisition-sources)
 * and Core currencies. Active entries only. A list the caller may not read comes back empty, so the other
 * filters still work.
 */
export async function loadReportFilterLookups(): Promise<ReportFilterLookups> {
  const [pipelines, sources, currencies] = await Promise.allSettled([
    listPipelinesForRead(),
    listLeadSources(),
    tenantWide('currencies.currency.read') ? listActiveCoreCurrencyCodes() : Promise.resolve([]),
  ]);
  return {
    pipelines:
      pipelines.status === 'fulfilled'
        ? pipelines.value
            .filter((pipeline) => pipeline.isActive)
            .map((pipeline) => ({ id: pipeline.id, label: { en: pipeline.nameEn, ar: pipeline.nameAr } }))
        : [],
    sources:
      sources.status === 'fulfilled'
        ? [...sources.value]
            .filter((source) => source.isActive)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((source) => ({ id: source.id, label: { en: source.nameEn, ar: source.nameAr } }))
        : [],
    currencies: currencies.status === 'fulfilled' ? currencies.value : [],
  };
}
