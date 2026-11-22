import { fakeDelay, fakeDelayFor, raceAbort, withRunSlot } from '../../../../shared/widgets/dashboard/analytics-api';
import { listLeadSources } from '../../settings/lead-sources/lead-sources.api';
import { listPipelinesForRead } from '../../settings/pipelines/pipelines.api';
import { listActiveCoreCurrencyCodes } from '../../../../shared/lookups/core-currencies';
import {
  buildFakeManifest,
  buildFakePanelRows,
  catalogDefaultHeight,
  executeFakePinPanel,
  listFakeDashboards,
} from './report.fake';
import type { Visualization } from '../../../../shared/widgets/dashboard/analytics.model';
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
  await fakeDelay();
  return structuredClone(buildFakeManifest(reportKey, {}, false));
}

// POST /api/v1/crm/dashboards/reports/:reportKey (200)
export function runReport(reportKey: string, body: ReportRunRequest, signal?: AbortSignal): Promise<PanelManifest> {
  return withRunSlot(() =>
    raceAbort(async () => {
      await fakeDelayFor('run', `${reportKey}:${JSON.stringify(body.panelKeys ?? [])}`);
      return structuredClone(buildFakeManifest(reportKey, body, true));
    }, signal),
  );
}

// POST /api/v1/crm/dashboards/reports/:reportKey/panels/:panelKey/rows (200)
export function getPanelRows(
  reportKey: string,
  panelKey: string,
  body: PanelRowsRequest = {},
  signal?: AbortSignal,
): Promise<PanelRowsPage> {
  return withRunSlot(() =>
    raceAbort(async () => {
      await fakeDelay();
      return structuredClone(buildFakePanelRows(reportKey, panelKey, body));
    }, signal),
  );
}

// POST /api/v1/crm/dashboards/reports/:reportKey/panels/:panelKey/pin (201, header x-idempotency-key)
export async function pinPanel(
  reportKey: string,
  panelKey: string,
  body: PinPanelRequest,
  key: string,
): Promise<PinPanelResponse> {
  await fakeDelay();
  return structuredClone(executeFakePinPanel(reportKey, panelKey, body, key));
}

// GET /api/v1/crm/dashboards?kind=DASHBOARD&cursor: cursor rows `{ items, nextCursor }`, each with the caller's accessLevel.
export async function listDashboards(cursor: string | null = null): Promise<DashboardListPage> {
  await fakeDelay();
  return structuredClone(listFakeDashboards(cursor));
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
  return catalogDefaultHeight(kind);
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
    listActiveCoreCurrencyCodes(),
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
