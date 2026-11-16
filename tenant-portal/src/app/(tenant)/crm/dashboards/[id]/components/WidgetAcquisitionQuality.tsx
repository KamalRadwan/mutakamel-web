"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart, DateTime, Progress } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { WidgetResult } from "../../dashboard-run-contract";
import { readCurrentRatingMix, readInquiryClassification, readMissingSourceShare } from "../../widget-acquisition-quality";
import { widgetOption } from "../../widget-presentation";

export function WidgetAcquisitionQualitySummary({ result }: { result: WidgetResult }) {
  const { t, lang } = useI18n();
  const share = readMissingSourceShare(result);
  const mix = readCurrentRatingMix(result);
  const inquiry = readInquiryClassification(result);
  const copy = t.crmDashboards.acquisitionQuality;
  if (inquiry) return <div className="space-y-1">
    <p className="text-sm font-medium tabular-nums">{formatTemplate(copy.classifiedOf, {
      count: formatNumber(inquiry.classified, lang), total: formatNumber(inquiry.total, lang),
    })}</p>
    <p className="text-xs text-muted-foreground">{copy.coverage} <DateTime value={inquiry.coverageStartedAt} precision="date" /></p>
  </div>;
  if (!share && !mix) return null;
  return <div className="space-y-1">
    <p className="text-sm font-medium tabular-nums">{share
      ? formatTemplate(copy.missingOf, { missing: formatNumber(share.numerator, lang), total: formatNumber(share.denominator, lang) })
      : formatTemplate(copy.totalCreated, { count: formatNumber(mix!.total, lang) })}</p>
    <p className="text-xs text-muted-foreground">{share ? copy.sourceBasis : copy.ratingBasis}</p>
  </div>;
}

export function WidgetPopulationShare({ result, label }: { result: WidgetResult; label: string }) {
  const { t, lang } = useI18n();
  const share = readMissingSourceShare(result);
  if (!share) return <p role="note" className="text-xs text-muted-foreground">{t.crmDashboards.widgetDataUnavailable}</p>;
  if (share.sharePercent === null) return <p className="text-xs text-muted-foreground">{t.crmDashboards.noData}</p>;
  const percentage = formatNumber(share.sharePercent, lang, { style: "unit", unit: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fraction = formatTemplate(t.crmDashboards.acquisitionQuality.missingOf, {
    missing: formatNumber(share.numerator, lang), total: formatNumber(share.denominator, lang),
  });
  return <div className="space-y-3">
    <p className="text-4xl font-semibold text-caution-700 dark:text-caution-300 tabular-nums">{percentage}</p>
    <Progress className="h-3 [&>div]:bg-caution-500" value={share.sharePercent} label={label} valueText={`${percentage} · ${fraction}`} />
    <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
      <span>{formatNumber(0, lang, { style: "unit", unit: "percent" })}</span>
      <span>{formatNumber(100, lang, { style: "unit", unit: "percent" })}</span>
    </div>
  </div>;
}

export function WidgetCurrentRatingChart({ result, label, displaySpec }: { result: WidgetResult; label: string; displaySpec: Record<string, unknown> }) {
  const { t, lang } = useI18n();
  const mix = readCurrentRatingMix(result);
  if (!mix || !mix.total) return <p className="text-xs text-muted-foreground">{t.crmDashboards.noData}</p>;
  const count = (value: number) => formatNumber(value, lang);
  const summary = mix.rows.map(row => `${row.label}: ${count(row.count)}`).join(" · ");
  const fills = ["var(--swatch-slate)", "var(--color-brand-300)", "var(--color-brand-500)", "var(--color-brand-700)"];
  return <div className="space-y-3"><BarChart label={label} summary={summary} horizontal stacked height={150}
    xKey="label" data={[{ label: t.crmDashboards.acquisitionQuality.total, ...Object.fromEntries(mix.rows.map(row => [`rating${row.key}`, row.count])) }]}
    series={mix.rows.map((row, index) => ({ key: `rating${row.key}`, label: row.label, role: "brand", fill: fills[index], valueFormatter: count }))}
    valueFormatter={count} valueAxes={{ LEFT: { integers: true, domain: [0, mix.total] } }}
    showLegend={false} showValues={widgetOption(displaySpec, "showValues")} />
    {displaySpec.legendPosition !== "none" && <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
      {mix.rows.map((row, index) => <li key={row.key} className="flex items-center gap-2">
        <span aria-hidden="true" className="size-3 rounded-sm" style={{ backgroundColor: fills[index] }} />
        <span>{row.label}</span><span className="font-semibold tabular-nums">{count(row.count)}</span>
      </li>)}
    </ul>}
  </div>;
}

export function WidgetInquiryClassificationChart({ result, label, horizontal, displaySpec }: {
  result: WidgetResult; label: string; horizontal: boolean; displaySpec: Record<string, unknown>;
}) {
  const { t, lang } = useI18n();
  const inquiry = readInquiryClassification(result);
  const container = useRef<HTMLDivElement>(null);
  const [compactLabels, setCompactLabels] = useState(false);
  const hasPoints = !!inquiry?.total;
  useEffect(() => {
    const chart = container.current;
    if (!hasPoints || !chart || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setCompactLabels(entry.contentRect.width < 640);
    });
    observer.observe(chart);
    return () => observer.disconnect();
  }, [hasPoints]);
  if (!inquiry?.total) return <p className="text-xs text-muted-foreground">{t.crmDashboards.noData}</p>;
  const format = (value: number) => formatNumber(value, lang);
  const roles = ["brand", "positive", "caution", "brand"] as const;
  const summary = inquiry.rows.map(row => `${row.label}: ${format(row.count)}`).join(" · ");
  const shortLabels = t.crmDashboards.acquisitionQuality.compactClassificationLabels;
  return <div ref={container} className="min-w-0"><BarChart label={label} summary={summary} horizontal={horizontal} stacked height={240} xKey="label"
    data={inquiry.rows.map(row => ({ label: compactLabels ? shortLabels[row.key] : row.label, [row.key]: row.count }))}
    series={inquiry.rows.map((row, index) => ({
      key: row.key, label: row.label, role: roles[index], ...(index === 3 ? { fill: "var(--swatch-slate)" } : {}),
    }))}
    valueFormatter={format} valueAxes={{ LEFT: { integers: true } }} showLegend={false}
    showValues={widgetOption(displaySpec, "showValues", true)} /></div>;
}
