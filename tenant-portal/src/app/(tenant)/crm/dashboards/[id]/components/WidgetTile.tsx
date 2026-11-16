"use client";

import { useRef } from "react";
import { useWidgetTilePresentation } from "../hooks/useWidgetTilePresentation";
import { AlertTriangle, Archive, Ellipsis, GitBranch, Table2, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  DegradedBanner,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  TargetGaugeChart,

} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { formatNumber } from "@/lib/format/number";
import type { WidgetResult } from "../../dashboard-run-contract";

import type { WidgetDefinition } from "../../widget-contract";
import type { DashboardCatalog } from "../../dashboard-catalog-contract";
import { hasPointComparison, plotsPointComparison } from "../../widget-view";
import { conversionSampleCaption, formatWidgetValue, widgetColor, widgetDisplayTitle, widgetDisplaySubtitle, widgetOption } from "../../widget-presentation";
import { WidgetPresentationNotice } from "./WidgetPresentationNotice";
import { WidgetChart } from "./WidgetChart";
import { GovernedTargetWidgetView } from "./GovernedTargetWidgetView";
import { WidgetDataTable } from "./WidgetDataTable";
import { WidgetHeaderIcon } from "./WidgetHeaderIcon";
import { WidgetScalarSeries } from "./WidgetScalarSeries";
import { WidgetCohortObservation } from "./WidgetCohortObservation";
import { WidgetCohortMaturitySummary } from "./WidgetCohortMaturitySummary";
import { WidgetDatasetComparisonSummary } from "./WidgetDatasetComparisonSummary";
import { WidgetSourceGrowthSummary } from "./WidgetSourceGrowthSummary";
import { WidgetSourceMixSummary } from "./WidgetSourceMixSummary";
import { WidgetAcquisitionQualitySummary } from "./WidgetAcquisitionQuality";
import { readSourceMix } from "../../widget-source-mix";
import { WidgetPeriodNote } from "./WidgetPeriodNote";
import { WidgetMonthlyIntakeSummary } from "./WidgetMonthlyIntakeSummary";
import { readMonthlyIntake } from "../../widget-monthly-intake";
import { WidgetLeadLifecycleNote } from "./WidgetLeadLifecycle";
import { isLifecycleWidget } from "../../widget-lead-lifecycle";

interface WidgetTileProps {
  widget: WidgetDefinition;
  result: WidgetResult | undefined;
  catalog?: DashboardCatalog | null;
  effectiveCurrencyCode?: string | null;
  onDrilldown: (widget: WidgetDefinition, pointKey: string, label: string) => void;
  onRemove?: (placementId: string) => void;
  onArchive?: (anchor: HTMLButtonElement | null) => boolean;
  onVersion?: (name: string, anchor: HTMLButtonElement | null) => boolean;
  placementId: string;
  isRemoving: boolean;
}

export function WidgetTile({
  widget,
  result: rawResult,
  catalog,
  effectiveCurrencyCode,
  onDrilldown,
  onRemove,
  onArchive,
  onVersion,
  placementId,
  isRemoving,
}: WidgetTileProps) {
  const { t, lang } = useI18n();
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const transferringFocus = useRef(false);
  const { result, mode, model, warnings, primaryMetricKey, palette, canDrilldown, drillNeedsCurrency, showTableToggle, isTableOpen, delta, toggleTable } = useWidgetTilePresentation(widget, rawResult, {
    label: t.crmDashboards.pointLabel, value: t.crmDashboards.pointValue,
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
  }, { catalog, lang, explicitCurrency: effectiveCurrencyCode });

  const title = widgetDisplayTitle(widget.name, widget.displaySpec);
  const monthlyIntake = readMonthlyIntake(result);
  const sourceMix = readSourceMix(result);
  const table = showTableToggle && isTableOpen ? <WidgetDataTable model={model} caption={title}
    onDrilldown={canDrilldown ? (pointKey, label) => onDrilldown(widget, pointKey, label) : undefined}
    drilldownLabel={t.crmDashboards.drilldown} /> : null;
  const tableBesideChart = Boolean((monthlyIntake || sourceMix) && table && mode !== "TABLE");
  const chartTableLayout = monthlyIntake
    ? "grid min-w-0 gap-3 @3xl:grid-cols-[minmax(0,2fr)_minmax(14rem,1fr)]"
    : "grid min-w-0 gap-3 @3xl:grid-cols-2";
  const subtitle = widgetDisplaySubtitle(widget.displaySpec);
  const showDelta = widgetOption(widget.displaySpec, "showDelta", true);
  const sampleCaption = result && mode !== "MULTI_KPI" && !result.errorCode && (result.state === "READY" || result.state === "EMPTY")
    ? conversionSampleCaption(result.details, t.crmDashboards.conversionSample, lang) : undefined;
  return (
    <Card className="flex h-full flex-col overflow-hidden p-0">
      <div className={`h-1 w-full ${palette.dot}`} style={{ backgroundColor: widgetColor(widget.displaySpec.color) }} aria-hidden="true" />
      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full ${palette.iconBoxIdle}`}
            >
              <WidgetHeaderIcon
                visualizationType={widget.visualizationType}
                metricKey={primaryMetricKey}
              />
            </span>
            <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>{subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}</div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {showTableToggle ? (
              <Button
                variant="ghost"
                size="sm"
                aria-label={
                  isTableOpen ? t.crmDashboards.hideDataTable : t.crmDashboards.showDataTable
                }
                aria-pressed={isTableOpen}
                onClick={toggleTable}
              >
                <Table2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
              </Button>
            ) : null}
            {onRemove ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={isRemoving}
                aria-label={`${t.crmDashboards.removeWidget}: ${widget.name}`}
                onClick={() => onRemove(placementId)}
              >
                <Trash2 className="size-4 text-destructive" aria-hidden="true" />
              </Button>
            ) : null}
            {(onVersion || onArchive) && <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild><Button ref={menuTrigger} variant="ghost" size="sm" aria-label={formatTemplate(t.crmWidgets.governance.actions, { name: title })}>
                <Ellipsis className="size-4 text-muted-foreground" aria-hidden="true" />
              </Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" onCloseAutoFocus={(event) => {
                if (transferringFocus.current) event.preventDefault();
                transferringFocus.current = false;
              }}>
              {onVersion && <DropdownMenuItem onSelect={() => { transferringFocus.current = onVersion(title, menuTrigger.current); }}>
                <GitBranch className="size-4" aria-hidden="true" />{t.crmDashboards.placementVersion.title}
              </DropdownMenuItem>}
              {onArchive && <DropdownMenuItem onSelect={() => { transferringFocus.current = onArchive(menuTrigger.current); }}>
                <Archive className="size-4" aria-hidden="true" />{t.crmWidgets.governance.archive}
              </DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>}
          </div>
        </div>

        <WidgetPresentationNotice visualizationType={mode === "TABLE" ? "TABLE" : widget.visualizationType} displaySpec={widget.displaySpec} querySpec={widget.querySpec} unit={result?.unit} />
        <WidgetPeriodNote query={widget.querySpec} result={result} />
        {monthlyIntake && <WidgetMonthlyIntakeSummary data={monthlyIntake} />}
        {result?.partialAccess && <p role="note" className="text-xs text-muted-foreground">{t.crmDashboards.partialAccessNotice}</p>}
        {!!result?.ignoredFilters?.length && <p role="note" className="text-xs text-muted-foreground">{t.crmDashboards.ignoredFiltersNotice}</p>}
        {result && !result.errorCode && !result.governedTarget && mode === "TABLE" && widget.visualizationType !== "TABLE" && <p role="note" className="text-xs text-muted-foreground">{t.crmWidgets.review.tableFallback}</p>}
        {result && !result.errorCode && showTableToggle && hasPointComparison(result) && !plotsPointComparison(mode) && <p role="note" className="text-xs text-muted-foreground">{t.crmWidgets.review.comparisonTable}</p>}
        {result && !result.errorCode && result.state === "READY" && <WidgetCohortMaturitySummary details={result.details} />}
        {result && !result.errorCode && (result.state === "READY" || result.state === "EMPTY") && <WidgetDatasetComparisonSummary details={result.details} />}
        {result && !result.errorCode && (result.state === "READY" || result.state === "EMPTY") && <WidgetSourceGrowthSummary result={result} />}
        {result && <WidgetSourceMixSummary result={result} />}
        {result && <WidgetAcquisitionQualitySummary result={result} />}
        {result && <WidgetLeadLifecycleNote result={result} />}
        {result === undefined ? (
          <p className="text-xs text-muted-foreground">{t.crmDashboards.widgetNotExecuted}</p>
        ) : result.state === "RETIRED" ? (
          <p role="note" className="text-xs text-muted-foreground">{t.crmDashboards.metricRetired}</p>
        ) : result.governedTarget ? (
          <GovernedTargetWidgetView visualizationType={widget.visualizationType} result={result} label={title} displaySpec={widget.displaySpec} />
        ) : result.state === "UNAVAILABLE" ? (
          <p role="note" className="text-xs text-muted-foreground">{t.crmDashboards.errors[result.errorCode ?? ""] ?? t.crmDashboards.widgetDataUnavailable}</p>
        ) : result.errorCode !== null || result.state === "FAILED" || result.state === "DEADLINE_EXCEEDED" ? (
          <div
            role="note"
            className="flex flex-col gap-1 rounded-sm border border-border bg-muted p-2.5"
          >
            <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
              {t.crmDashboards.widgetFailed}
            </p>
            <p className="text-2xs text-muted-foreground">
              {t.crmDashboards.widgetErrors[result.errorCode ?? ""] ?? t.crmDashboards.widgetFailedGeneric}
            </p>
          </div>
        ) : result.state === "EMPTY" && isLifecycleWidget(result) ? (
          <p className="text-xs text-muted-foreground">{t.crmDashboardReports.leadLifecycle.empty}</p>
        ) : mode === "SCALAR" && result.value !== null ? (
          <div className="flex flex-1 flex-col justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums" style={{ color: widgetColor(widget.displaySpec.color) }}>
                {formatWidgetValue(result.value, result.unit, result.currency, lang, widget.displaySpec)}
              </p>
              {showDelta && delta ? (
                <Badge tone={delta.tone} className="tabular-nums">
                  {`${delta.sign === "up" ? "+" : ""}${formatNumber(delta.deltaPercent, lang, {
                    style: "unit",
                    unit: "percent",
                    maximumFractionDigits: 1,
                  })} ${t.crmDashboards.relativeChange} (${formatWidgetValue(result.previousValue ?? 0, result.unit, result.currency, lang, widget.displaySpec)})`}
                </Badge>
              ) : showDelta && result.previousValue !== null ? (
                <span className="text-2xs text-muted-foreground tabular-nums">
                  {formatTemplate(t.crmDashboards.previousValue, {
                    value: formatWidgetValue(result.previousValue, result.unit, result.currency, lang, widget.displaySpec),
                  })}
                </span>
              ) : null}
            </div>
            {result.target !== null && result.target > 0 ? (
              <div className="space-y-1"><p className="text-xs" style={{ color: widgetColor(widget.displaySpec.targetColor) }}>{formatTemplate(t.crmDashboards.targetOf, { target: formatWidgetValue(result.target, result.unit, result.currency, lang, widget.displaySpec) })}</p><TargetGaugeChart variant="progress" compact
                value={result.value}
                target={result.target}
                label={t.crmDashboards.targetProgress}
                summary={t.crmDashboards.chartExactTable}
                valueLabel={formatWidgetValue(result.value, result.unit, result.currency, lang, widget.displaySpec)}
                targetLabel={formatTemplate(t.crmDashboards.targetOf, {
                  target: formatWidgetValue(result.target, result.unit, result.currency, lang, widget.displaySpec),
                })}
                formatAxis={(value) => formatWidgetValue(value, result.unit, result.currency, lang, widget.displaySpec)}
                valueColor={widgetColor(widget.displaySpec.color)} targetColor={widgetColor(widget.displaySpec.targetColor)}
              /></div>
            ) : null}
          </div>
        ) : mode === "MULTI_KPI" ? (
          <WidgetScalarSeries result={result} displaySpec={widget.displaySpec} />
        ) : mode === "TABLE" || mode === "SCALAR" ? (
          <div className="flex flex-col gap-2">
            {result.value !== null && <p className="text-xl font-semibold text-foreground tabular-nums">{formatWidgetValue(result.value, result.unit, result.currency, lang, {})}</p>}
            {result.target !== null && <p className="text-xs text-muted-foreground" style={{ color: widgetColor(widget.displaySpec.targetColor) }}>{formatTemplate(t.crmDashboards.targetOf, { target: formatWidgetValue(result.target, result.unit, result.currency, lang, {}) })}</p>}
            {result.previousValue !== null && <p className="text-xs text-muted-foreground">{formatTemplate(t.crmDashboards.previousValue, { value: formatWidgetValue(result.previousValue, result.unit, result.currency, lang, {}) })}</p>}
            {(model.rows.length > 0 || result.value === null) && <WidgetDataTable
            model={model}
            caption={title}
            onDrilldown={
              canDrilldown
                ? (pointKey, label) => onDrilldown(widget, pointKey, label)
                : undefined
            }
            drilldownLabel={t.crmDashboards.drilldown}
            />}
          </div>
        ) : (
          <div className={tableBesideChart ? "@container" : "contents"}>
            <div className={tableBesideChart ? chartTableLayout : "contents"}>
              <WidgetChart mode={mode} visualizationType={widget.visualizationType} result={result} label={title}
                displaySpec={widget.displaySpec} querySpec={widget.querySpec}
                onDrilldown={canDrilldown ? (pointKey, pointLabel) => onDrilldown(widget, pointKey, pointLabel) : undefined} />
              {tableBesideChart && table}
            </div>
          </div>
        )}

        {sampleCaption && <p className="text-xs text-muted-foreground">{sampleCaption}</p>}
        <WidgetCohortObservation result={result} />
        {drillNeedsCurrency && <p role="note" className="text-2xs text-muted-foreground">{t.crmDashboards.drillCurrencyRequired}</p>}
        {warnings.length > 0 ? (
          <DegradedBanner
            message={warnings
              .map((warning) => t.crmDashboards.widgetWarnings[warning] ?? t.crmDashboards.widgetWarningGeneric)
              .join(" · ")}
          />
        ) : null}

        {table && !tableBesideChart && <div className="mt-2 border-t border-border pt-2">{table}</div>}
      </div>
    </Card>
  );
}
