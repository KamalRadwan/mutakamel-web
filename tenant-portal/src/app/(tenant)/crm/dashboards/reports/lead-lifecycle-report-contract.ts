import { civilDateRange, invalidResponse, nonEmptyString, record, timestamp } from "../dashboard-parse";
import { parseDashboardExecutionResponse, type DashboardFilterSelection } from "../dashboard-run-contract";
import { LIFECYCLE_METRICS, isLifecycleTimeZone, readLeadLifecycle } from "../widget-lead-lifecycle";
import { parseQuerySpec } from "../widget-response";

export const LEAD_LIFECYCLE_REPORT_PATH = "/api/tenant/crm/v1/dashboards/lead-lifecycle-inventory-report";
const PANELS = [
  { key: "current-status", kind: "status", visualization: "DONUT", dimension: "lead_status" },
  { key: "current-stage", kind: "stage", visualization: "COLUMN", dimension: "lead_stage" },
  { key: "qualified-open", kind: "qualified", visualization: "METRIC_CARD", dimension: "none" },
] as const;

export function parseLeadLifecycleReport(payload: unknown, selection: DashboardFilterSelection) {
  const source = record(payload);
  const rows = source?.panels;
  if (source?.reportKey !== "LEAD_LIFECYCLE_INVENTORY" || !Array.isArray(rows) || rows.length !== PANELS.length) {
    invalidResponse("lead lifecycle report");
  }
  const run = parseDashboardExecutionResponse(source, selection, true);
  if (!run.organizationScope || !run.populationScope || Object.keys(run.widgets).length !== PANELS.length) {
    invalidResponse("lead lifecycle scope");
  }
  const { datePreset, dateFrom, dateTo, timeZone, asOf } = run.filters;
  const period = civilDateRange({ from: dateFrom, to: dateTo });
  if (!period || !isLifecycleTimeZone(timeZone) || !timestamp(asOf) || Date.parse(asOf) > Date.parse(run.generatedAt)
    || datePreset !== (selection.datePreset ?? "LAST_MONTH")
    || (datePreset === "CUSTOM" && (dateFrom !== selection.dateFrom || dateTo !== selection.dateTo))) {
    invalidResponse("lead lifecycle period");
  }
  const panels = PANELS.map(({ key, kind, visualization, dimension }, index) => {
    const panel = record(rows[index]);
    const widget = run.widgets[key];
    if (!panel || panel.key !== key || panel.visualizationType !== visualization || !nonEmptyString(panel.nameAr)
      || !nonEmptyString(panel.nameEn) || !record(panel.displaySpec) || widget?.widgetId !== key || !widget.state) {
      invalidResponse("lead lifecycle panel");
    }
    const query = parseQuerySpec(panel.querySpec);
    if (query.series.length !== 1 || query.series[0].metricKey !== LIFECYCLE_METRICS[kind]
      || query.dimension?.key !== dimension || query.dimension.grain !== undefined || query.comparison?.type !== "NONE") {
      invalidResponse("lead lifecycle panel query");
    }
    const available = widget.state === "READY" || widget.state === "EMPTY";
    const data = available ? readLeadLifecycle(widget) : null;
    const effective = widget.effectivePeriod;
    const emptyWithoutRows = widget.state === "EMPTY" && widget.warnings.includes("NO_DATA")
      && widget.unit === "COUNT" && widget.timeBasis === "COHORT" && widget.shape === (kind === "qualified" ? "SCALAR" : "CATEGORY")
      && !widget.errorCode && widget.value === null && !widget.series.length && !widget.rows.length && widget.details === undefined;
    if ((effective && (effective.from !== period.from || effective.to !== period.to || effective.timeZone !== timeZone))
      || (data && (data.kind !== kind || !effective || Date.parse(data.asOf) !== Date.parse(asOf)))
      || (available && !data && !emptyWithoutRows)) invalidResponse("lead lifecycle panel evidence");
    return { key, nameAr: panel.nameAr, nameEn: panel.nameEn, widget, data };
  });
  const evidence = panels.flatMap(panel => panel.data ? [panel.data] : []);
  const [first] = evidence;
  if (first && (evidence.some(data => data.total !== first.total)
    || (first.total > 0 && panels.some(panel => panel.widget.state === "EMPTY")))) {
    invalidResponse("lead lifecycle population reconciliation");
  }
  const status = evidence.find(data => data.kind === "status");
  const stage = evidence.find(data => data.kind === "stage");
  const qualified = evidence.find(data => data.kind === "qualified");
  const open = status?.rows.find(row => row.key === "OPEN")?.count;
  const onHold = status?.rows.find(row => row.key === "ON_HOLD")?.count;
  if (status && ((stage && (stage.rows.reduce((sum, row) => sum + row.open, 0) !== (open ?? 0)
    || stage.rows.reduce((sum, row) => sum + row.onHold, 0) !== (onHold ?? 0)))
    || (qualified && (qualified.qualified.open > (open ?? 0) || qualified.qualified.onHold > (onHold ?? 0)
      || qualified.qualified.other > status.total - (open ?? 0) - (onHold ?? 0))))) {
    invalidResponse("lead lifecycle status reconciliation");
  }
  return { panels, period: { ...period, timeZone }, asOf,
    organization: run.organizationScope, population: run.populationScope,
    partialAccess: record(source.organizationScope)?.partialAccess === true || panels.some(panel => panel.widget.partialAccess) };
}
