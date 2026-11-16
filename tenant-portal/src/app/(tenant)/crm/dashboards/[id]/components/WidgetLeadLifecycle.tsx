"use client";

import { DateTime } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { WidgetResult } from "../../dashboard-run-contract";
import { readLeadLifecycle } from "../../widget-lead-lifecycle";

export function WidgetLeadLifecycleNote({ result }: { result: WidgetResult }) {
  const { t, lang } = useI18n();
  const data = readLeadLifecycle(result);
  if (!data?.total) return null;
  const copy = t.crmDashboardReports.leadLifecycle;
  return <div className="space-y-1 text-xs text-muted-foreground">
    {data.kind === "qualified" && <p>{formatTemplate(copy.qualifiedOf, {
      count: formatNumber(data.qualified.total, lang),
    })}</p>}
    {data.kind === "stage" && data.omitted > 0 && <p>{formatTemplate(copy.stageGroups, { count: formatNumber(data.omitted, lang) })}</p>}
    <p>{copy.observed} <DateTime value={data.asOf} timeZone={result.effectivePeriod?.timeZone} /></p>
  </div>;
}
