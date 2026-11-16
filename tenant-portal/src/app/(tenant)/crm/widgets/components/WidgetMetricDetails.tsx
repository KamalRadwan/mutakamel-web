"use client";

import { CalendarDays, ChartNoAxesColumn, Clock3, Database, Info } from "lucide-react";
import { Badge } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { DashboardCatalog } from "../../dashboards/dashboard-catalog-contract";
import type { WidgetMetricChoice } from "../widget-metric-picker";

export function WidgetMetricDetails({ metric, compatible, visualizations }: {
  metric: WidgetMetricChoice;
  compatible: boolean;
  visualizations: DashboardCatalog["visualizations"];
}) {
  const { t, lang } = useI18n();
  const labels = t.crmWidgets.metricPicker;
  const timeModel = metric.timeModel ?? "UNKNOWN";
  return <section aria-label={labels.details} className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h3 className="text-lg font-semibold">{localizedName(metric, lang)}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{labels.timeDescriptions[timeModel]}</p></div>
      <Badge tone={compatible ? "positive" : "caution"}>{compatible ? labels.compatible : labels.incompatible}</Badge>
    </div>
    <dl className="grid gap-3 sm:grid-cols-3">
      <div><dt className="flex items-center gap-1.5 text-sm text-muted-foreground"><CalendarDays className="size-4" aria-hidden="true" />{labels.dateBasis}</dt>
        <dd className="mt-1 text-sm font-medium">{labels.dateFields[metric.dateField ?? "UNKNOWN"]}</dd></div>
      <div><dt className="flex items-center gap-1.5 text-sm text-muted-foreground"><Clock3 className="size-4" aria-hidden="true" />{labels.timeModel}</dt>
        <dd className="mt-1 text-sm font-medium">{labels.timeModels[timeModel]}</dd></div>
      <div><dt className="flex items-center gap-1.5 text-sm text-muted-foreground"><Database className="size-4" aria-hidden="true" />{labels.source}</dt>
        <dd className="mt-1 text-sm font-medium">{metric.accessResources?.length
          ? metric.accessResources.map((resource) => labels.resources[resource]).join(" / ") : labels.unknown}</dd></div>
    </dl>
    {metric.requiredComparison === "GOVERNED_TARGET" && <p className="text-sm text-muted-foreground">{labels.governedTargetRequired}</p>}
    <div className="space-y-2 border-t border-border pt-3">
      <h4 className="flex items-center gap-1.5 text-sm font-medium"><ChartNoAxesColumn className="size-4" aria-hidden="true" />{labels.visualizations}</h4>
      <div className="flex flex-wrap gap-2">{visualizations.length ? visualizations.map((visualization) => <Badge key={visualization.key}>
        {t.crmDashboards.visualizations[visualization.key]}</Badge>) : <p className="text-sm text-muted-foreground">{labels.noVisualizations}</p>}</div>
    </div>
    <p className="flex items-start gap-2 text-sm text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{labels.accessNotice}</p>
  </section>;
}
