"use client";

import { useI18n } from "@/i18n/I18nContext";
import type { DashboardVisual } from "@/types/dashboard";
import {
  CHART_COLORS,
  ChartEmptyState,
  ChartFigure,
  dashboardChartVisualItems,
  getChartCopy,
} from "../../charts/ChartAccessibility";
import { formatVisualExactValue, formatVisualValue } from "../visual-format";

type HeatmapVisualModel = Extract<DashboardVisual, { kind: "heatmap" }>;

const ROW_HEIGHT = 34;

/**
 * Two categorical axes, one measure. A CSS grid rather than a chart library:
 * every cell stays a real element carrying its own value text, so intensity
 * is never the only encoding and the print path needs no measurement.
 */
export function HeatmapVisual({ visual }: { visual: HeatmapVisualModel }) {
  const { lang } = useI18n();
  const copy = getChartCopy(lang);
  const { columns, rows } = visual.data;

  if (rows.length === 0 || columns.length === 0) {
    return <ChartEmptyState title={visual.title} lang={lang} />;
  }

  const visible = dashboardChartVisualItems(rows);
  const peak = rows.reduce(
    (found, row) => Math.max(found, ...row.values.map((value) => (Number.isFinite(value) ? value : 0))),
    0,
  );
  const total = rows.reduce(
    (sum, row) => sum + row.values.reduce((inner, value) => inner + (Number.isFinite(value) ? value : 0), 0),
    0,
  );
  const height = visible.length * ROW_HEIGHT + 34;

  let hottest = { label: "", column: "", value: -1 };
  rows.forEach((row) => {
    row.values.forEach((value, index) => {
      if (value > hottest.value) {
        hottest = { label: row.label, column: columns[index] ?? "", value };
      }
    });
  });

  const summary =
    lang === "ar"
      ? `${visual.title}: ${rows.length} صفًا × ${columns.length} عمودًا، بإجمالي ${formatVisualValue(lang, total, visual.unit)}. أعلى خلية ${hottest.label} / ${hottest.column} بقيمة ${formatVisualValue(lang, Math.max(0, hottest.value), visual.unit)}.`
      : `${visual.title}: ${rows.length} rows by ${columns.length} columns, totalling ${formatVisualValue(lang, total, visual.unit)}. The highest cell is ${hottest.label} / ${hottest.column} at ${formatVisualValue(lang, Math.max(0, hottest.value), visual.unit)}.`;

  return (
    <ChartFigure
      title={visual.title}
      summary={summary}
      lang={lang}
      height={height}
      columns={[copy.category, ...columns, copy.total]}
      rows={rows.map((row) => {
        const rowTotal = row.values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
        return {
          key: row.key,
          cells: [
            row.label,
            ...columns.map((_, index) =>
              formatVisualExactValue(lang, row.values[index] ?? 0, visual.unit),
            ),
            formatVisualExactValue(lang, rowTotal, visual.unit),
          ],
        };
      })}
    >
      <div className="size-full overflow-auto">
        <div
          className="grid min-w-max gap-0.5"
          style={{ gridTemplateColumns: `minmax(112px, 1fr) repeat(${columns.length}, minmax(72px, 1fr))` }}
        >
          <span />
          {columns.map((column) => (
            <span
              key={column}
              className="truncate px-1 pb-1 text-center text-xs font-semibold text-muted-foreground"
            >
              {column}
            </span>
          ))}
          {visible.map((row) => (
            <Row
              key={row.key}
              label={row.label}
              values={row.values}
              columns={columns}
              peak={peak}
              render={(value) => formatVisualValue(lang, value, visual.unit)}
            />
          ))}
        </div>
      </div>
    </ChartFigure>
  );
}

function Row({
  label,
  values,
  columns,
  peak,
  render,
}: {
  label: string;
  values: number[];
  columns: string[];
  peak: number;
  render: (value: number) => string;
}) {
  return (
    <>
      <span className="flex items-center truncate pe-2 text-xs font-medium text-foreground">
        {label}
      </span>
      {columns.map((column, index) => {
        const value = Number.isFinite(values[index]) ? values[index] : 0;
        const intensity = peak > 0 ? value / peak : 0;
        return (
          <span
            key={`${label}-${column}`}
            title={`${label} · ${column} · ${render(value)}`}
            className="flex h-8 items-center justify-center rounded-xs font-mono text-xs font-semibold tabular-nums text-foreground"
            style={{
              backgroundColor:
                value === 0
                  ? "var(--muted)"
                  : `color-mix(in oklab, ${CHART_COLORS.qualitative[0]} ${Math.round(12 + intensity * 46)}%, var(--card))`,
            }}
            dir="auto"
          >
            {render(value)}
          </span>
        );
      })}
    </>
  );
}
