"use client";
import { Button, swatchSurfacePalette } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { COLORFUL_SWATCH_HUES, formatMetricValue, primarySeries } from "../../widget-view";

export function FunnelChartView({
  series,
  currency,
  label,
  summary,
  onDrilldown,
}: {
  series: ReturnType<typeof primarySeries>[number];
  currency: string | null;
  label: string;
  summary: string;
  onDrilldown?: (pointKey: string, pointLabel: string, seriesKey?: string | null) => void;
}) {
  const { t, lang } = useI18n();
  const points = series.points;
  const maxVal = Math.max(...points.flatMap((point) => point.value === null ? [] : [point.value]), 0);

  return (
    <figure aria-label={label} className="space-y-2.5 py-1.5">
      <span className="sr-only">{summary}</span>
      {points.map((point, index) => {
        const widthPct = point.value === null || maxVal === 0 ? 0 : Math.max(0, point.value / maxVal * 100);
        const hue = COLORFUL_SWATCH_HUES[index % COLORFUL_SWATCH_HUES.length];
        const palette = swatchSurfacePalette(hue);
        const formatted = formatMetricValue(
          point.value,
          series.unit,
          series.currency ?? currency,
          lang,
        );

        return (
          <div key={point.key} className="flex items-center gap-2.5 text-xs">
            <div className="w-28 shrink-0 truncate">
              {onDrilldown && point.value !== null ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => onDrilldown(point.key, point.label, series.key)}
                  className="h-auto max-w-full truncate px-1 py-0.5 font-medium text-foreground"
                >
                  {point.label}
                </Button>
              ) : (
                <span className="font-medium text-foreground">{point.label}</span>
              )}
            </div>

            <div className="flex flex-1 items-center justify-center rounded-sm bg-muted/45 py-0.5">
              <div aria-hidden="true"
                className={`flex h-7 items-center justify-center rounded-xs px-2 text-xs font-semibold tabular-nums ${palette.iconBoxActive}`}
                style={{
                  width: `${widthPct}%`,
                  clipPath: "polygon(0 0, 100% 0, 94% 100%, 6% 100%)",
                }}
              />
            </div>

            <div className="min-w-12 shrink-0 text-end tabular-nums">
              <bdi>{point.value === null ? t.common.noData : formatted}</bdi>
            </div>
          </div>
        );
      })}
    </figure>
  );
}
