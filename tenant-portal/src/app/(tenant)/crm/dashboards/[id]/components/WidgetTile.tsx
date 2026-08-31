"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DegradedBanner,
  Progress,
  StatCard,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { formatNumber } from "@/lib/format/number";
import type { WidgetResult } from "../../dashboard-run-contract";
import { displayWarnings } from "../../dashboard-run-contract";
import type { WidgetDefinition } from "../../widget-contract";
import { formatMetricValue, widgetRenderMode, widgetTableModel } from "../../widget-view";
import { WidgetChart } from "./WidgetChart";
import { WidgetDataTable } from "./WidgetDataTable";

interface WidgetTileProps {
  widget: WidgetDefinition;
  result: WidgetResult | undefined;
  onDrilldown: (widget: WidgetDefinition, pointKey: string, label: string) => void;
  onRemove?: (placementId: string) => void;
  placementId: string;
  isRemoving: boolean;
}

/**
 * One widget on a dashboard.
 *
 * A widget that failed still renders as a widget: `DashboardExecutionService`
 * rolls its statement back to a savepoint and returns
 * `{ error: { code }, meta: { warnings: ['WIDGET_EXECUTION_FAILED'] } }`
 * beside every widget that worked. Naming the failure **here**, in the tile
 * that failed, is the whole point — the dashboard is not an all-or-nothing
 * request (docs/design/states.md, state 11).
 */
export function WidgetTile({
  widget,
  result,
  onDrilldown,
  onRemove,
  placementId,
  isRemoving,
}: WidgetTileProps) {
  const { t, lang } = useI18n();
  const [isTableOpen, setIsTableOpen] = useState(false);

  const mode = result ? widgetRenderMode(widget.visualizationType, result) : "TABLE";
  const model = result
    ? widgetTableModel(result, {
        label: t.crmDashboards.pointLabel,
        value: t.crmDashboards.pointValue,
      })
    : { columns: [], rows: [] };
  const warnings = result ? displayWarnings(result.warnings) : [];

  // Drill-down resolves its selection against the **stored** widget, and its
  // series key vocabulary is the stored `querySpec.series` — not the executed
  // series keys, which split by currency. Offering it only for a
  // single-series widget keeps the key unambiguous and lets the server infer
  // the index (dashboard-drilldown.strategies.ts).
  const canDrilldown =
    result !== undefined &&
    result.errorCode === null &&
    result.typedResult === null &&
    widget.querySpec.series.length === 1;

  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-foreground">{widget.name}</h3>
          <p className="truncate text-2xs text-muted-foreground">
            {t.crmDashboards.visualizations[widget.visualizationType] ?? widget.visualizationType}
          </p>
        </div>
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
      </div>

      {result === undefined ? (
        <p className="text-xs text-muted-foreground">{t.crmDashboards.widgetNotExecuted}</p>
      ) : result.errorCode !== null ? (
        <div
          role="note"
          className="flex flex-col gap-1 rounded-sm border border-border bg-muted p-2.5"
        >
          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
            {t.crmDashboards.widgetFailed}
          </p>
          <p className="text-2xs text-muted-foreground">
            {t.crmDashboards.widgetErrors[result.errorCode] ?? t.crmDashboards.widgetFailedGeneric}
          </p>
          {/* The raw code is kept visible: it is the evidence a support ticket
              needs, and `safeWidgetError` already narrowed it to a safe set. */}
          <code className="break-all font-mono text-2xs text-muted-foreground">
            {result.errorCode}
          </code>
        </div>
      ) : mode === "SCALAR" && result.value !== null ? (
        <div className="flex flex-col gap-1.5">
          <StatCard
            label={t.crmDashboards.currentValue}
            value={formatMetricValue(result.value, result.unit, result.currency, lang)}
          />
          {result.previousValue !== null ? (
            <p className="text-2xs text-muted-foreground">
              {formatTemplate(t.crmDashboards.previousValue, {
                value: formatMetricValue(result.previousValue, result.unit, result.currency, lang),
              })}
            </p>
          ) : null}
          {result.target !== null ? (
            <Progress
              value={result.value}
              max={result.target}
              label={t.crmDashboards.targetProgress}
              valueText={formatTemplate(t.crmDashboards.targetOf, {
                target: formatNumber(result.target, lang, { maximumFractionDigits: 2 }),
              })}
            />
          ) : null}
        </div>
      ) : mode === "TABLE" || mode === "SCALAR" ? (
        // A SCALAR visualization whose metric produced no single value falls
        // back to the table rather than rendering an empty card.
        <WidgetDataTable
          model={model}
          caption={widget.name}
          onDrilldown={
            canDrilldown
              ? (pointKey, label) => onDrilldown(widget, pointKey, label)
              : undefined
          }
          drilldownLabel={t.crmDashboards.drilldown}
        />
      ) : (
        <WidgetChart mode={mode} result={result} label={widget.name} />
      )}

      {/* Warnings are a persistent condition of this widget's data, not an
          event — `DegradedBanner`, never a toast (docs/design/patterns.md). */}
      {warnings.length > 0 ? (
        <DegradedBanner
          message={warnings
            .map((warning) => t.crmDashboards.widgetWarnings[warning] ?? warning)
            .join(" · ")}
        />
      ) : null}

      {/* The chart's text equivalent. Rendered for everyone, not hidden behind
          `sr-only`: a disclosure that anyone can open is the version that
          stays correct, because it is the version people look at. */}
      {result !== undefined && mode !== "TABLE" && model.rows.length > 0 ? (
        <Collapsible open={isTableOpen} onOpenChange={setIsTableOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              {isTableOpen ? t.crmDashboards.hideDataTable : t.crmDashboards.showDataTable}
              <ChevronDown className="size-4" aria-hidden="true" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <WidgetDataTable
              model={model}
              caption={widget.name}
              onDrilldown={
                canDrilldown
                  ? (pointKey, label) => onDrilldown(widget, pointKey, label)
                  : undefined
              }
              drilldownLabel={t.crmDashboards.drilldown}
            />
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {result?.currency ? (
        <Badge tone="neutral" className="self-start">
          {result.currency}
        </Badge>
      ) : null}
    </Card>
  );
}
