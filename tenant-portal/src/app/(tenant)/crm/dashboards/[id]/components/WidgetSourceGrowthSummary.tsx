"use client";

import { useI18n } from "@/i18n/I18nContext";
import { formatCivilDateRange } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { WidgetResult } from "../../dashboard-run-contract";
import { LEAD_SOURCE_GROWTH_METRIC, readSourceGrowth } from "../../widget-source-growth";

export function WidgetSourceGrowthSummary({ result }: { result: WidgetResult }) {
  const { t, lang } = useI18n();
  if (result.series[0]?.key !== LEAD_SOURCE_GROWTH_METRIC) return null;
  const labels = t.crmDashboards.sourceGrowth;
  const data = readSourceGrowth(result);
  if (!data) return <p role="note" className="text-xs text-muted-foreground">{labels.unavailable}</p>;
  return <div className="space-y-2">
    <dl className="grid gap-2 rounded-lg border border-border bg-muted p-3 text-xs sm:grid-cols-2">
      {([["previous", data.previous], ["current", data.current]] as const).map(([key, value]) => (
        <div key={key} className="min-w-0 space-y-1">
          <dt className="text-muted-foreground">{labels[key]}</dt>
          <dd className="font-medium"><bdi>{formatCivilDateRange(value.from, value.to, lang)}</bdi></dd>
        </div>
      ))}
    </dl>
    <p className="text-xs text-muted-foreground"><bdi>{data.timeZone}</bdi></p>
    {data.rows.some(({ growthPercent }) => growthPercent === null) && <p className="text-xs text-muted-foreground">{labels.zeroBaseline}</p>}
    {data.foldedSourceCount > 0 && <p className="text-xs text-muted-foreground">
      {formatTemplate(labels.folded, { count: formatNumber(data.foldedSourceCount, lang) })}
    </p>}
  </div>;
}
