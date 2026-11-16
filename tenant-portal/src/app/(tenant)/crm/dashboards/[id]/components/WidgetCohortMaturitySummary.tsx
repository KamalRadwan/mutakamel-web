"use client";

import { DateTime, StatCard } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { cohortMaturitySummary } from "../../widget-cohort-maturity";
import { formatWidgetValue } from "../../widget-presentation";

export function WidgetCohortMaturitySummary({ details }: { details?: Record<string, unknown> }) {
  const { t, lang } = useI18n();
  const summary = cohortMaturitySummary(details);
  if (!summary) return null;
  const labels = t.crmDashboards.maturity;
  return <div className="@container space-y-2">
    <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-4">
      <StatCard label={labels.cohorts} value={formatNumber(summary.cohorts, lang)} />
      <StatCard label={labels.eligibleD30} value={formatNumber(summary.denominator, lang)} />
      <StatCard label={labels.convertedD30} value={formatNumber(summary.numerator, lang)} />
      <StatCard label={labels.rateD30} value={formatWidgetValue(summary.rate, "PERCENT", null, lang, {})} />
    </div>
    <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
      <span>{labels.population}</span><span>{t.crmDashboards.cohortObservedAt}</span>
      <DateTime value={summary.asOf} timeZone={summary.timeZone} />
    </p>
  </div>;
}
