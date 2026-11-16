import { civilDateRange, invalidResponse, nonEmptyString, record } from "../dashboard-parse";
import { parseDashboardExecutionResponse, type DashboardFilterSelection } from "../dashboard-run-contract";
import { parseQuerySpec } from "../widget-response";
import {
  LEAD_CURRENT_RATING_MIX, LEAD_INQUIRY_CLASSIFICATION, LEAD_MISSING_SOURCE_SHARE,
  readCurrentRatingMix, readInquiryClassification, readMissingSourceShare,
} from "../widget-acquisition-quality";

export const INQUIRY_QUALITY_REPORT_PATH = "/api/tenant/crm/v1/dashboards/lead-acquisition-quality-report";
const PANELS = [
  { key: "missing-source-share", visualizationType: "PROGRESS_CARD", metric: LEAD_MISSING_SOURCE_SHARE, dimension: "none", validate: readMissingSourceShare },
  { key: "current-rating-mix", visualizationType: "STACKED_BAR", metric: LEAD_CURRENT_RATING_MIX, dimension: "lead_rating", validate: readCurrentRatingMix },
  { key: "inquiry-classification", visualizationType: "COLUMN", metric: LEAD_INQUIRY_CLASSIFICATION, dimension: "inquiry_classification", validate: readInquiryClassification },
] as const;

export function parseInquiryQualityReport(payload: unknown, selection: DashboardFilterSelection) {
  const source = record(payload);
  const rows = source?.panels;
  if (source?.reportKey !== "LEAD_ACQUISITION_QUALITY" || !Array.isArray(rows) || rows.length !== PANELS.length) {
    invalidResponse("inquiry quality report");
  }
  const run = parseDashboardExecutionResponse(source, selection, true);
  if (!run.organizationScope || !run.populationScope || Object.keys(run.widgets).length !== PANELS.length) {
    invalidResponse("inquiry quality scope");
  }
  const { datePreset, dateFrom, dateTo, timeZone } = run.filters;
  const period = civilDateRange({ from: dateFrom, to: dateTo });
  if (!period || !nonEmptyString(timeZone) || datePreset !== (selection.datePreset ?? "LAST_MONTH")
    || (datePreset === "CUSTOM" && (dateFrom !== selection.dateFrom || dateTo !== selection.dateTo))) {
    invalidResponse("inquiry quality period");
  }
  const panels = PANELS.map(({ key, visualizationType, metric, dimension, validate }, index) => {
    const panel = record(rows[index]);
    const displaySpec = record(panel?.displaySpec);
    const result = run.widgets[key];
    if (!panel || panel.key !== key || panel.visualizationType !== visualizationType || !nonEmptyString(panel.nameAr)
      || !nonEmptyString(panel.nameEn) || !displaySpec || result?.widgetId !== key || !result.state) {
      invalidResponse("inquiry quality panel");
    }
    const querySpec = parseQuerySpec(panel.querySpec);
    const effective = result.effectivePeriod;
    if (querySpec.series.length !== 1 || querySpec.series[0].metricKey !== metric
      || querySpec.dimension?.key !== dimension || querySpec.dimension.grain !== undefined || querySpec.comparison?.type !== "NONE"
      || (effective && (effective.from !== period.from || effective.to !== period.to || effective.timeZone !== timeZone))
      || (result.state === "READY" && (!effective || !validate(result)))
      || (result.state === "EMPTY" && result.series.length > 0 && !validate(result))) {
      invalidResponse("inquiry quality panel evidence");
    }
    return { key, visualizationType, nameAr: panel.nameAr, nameEn: panel.nameEn, displaySpec, querySpec, result };
  });
  const [share, rating, classification] = panels.map(panel => panel.result);
  const counts = readMissingSourceShare(share);
  const ratings = readCurrentRatingMix(rating);
  const identities = readInquiryClassification(classification);
  if ((counts && ratings && counts.denominator !== ratings.total)
    || (counts && identities && (classification.partialAccess ? identities.total > counts.denominator : identities.total !== counts.denominator))) {
    invalidResponse("inquiry quality reconciliation");
  }
  return { generatedAt: run.generatedAt, organization: run.organizationScope, population: run.populationScope,
    partialAccess: record(source.organizationScope)?.partialAccess === true, panels };
}
