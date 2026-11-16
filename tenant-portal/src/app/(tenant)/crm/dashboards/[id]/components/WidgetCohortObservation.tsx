"use client";

import { Badge, DateTime } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { finiteNumber, record, timestamp } from "../../dashboard-parse";
import type { WidgetResult } from "../../dashboard-run-contract";
import { formatWidgetValue } from "../../widget-presentation";

export function WidgetCohortObservation({ result }: { result?: WidgetResult }) {
  const { t, lang } = useI18n();
  const details = result?.details;
  const wonCohort = record(details?.leadWonCohort);
  const cohort = record(details?.sourceCohort) ?? record(details?.cohortProgress) ?? wonCohort;
  if (!timestamp(cohort?.asOf)) return null;
  const rate = cohort.groupBy === "branch" && result?.series.some(({ unit }) => unit === "PERCENT")
    && finiteNumber(cohort.rate) && cohort.rate >= 0 && cohort.rate <= 100 ? cohort.rate : null;
  const { won, converted } = wonCohort ?? {};
  const wonEvidence = finiteNumber(won) && finiteNumber(converted) && Number.isSafeInteger(won) && Number.isSafeInteger(converted)
    && won >= 0 && converted > 0 && won <= converted
    ? formatTemplate(t.crmDashboards.cohortReadableWins, { won: formatNumber(won, lang), converted: formatNumber(converted, lang) }) : null;
  return <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
    {wonCohort?.outcomeBasis === "CURRENT_WON" && <Badge tone="neutral">{t.crmDashboards.cohortCurrentWin}</Badge>}
    {wonEvidence && <span>{wonEvidence}</span>}
    {rate !== null && <span>{t.crmDashboards.cohortOverallRate} <strong className="font-medium text-foreground">{formatWidgetValue(rate, "PERCENT", null, lang, {})}</strong></span>}
    <span>{t.crmDashboards.cohortObservedAt}</span><DateTime value={cohort.asOf} />
  </div>;
}
