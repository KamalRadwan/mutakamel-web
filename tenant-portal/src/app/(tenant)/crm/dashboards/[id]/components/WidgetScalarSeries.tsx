"use client";

import { StatCard } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { WidgetResult } from "../../dashboard-run-contract";
import { conversionSampleCaption, formatWidgetValue } from "../../widget-presentation";
import { primarySeries } from "../../widget-view";

export function WidgetScalarSeries({ result, displaySpec }: {
  result: WidgetResult;
  displaySpec: Record<string, unknown>;
}) {
  const { t, lang } = useI18n();
  return <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
    {primarySeries(result).map((series) => {
      const point = series.points[0];
      return <StatCard key={series.key} label={series.label}
        value={point?.value == null ? t.common.noData : formatWidgetValue(
          point.value, series.unit, series.currency ?? result.currency, lang, displaySpec,
        )}
        description={conversionSampleCaption(point?.meta, t.crmDashboards.conversionSample, lang)} />;
    })}
  </div>;
}
