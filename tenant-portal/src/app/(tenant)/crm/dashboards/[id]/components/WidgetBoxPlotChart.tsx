"use client";

import { Badge } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { durationDistribution } from "../../widget-duration-distribution";
import { formatWidgetValue } from "../../widget-presentation";
import { COLORFUL_SWATCH_FILLS } from "../../widget-view";

const VISIBLE_GROUP_LIMIT = 12;
const PLOT_WIDTH = 600;
const EDGE = 12;
const GRID = [0, 0.25, 0.5, 0.75, 1];

export function BoxPlotChartView({ data, label, displaySpec = {} }: {
  data: unknown; label: string; displaySpec?: Record<string, unknown>;
}) {
  const { t, lang } = useI18n();
  const labels = t.crmDashboards.boxPlot;
  const distribution = durationDistribution(data);
  if (!distribution?.totalCount) return <p className="text-xs text-muted-foreground">{t.crmDashboards.invalidChartGeometry}</p>;
  const plottable = distribution.groups.flatMap((group) => {
    const { min, q1, median, q3, max } = group;
    if (min === null || q1 === null || median === null || q3 === null || max === null) return [];
    return [{ ...group, min, q1, median, q3, max }];
  });
  const groups = plottable.slice(0, VISIBLE_GROUP_LIMIT);
  const maximum = Math.max(...plottable.map((group) => group.max));
  const automaticUnit = maximum >= 1440 ? "duration-days" : maximum >= 60 ? "duration-hours" : "duration-minutes";
  const axisFormat = typeof displaySpec.numberFormat === "string" && displaySpec.numberFormat !== "auto"
    && displaySpec.numberFormat !== "duration-auto" ? displaySpec : { ...displaySpec, numberFormat: automaticUnit };
  const duration = (value: number) => formatWidgetValue(value, "DURATION", null, lang, axisFormat);
  const number = (value: number) => formatNumber(value, lang);
  const x = (value: number) => EDGE + (maximum === 0 ? 0 : value / maximum) * (PLOT_WIDTH - 2 * EDGE);

  return <figure aria-label={label} className="min-w-0 space-y-3">
    <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>{labels.whiskers}</span>
      <Badge tone="neutral">{formatTemplate(labels.sample, { valid: number(distribution.totalCount), excluded: number(distribution.excludedCount) })}</Badge>
    </figcaption>
    <div className="space-y-2">
      {groups.map((group, index) => {
        const name = group.key === "conversion" ? labels.conversionSample : group.label;
        const fill = COLORFUL_SWATCH_FILLS[index % COLORFUL_SWATCH_FILLS.length];
        return <div key={group.key} className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
            <bdi className="font-medium">{name}</bdi>
            <span className="text-muted-foreground">{formatTemplate(group.sampleCount === 1 ? labels.singleSample : labels.groupSample,
              { count: number(group.sampleCount), median: duration(group.median) })}</span>
          </div>
          <svg viewBox={`0 0 ${PLOT_WIDTH} 32`} preserveAspectRatio="none" aria-hidden="true" className="block h-8 w-full">
            {GRID.map((ratio) => <line key={ratio} x1={EDGE + ratio * (PLOT_WIDTH - 2 * EDGE)} x2={EDGE + ratio * (PLOT_WIDTH - 2 * EDGE)}
              y1="0" y2="32" stroke="var(--border)" vectorEffect="non-scaling-stroke" />)}
            <line x1={x(group.min)} x2={x(group.max)} y1="16" y2="16" stroke="var(--foreground)" vectorEffect="non-scaling-stroke" />
            {group.min === group.max ? <line x1={x(group.median)} x2={x(group.median)} y1="11" y2="21" stroke={fill}
              strokeWidth="6" strokeLinecap="round" vectorEffect="non-scaling-stroke" /> : <>
              {[group.min, group.max].map((value) => <line key={value} x1={x(value)} x2={x(value)} y1="9" y2="23" stroke="var(--foreground)" vectorEffect="non-scaling-stroke" />)}
              <rect x={x(group.q1)} width={x(group.q3) - x(group.q1)} y="6" height="20" rx="3" fill={fill} fillOpacity="0.8" />
              <line x1={x(group.median)} x2={x(group.median)} y1="6" y2="26" stroke="var(--foreground)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </>}
          </svg>
        </div>;
      })}
      <div dir="ltr" className="flex justify-between gap-1 text-2xs text-muted-foreground" aria-hidden="true">
        {(maximum === 0 ? [0] : GRID).map((ratio, index) => <bdi key={ratio} className={index % 2 === 1 ? "invisible sm:visible" : undefined}>{duration(maximum * ratio)}</bdi>)}
      </div>
    </div>
    {plottable.length > groups.length && <p className="text-xs text-muted-foreground">
      {formatTemplate(labels.visibleGroups, { shown: number(groups.length), total: number(plottable.length) })}
    </p>}
  </figure>;
}
