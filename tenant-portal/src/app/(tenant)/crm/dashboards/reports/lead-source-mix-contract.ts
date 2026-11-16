import { invalidResponse, nonEmptyString, record } from "../dashboard-parse";
import { parseDashboardExecutionResponse, type DashboardFilterSelection } from "../dashboard-run-contract";
import { parseQuerySpec } from "../widget-response";
import { LEAD_SOURCE_MIX_METRIC, readSourceMix } from "../widget-source-mix";

export const LEAD_SOURCE_MIX_REPORT_PATH = "/api/tenant/crm/v1/dashboards/lead-source-mix-report";

export function parseLeadSourceMixReport(payload: unknown, selection: DashboardFilterSelection) {
  const source = record(payload);
  if (source?.reportKey !== "LEAD_SOURCE_MIX" || !Array.isArray(source.panels) || source.panels.length !== 1) {
    invalidResponse("lead source mix report");
  }
  const panel = record(source.panels[0]);
  const displaySpec = record(panel?.displaySpec);
  const run = parseDashboardExecutionResponse(source, selection, true);
  const result = run.widgets["source-mix"];
  if (!panel || panel.key !== "source-mix" || panel.visualizationType !== "PIE"
    || !nonEmptyString(panel.nameAr) || !nonEmptyString(panel.nameEn) || !displaySpec
    || Object.keys(run.widgets).length !== 1 || result?.widgetId !== "source-mix" || !result.state
    || !run.organizationScope || !run.populationScope) invalidResponse("lead source mix panel");
  const querySpec = parseQuerySpec(panel.querySpec);
  const mix = readSourceMix(result);
  if (querySpec.series.length !== 1 || querySpec.series[0].metricKey !== LEAD_SOURCE_MIX_METRIC
    || querySpec.dimension?.key !== "source" || querySpec.comparison?.type !== "NONE"
    || (result.state === "READY" && (!result.effectivePeriod || !mix))
    || (result.state === "EMPTY" && !mix && result.series.some(series => series.points.length > 0))
    || (result.details?.sourceMix !== undefined && !mix)) {
    invalidResponse("lead source mix evidence");
  }
  return { generatedAt: run.generatedAt, organization: run.organizationScope, population: run.populationScope,
    partialAccess: record(source.organizationScope)?.partialAccess === true,
    panel: { nameAr: panel.nameAr, nameEn: panel.nameEn, querySpec, displaySpec, result } };
}
