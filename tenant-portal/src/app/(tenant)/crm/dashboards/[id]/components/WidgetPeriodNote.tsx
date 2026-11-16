"use client";

import { useI18n } from "@/i18n/I18nContext";
import { formatCivilDateRange } from "@/lib/format/date";
import type { WidgetResult } from "../../dashboard-run-contract";
import type { WidgetQuerySpec } from "../../widget-contract";
import { LEAD_SOURCE_GROWTH_METRIC } from "../../widget-source-growth";

export function WidgetPeriodNote({ query, result }: { query?: WidgetQuerySpec; result?: WidgetResult }) {
  const { t, lang } = useI18n();
  const period = result?.effectivePeriod;
  if (!query?.filters?.datePreset || !result || !period || result.errorCode !== null
    || (result.state !== "READY" && result.state !== "EMPTY")
    || query.series[0]?.metricKey === LEAD_SOURCE_GROWTH_METRIC) return null;
  return <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
    <span>{t.crmDashboards.datePreset}</span>
    <bdi>{formatCivilDateRange(period.from, period.to, lang)}</bdi>
    <bdi>{period.timeZone}</bdi>
  </p>;
}
