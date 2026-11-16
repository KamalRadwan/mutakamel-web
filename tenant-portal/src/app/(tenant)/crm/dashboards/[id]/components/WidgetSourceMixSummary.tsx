"use client";

import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { WidgetResult } from "../../dashboard-run-contract";
import { readSourceMix } from "../../widget-source-mix";

export function WidgetSourceMixSummary({ result }: { result: WidgetResult }) {
  const { t, lang } = useI18n();
  const mix = readSourceMix(result);
  if (!mix) return null;
  const copy = t.crmDashboards.sourceMix;
  return <div className="space-y-1">
    <p className="text-sm font-medium">{formatTemplate(copy.totalCreated, { count: formatNumber(mix.total, lang) })}</p>
    <p className="text-xs text-muted-foreground">{copy.basis}</p>
    {mix.foldedSourceCount > 0 && <p className="text-xs text-muted-foreground">{formatTemplate(copy.folded, { count: formatNumber(mix.foldedSourceCount, lang) })}</p>}
  </div>;
}
