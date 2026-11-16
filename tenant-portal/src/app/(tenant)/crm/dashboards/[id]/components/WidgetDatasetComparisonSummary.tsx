"use client";

import { DateTime, StatCard } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { datasetComparisonDetails, datasetComparisonLabel } from "../../widget-dataset-comparison";

export function WidgetDatasetComparisonSummary({ details }: { details?: Record<string, unknown> }) {
  const { t, lang } = useI18n();
  const data = datasetComparisonDetails(details);
  if (!data) return null;
  const labels = t.crmDashboards.datasets;
  return <div className="@container space-y-2">
    <div className="grid gap-2 @lg:grid-cols-2 @2xl:grid-cols-3">
      {data.entries.map((entry, index) => {
        const delta = entry.absoluteChange === null ? null : formatNumber(entry.absoluteChange, lang, { signDisplay: "exceptZero" });
        const percentage = entry.percentChange === null ? null : formatNumber(entry.percentChange, lang, {
          style: "unit", unit: "percent", signDisplay: "exceptZero", maximumFractionDigits: 2,
        });
        const status = entry.state === "UNOBSERVED" ? labels.unobserved : index === 0 ? labels.baseline : null;
        return <StatCard key={entry.key} label={datasetComparisonLabel(entry, data.basis, lang, labels)}
          value={entry.total === null ? "—" : formatNumber(entry.total, lang)}
          description={status ?? (delta === null ? undefined : `${labels.delta} · ${delta}${percentage ? ` (${percentage})` : ""}`)} />;
      })}
    </div>
    <p className="text-xs text-muted-foreground">{data.basis === "PERIOD" ? labels.periodsHint : labels.branchesHint}</p>
    <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
      <span>{labels.observedAt}</span><DateTime value={data.asOf} timeZone={data.timeZone} />
    </p>
  </div>;
}
