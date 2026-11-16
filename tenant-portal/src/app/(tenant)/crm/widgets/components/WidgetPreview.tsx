"use client";

import { DegradedBanner, StatCard } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { displayWarnings, type WidgetResult } from "../../dashboards/dashboard-run-contract";
import { hasPointComparison, plotsPointComparison, widgetDataUnavailable, widgetRenderMode, widgetTableModel } from "../../dashboards/widget-view";
import type { CrmVisualization, WidgetQuerySpec } from "../../dashboards/widget-contract";
import { conversionSampleCaption, formatWidgetValue, widgetColor, widgetDisplayTitle, widgetDisplaySubtitle, widgetOption } from "../../dashboards/widget-presentation";
import { WidgetPresentationNotice } from "../../dashboards/[id]/components/WidgetPresentationNotice";
import { WidgetChart } from "../../dashboards/[id]/components/WidgetChart";
import { GovernedTargetWidgetView } from "../../dashboards/[id]/components/GovernedTargetWidgetView";
import { WidgetDataTable } from "../../dashboards/[id]/components/WidgetDataTable";
import { WidgetScalarSeries } from "../../dashboards/[id]/components/WidgetScalarSeries";
import { WidgetCohortObservation } from "../../dashboards/[id]/components/WidgetCohortObservation";
import { WidgetCohortMaturitySummary } from "../../dashboards/[id]/components/WidgetCohortMaturitySummary";
import { WidgetDatasetComparisonSummary } from "../../dashboards/[id]/components/WidgetDatasetComparisonSummary";
import { WidgetSourceGrowthSummary } from "../../dashboards/[id]/components/WidgetSourceGrowthSummary";
import { WidgetPeriodNote } from "../../dashboards/[id]/components/WidgetPeriodNote";
import { WidgetMonthlyIntakeSummary } from "../../dashboards/[id]/components/WidgetMonthlyIntakeSummary";
import { readMonthlyIntake } from "../../dashboards/widget-monthly-intake";
import { readMissingSourceShare } from "../../dashboards/widget-acquisition-quality";
import { WidgetSourceMixSummary } from "../../dashboards/[id]/components/WidgetSourceMixSummary";
import { WidgetAcquisitionQualitySummary } from "../../dashboards/[id]/components/WidgetAcquisitionQuality";
import { WidgetLeadLifecycleNote } from "../../dashboards/[id]/components/WidgetLeadLifecycle";
import { isLifecycleWidget } from "../../dashboards/widget-lead-lifecycle";
import type { DashboardCatalog } from "../../dashboards/dashboard-catalog-contract";
import { localizeWidgetResult } from "../../dashboards/widget-labels";

interface WidgetPreviewProps {
  result: WidgetResult;
  visualizationType?: CrmVisualization;
  displaySpec?: Record<string, unknown>;
  querySpec?: WidgetQuerySpec;
  name?: string;
  catalog?: DashboardCatalog | null;
  tablePlacement?: "side" | "balanced" | "collapsible";
}

export function WidgetPreview({ result: rawResult, visualizationType, displaySpec = {}, querySpec, name, catalog, tablePlacement }: WidgetPreviewProps) {
  const { t, lang } = useI18n();
  const result = localizeWidgetResult(rawResult, catalog, lang, querySpec, t.crmDashboards.datasets);
  const title = widgetDisplayTitle(name || t.crmWidgets.preview, displaySpec);
  const subtitle = widgetDisplaySubtitle(displaySpec);
  const monthlyIntake = readMonthlyIntake(result);
  const model = widgetTableModel(result, {
    label: t.crmDashboards.pointLabel,
    value: t.crmDashboards.pointValue,
    previousValue: t.crmDashboards.pointPreviousValue, previousKey: t.crmDashboards.pointPreviousKey,
    target: t.crmWidgets.target, currentValue: t.crmDashboards.currentValue,
    governedTarget: t.crmDashboardReports.wonTarget,
    cohortConverted: t.crmDashboards.cohortConverted, cohortEligible: t.crmDashboards.cohortEligible,
    maturity: t.crmDashboards.maturity,
    datasets: t.crmDashboards.datasets,
    sourceGrowth: t.crmDashboards.sourceGrowth,
    monthlyIntake: t.crmDashboards.monthlyIntake,
    sourceMix: t.crmDashboards.sourceMix,
    acquisitionQuality: t.crmDashboards.acquisitionQuality,
    leadLifecycle: t.crmDashboardReports.leadLifecycle,
    probability: `${t.crmDashboards.winProbability} (%)`, amount: t.crmDashboards.dealValue, ageDays: t.crmDashboards.dealAgeDays, typed: t.crmDashboards.typedTable,
  });
  const warnings = displayWarnings(result.warnings);
  const mode = visualizationType ? widgetRenderMode(visualizationType, result) : "TABLE";
  const emptyLifecycle = result.state === "EMPTY" && isLifecycleWidget(result);
  const chartMode = !emptyLifecycle && !["TABLE", "SCALAR", "MULTI_KPI"].includes(mode)
    ? mode as Exclude<typeof mode, "TABLE" | "SCALAR" | "MULTI_KPI"> : null;
  const sampleCaption = mode === "MULTI_KPI" ? undefined : conversionSampleCaption(result.details, t.crmDashboards.conversionSample, lang);
  const chart = chartMode && <WidgetChart mode={chartMode} visualizationType={visualizationType} result={result} label={title} displaySpec={displaySpec} querySpec={querySpec} />;
  const table = model.rows.length > 0 && <WidgetDataTable model={model} caption={t.crmWidgets.previewCaption} />;
  const combined = (tablePlacement === "side" || tablePlacement === "balanced") && chart && table;
  const collapsible = tablePlacement === "collapsible" && chart && table;
  const sourcePermissionNotice = result.warnings.includes("SOURCE_PERMISSION_REQUIRED")
    ? t.crmDashboards.widgetWarnings.SOURCE_PERMISSION_REQUIRED : undefined;
  const populationProgress = chartMode === "GAUGE" && visualizationType === "PROGRESS_CARD" && readMissingSourceShare(result);

  if (result.governedTarget) return <div className="space-y-2">
    <h3 className="text-sm font-semibold">{title}</h3>
    {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    <GovernedTargetWidgetView visualizationType={visualizationType} result={result} label={title} displaySpec={displaySpec} />
    {model.rows.length > 0 && <WidgetDataTable model={model} caption={t.crmWidgets.previewCaption} />}
  </div>;

  if (widgetDataUnavailable(result) || result.errorCode !== null) return <div className="space-y-2">
    <h3 className="text-sm font-semibold">{title}</h3>
    <DegradedBanner message={result.state === "RETIRED" ? t.crmDashboards.metricRetired
      : result.state === "UNAVAILABLE" ? t.crmDashboards.errors[result.errorCode ?? ""] ?? sourcePermissionNotice ?? t.crmDashboards.widgetDataUnavailable
      : t.crmDashboards.widgetErrors[result.errorCode ?? ""] ?? t.crmDashboards.widgetFailedGeneric} />
  </div>;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold" style={{ color: widgetColor(displaySpec.color) }}>{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      <WidgetPresentationNotice visualizationType={mode === "TABLE" ? "TABLE" : visualizationType} displaySpec={displaySpec} querySpec={querySpec} unit={result.unit} />
      <WidgetPeriodNote query={querySpec} result={result} />
      {monthlyIntake && <WidgetMonthlyIntakeSummary data={monthlyIntake} />}
      <WidgetSourceMixSummary result={result} />
      <WidgetAcquisitionQualitySummary result={result} />
      <WidgetLeadLifecycleNote result={result} />
      {result.partialAccess && <p role="note" className="text-xs text-muted-foreground">{t.crmDashboards.partialAccessNotice}</p>}
      {!!result.ignoredFilters?.length && <p role="note" className="text-xs text-muted-foreground">{t.crmDashboards.ignoredFiltersNotice}</p>}
      <WidgetCohortMaturitySummary details={result.details} />
      <WidgetDatasetComparisonSummary details={result.details} />
      <WidgetSourceGrowthSummary result={result} />
      {combined ? <div className="@container">
        <div className={tablePlacement === "balanced" ? "grid gap-3 @3xl:grid-cols-2" : "grid gap-3 @3xl:grid-cols-[minmax(0,2fr)_minmax(14rem,1fr)]"}>
          <div className="min-w-0">{chart}</div>
          <div className="min-w-0">{table}</div>
        </div>
      </div> : chart}
      {mode === "TABLE" && visualizationType && visualizationType !== "TABLE" && <p className="text-xs text-muted-foreground">{t.crmWidgets.review.tableFallback}</p>}
      {chartMode && hasPointComparison(result) && !plotsPointComparison(chartMode) && <p className="text-xs text-muted-foreground">{t.crmWidgets.review.comparisonTable}</p>}
      {mode === "MULTI_KPI" ? <WidgetScalarSeries result={result} displaySpec={displaySpec} /> : !emptyLifecycle && !populationProgress && result.value !== null ? (
        <StatCard
          label={t.crmDashboards.currentValue}
          value={formatWidgetValue(result.value, result.unit, result.currency, lang, mode === "TABLE" ? {} : displaySpec)}
        />
      ) : null}
      {sampleCaption && <p className="text-xs text-muted-foreground">{sampleCaption}</p>}
      <WidgetCohortObservation result={result} />
      {result.previousValue !== null && (mode === "TABLE" || widgetOption(displaySpec, "showDelta", true)) && <p className="text-sm text-muted-foreground">{t.crmDashboards.previousValue.replace("{value}", formatWidgetValue(result.previousValue, result.unit, result.currency, lang, mode === "TABLE" ? {} : displaySpec))}</p>}
      {result.target !== null && <p className="text-sm text-muted-foreground" style={{ color: widgetColor(displaySpec.targetColor) }}>{t.crmWidgets.target}: {formatWidgetValue(result.target, result.unit, result.currency, lang, mode === "TABLE" ? {} : displaySpec)}</p>}

      {warnings.length > 0 ? (
        <DegradedBanner
          message={warnings
            .map((warning) => t.crmDashboards.widgetWarnings[warning] ?? t.crmDashboards.widgetWarningGeneric)
            .join(" · ")}
        />
      ) : null}

      {emptyLifecycle ? <p className="text-xs text-muted-foreground">{t.crmDashboardReports.leadLifecycle.empty}</p>
        : model.rows.length === 0 && result.value === null ? (
        <p className="text-xs text-muted-foreground">{t.crmDashboards.noData}</p>
      ) : collapsible ? <details className="rounded-md border border-border">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">{t.crmWidgets.previewExactData}</summary>
        {table}
      </details> : !combined && table}
    </div>
  );
}
