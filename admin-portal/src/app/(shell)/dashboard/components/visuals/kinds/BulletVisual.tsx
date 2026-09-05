"use client";

import { useI18n } from "@/i18n/I18nContext";
import type { DashboardVisual } from "@/types/dashboard";
import {
  CHART_COLORS,
  ChartEmptyState,
  ChartFigure,
  dashboardChartVisualItems,
  formatChartPercent,
  getChartCopy,
} from "../../charts/ChartAccessibility";
import {
  bandColor,
  clampRatio,
  formatVisualExactValue,
  formatVisualValue,
  visualColor,
} from "../visual-format";

type BulletVisualModel = Extract<DashboardVisual, { kind: "bullet" }>;

const ROW_HEIGHT = 46;

/**
 * The right shape for 3–10 KPIs that each have a target or a ceiling: one
 * measure bar, one target rule, and the qualitative bands behind them. Hand
 * SVG rather than Recharts — a bullet row is two rects and a line, and this
 * keeps every label a real DOM node for the print path.
 */
export function BulletVisual({ visual }: { visual: BulletVisualModel }) {
  const { dir, lang, t } = useI18n();
  const copy = getChartCopy(lang);
  const rows = visual.data.rows;

  if (rows.length === 0) {
    return <ChartEmptyState title={visual.title} lang={lang} />;
  }

  const visible = dashboardChartVisualItems(rows);
  const bands = visual.reference?.bands ?? [];
  const height = visible.length * ROW_HEIGHT + 8;

  const measured = visible.map((row, index) => {
    const ceiling = row.maximum ?? visual.reference?.maximum ?? maxOf(rows);
    const ratio = ceiling > 0 ? clampRatio(row.value / ceiling) : 0;
    const target = row.target ?? visual.reference?.target;
    const targetRatio = target !== undefined && ceiling > 0 ? clampRatio(target / ceiling) : undefined;
    const band = bands.find((candidate) => ratio <= candidate.upTo);
    return {
      ...row,
      ceiling,
      ratio,
      target,
      targetRatio,
      color: band ? bandColor(band.tone) : visualColor(index, row.tone),
    };
  });

  const overCeiling = measured.filter((row) => row.ratio >= 1).length;
  const summary =
    lang === "ar"
      ? `${visual.title}: ${rows.length} عنصرًا مقابل الحد الأقصى لكل منها.${overCeiling ? ` ${overCeiling} منها بلغت الحد.` : ""}`
      : `${visual.title}: ${rows.length} items measured against their own ceiling.${overCeiling ? ` ${overCeiling} have reached it.` : ""}`;

  return (
    <ChartFigure
      title={visual.title}
      summary={summary}
      lang={lang}
      height={height}
      legend={[
        { key: "value", label: t.dashboard.visuals.current, color: CHART_COLORS.action },
        ...(measured.some((row) => row.targetRatio !== undefined)
          ? [{ key: "target", label: t.dashboard.visuals.target, color: CHART_COLORS.axis }]
          : []),
      ]}
      columns={[
        copy.category,
        copy.value,
        t.dashboard.visuals.maximum,
        t.dashboard.visuals.utilization,
      ]}
      rows={rows.map((row) => {
        const ceiling = row.maximum ?? visual.reference?.maximum ?? maxOf(rows);
        return {
          key: row.key,
          cells: [
            row.label,
            formatVisualExactValue(lang, row.value, visual.unit),
            formatVisualExactValue(lang, ceiling, visual.unit),
            formatChartPercent(lang, ceiling > 0 ? row.value / ceiling : 0),
          ],
        };
      })}
    >
      <ul className="flex size-full list-none flex-col justify-start gap-2 p-0">
        {measured.map((row) => (
          <li key={row.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-xs font-medium text-foreground">{row.label}</span>
              <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-foreground" dir="auto">
                {formatVisualValue(lang, row.value, visual.unit)}
                <span className="text-muted-foreground">
                  {" / "}
                  {formatVisualValue(lang, row.ceiling, visual.unit)}
                </span>
              </span>
            </div>
            <div
              className="relative h-3 w-full overflow-hidden rounded-xs"
              style={{ backgroundColor: CHART_COLORS.grid }}
            >
              {bands.map((band, bandIndex) => {
                const from = bandIndex === 0 ? 0 : bands[bandIndex - 1].upTo;
                return (
                  <span
                    key={`${row.key}-band-${band.tone}`}
                    className="absolute inset-y-0"
                    style={{
                      [dir === "rtl" ? "right" : "left"]: `${from * 100}%`,
                      width: `${Math.max(0, band.upTo - from) * 100}%`,
                      backgroundColor: `color-mix(in oklab, ${bandColor(band.tone)} 18%, transparent)`,
                    }}
                  />
                );
              })}
              <span
                className="absolute inset-y-0.5 rounded-xs"
                style={{
                  [dir === "rtl" ? "right" : "left"]: 0,
                  width: `${row.ratio * 100}%`,
                  backgroundColor: row.color,
                }}
              />
              {row.targetRatio !== undefined && (
                <span
                  className="absolute inset-y-0 w-0.5"
                  style={{
                    [dir === "rtl" ? "right" : "left"]: `${row.targetRatio * 100}%`,
                    backgroundColor: CHART_COLORS.axis,
                  }}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </ChartFigure>
  );
}

function maxOf(rows: BulletVisualModel["data"]["rows"]): number {
  return rows.reduce((found, row) => Math.max(found, row.maximum ?? row.value), 0);
}
