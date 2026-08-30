"use client";

import { useI18n } from "@/i18n/I18nContext";
import type { DashboardVisual } from "@/types/dashboard";
import {
  CHART_COLORS,
  ChartEmptyState,
  ChartFigure,
  formatChartPercent,
  getChartCopy,
} from "../../charts/ChartAccessibility";
import { formatVisualValue, visualColor } from "../visual-format";

type FunnelVisualModel = Extract<DashboardVisual, { kind: "funnel" }>;

const STAGE_HEIGHT = 52;

/**
 * Centred proportional stage bars rather than Recharts trapezoids: stage
 * names, values, and the conversion between each pair stay visible at every
 * width, the layout mirrors cleanly in RTL, and it prints without measuring
 * an SVG. The design contract requires exactly that — stages distinguished
 * by text and boundaries, not by a gradient.
 */
export function FunnelVisual({ visual }: { visual: FunnelVisualModel }) {
  const { lang, t } = useI18n();
  const copy = getChartCopy(lang);
  const stages = visual.data.categories;

  if (stages.length === 0) {
    return <ChartEmptyState title={visual.title} lang={lang} />;
  }

  const entry = stages[0].value;
  const exit = stages[stages.length - 1].value;
  const overall = entry > 0 ? exit / entry : 0;
  const height = stages.length * STAGE_HEIGHT + 16;

  const rows = stages.map((stage, index) => {
    const previous = index === 0 ? undefined : stages[index - 1];
    const conversion = previous
      ? previous.value > 0
        ? stage.value / previous.value
        : 0
      : 1;
    const dropOff = previous ? Math.max(0, previous.value - stage.value) : 0;
    return {
      ...stage,
      width: entry > 0 ? Math.max(0.04, stage.value / entry) : 0,
      color: visualColor(index, stage.tone),
      conversion,
      dropOff,
      isFirst: index === 0,
    };
  });

  const worst = rows
    .filter((row) => !row.isFirst)
    .reduce<(typeof rows)[number] | undefined>(
      (found, row) => (!found || row.dropOff > found.dropOff ? row : found),
      undefined,
    );

  const summary =
    lang === "ar"
      ? `${visual.title}: ${stages.length} مراحل من ${formatVisualValue(lang, entry, visual.unit)} إلى ${formatVisualValue(lang, exit, visual.unit)}، بمعدل اجتياز ${formatChartPercent(lang, overall)}.${worst ? ` أكبر انخفاض عند ${worst.label} بفقد ${formatVisualValue(lang, worst.dropOff, visual.unit)}.` : ""}`
      : `${visual.title}: ${stages.length} stages from ${formatVisualValue(lang, entry, visual.unit)} to ${formatVisualValue(lang, exit, visual.unit)}, an overall pass-through of ${formatChartPercent(lang, overall)}.${worst ? ` The largest drop-off is at ${worst.label}, losing ${formatVisualValue(lang, worst.dropOff, visual.unit)}.` : ""}`;

  return (
    <ChartFigure
      title={visual.title}
      summary={summary}
      lang={lang}
      height={height}
      columns={[
        t.dashboard.visuals.stage,
        copy.value,
        t.dashboard.visuals.conversion,
        t.dashboard.visuals.dropOff,
      ]}
      rows={rows.map((row) => ({
        key: row.key,
        cells: [
          row.label,
          formatVisualValue(lang, row.value, visual.unit),
          row.isFirst ? "—" : formatChartPercent(lang, row.conversion),
          row.isFirst ? "—" : formatVisualValue(lang, row.dropOff, visual.unit),
        ],
      }))}
    >
      <ol className="flex size-full list-none flex-col justify-center gap-1.5 p-0">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-col items-center gap-0.5">
            {!row.isFirst && (
              <span className="font-mono text-xs leading-none text-muted-foreground">
                {formatChartPercent(lang, row.conversion)}
                {row.dropOff > 0 && (
                  <span
                    className={
                      worst && worst.key === row.key
                        ? "ms-1.5 font-semibold text-destructive"
                        : "ms-1.5"
                    }
                  >
                    −{formatVisualValue(lang, row.dropOff, visual.unit)}
                  </span>
                )}
              </span>
            )}
            {/* Tinted track with a solid stage rule, so the label always sits
                on a card-derived surface — a saturated fill would fail 4.5:1
                against foreground text in one theme or the other. */}
            <div
              className="flex h-8 min-w-28 items-center justify-between gap-3 rounded-sm border border-s-[3px] px-3"
              style={{
                width: `${row.width * 100}%`,
                backgroundColor: `color-mix(in oklab, ${row.color} 22%, var(--card))`,
                borderColor: CHART_COLORS.grid,
                borderInlineStartColor: row.color,
              }}
            >
              <span className="truncate text-xs font-semibold text-foreground">
                {row.label}
              </span>
              <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-foreground" dir="auto">
                {formatVisualValue(lang, row.value, visual.unit)}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </ChartFigure>
  );
}
