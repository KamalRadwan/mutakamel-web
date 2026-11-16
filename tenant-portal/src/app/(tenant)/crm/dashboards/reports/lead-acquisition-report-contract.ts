import { invalidResponse, nonEmptyString, record } from "../dashboard-parse";
import { parseDashboardExecutionResponse, type DashboardFilterSelection } from "../dashboard-run-contract";
import { parseQuerySpec } from "../widget-response";

// Matches the LEAD_ACQUISITION recipe in CRM's dashboard-catalog.ts.
const PANELS = [
  { key: "monthly-intake", visualizationType: "LINE", metric: "crm.leads.created.trend", dimension: "time", grain: "MONTH" },
  { key: "arrival-heatmap", visualizationType: "HEATMAP", metric: "crm.leads.created.by_weekday_hour.count", dimension: "lead_arrival_slot", grain: undefined },
  { key: "source-growth", visualizationType: "BAR", metric: "crm.leads.created.by_source.growth_percent", dimension: "source", grain: undefined },
] as const;

export const LEAD_ACQUISITION_REPORT_PATH = "/api/tenant/crm/v1/dashboards/lead-acquisition-report";

export function parseLeadAcquisitionReport(payload: unknown, selection: DashboardFilterSelection) {
  const source = record(payload);
  const rows = source?.panels;
  if (source?.reportKey !== "LEAD_ACQUISITION" || !Array.isArray(rows) || rows.length !== PANELS.length) {
    invalidResponse("lead acquisition report");
  }
  const run = parseDashboardExecutionResponse(source, selection, true);
  if (!run.organizationScope || !run.populationScope || Object.keys(run.widgets).length !== PANELS.length) {
    invalidResponse("lead acquisition scope");
  }

  const panels = PANELS.map(({ key, visualizationType, metric, dimension, grain }, index) => {
    const row = record(rows[index]);
    const result = run.widgets[key];
    const displaySpec = record(row?.displaySpec);
    if (!row || row.key !== key || row.visualizationType !== visualizationType || !nonEmptyString(row.nameAr)
      || !nonEmptyString(row.nameEn) || !displaySpec || result?.widgetId !== key || !result.state) {
      invalidResponse("lead acquisition panel");
    }
    const querySpec = parseQuerySpec(row.querySpec);
    if (querySpec.series.length !== 1 || querySpec.series[0].metricKey !== metric
      || querySpec.dimension?.key !== dimension || querySpec.dimension.grain !== grain
      || (result.state === "READY" && (!result.effectivePeriod || result.unit !== (key === "source-growth" ? "PERCENT" : "COUNT")))) {
      invalidResponse("lead acquisition panel");
    }
    return { key, visualizationType, nameAr: row.nameAr, nameEn: row.nameEn, displaySpec, querySpec, result };
  });
  return { generatedAt: run.generatedAt, organization: run.organizationScope, population: run.populationScope,
    partialAccess: record(source.organizationScope)?.partialAccess === true, panels };
}

export type LeadAcquisitionReportResult = ReturnType<typeof parseLeadAcquisitionReport>;
