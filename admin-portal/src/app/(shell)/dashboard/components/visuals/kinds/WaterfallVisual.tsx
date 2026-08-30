"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/i18n/I18nContext";
import type { DashboardVisual } from "@/types/dashboard";
import { ChartTooltip } from "../../charts/ChartTooltip";
import {
  CHART_COLORS,
  ChartEmptyState,
  ChartFigure,
  getChartCopy,
  useReducedMotion,
} from "../../charts/ChartAccessibility";
import { formatVisualTick, formatVisualValue } from "../visual-format";

type WaterfallVisualModel = Extract<DashboardVisual, { kind: "waterfall" }>;

/**
 * Total, deductions, residual. Built as a stacked bar with a transparent
 * base segment, which is what a waterfall is — Recharts needs no plugin.
 */
export function WaterfallVisual({
  visual,
  height = 280,
}: {
  visual: WaterfallVisualModel;
  height?: number;
}) {
  const { dir, lang, t } = useI18n();
  const reducedMotion = useReducedMotion();
  const copy = getChartCopy(lang);
  const steps = visual.data.steps;

  if (steps.length === 0) {
    return <ChartEmptyState title={visual.title} lang={lang} height={height} />;
  }

  const rows = layoutWaterfall(steps);

  const start = rows[0];
  const end = rows[rows.length - 1];
  const summary =
    lang === "ar"
      ? `${visual.title}: من ${start.label} بقيمة ${formatVisualValue(lang, start.value, visual.unit)} إلى ${end.label} بقيمة ${formatVisualValue(lang, end.running, visual.unit)}، عبر ${rows.length - 2 > 0 ? rows.length - 2 : 0} خطوة وسيطة.`
      : `${visual.title}: from ${start.label} at ${formatVisualValue(lang, start.value, visual.unit)} to ${end.label} at ${formatVisualValue(lang, end.running, visual.unit)}, across ${Math.max(0, rows.length - 2)} intermediate steps.`;

  return (
    <ChartFigure
      title={visual.title}
      summary={summary}
      lang={lang}
      height={height}
      legend={[
        { key: "total", label: t.dashboard.visuals.total, color: CHART_COLORS.action },
        { key: "decrease", label: t.dashboard.visuals.decrease, color: CHART_COLORS.success },
        { key: "increase", label: t.dashboard.visuals.increase, color: CHART_COLORS.warning },
      ]}
      columns={[copy.category, t.dashboard.visuals.change, t.dashboard.visuals.runningTotal]}
      rows={rows.map((row) => ({
        key: row.key,
        cells: [
          row.label,
          row.role === "delta"
            ? `${row.value < 0 ? "−" : "+"}${formatVisualValue(lang, Math.abs(row.value), visual.unit)}`
            : formatVisualValue(lang, row.value, visual.unit),
          formatVisualValue(lang, row.running, visual.unit),
        ],
      }))}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart
          accessibilityLayer={false}
          data={rows}
          margin={{ top: 8, right: 16, left: 52, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            reversed={dir === "rtl"}
            interval={0}
            tick={{ fontSize: 13, fill: CHART_COLORS.axis }}
          />
          <YAxis
            orientation={dir === "rtl" ? "right" : "left"}
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fontSize: 13, fill: CHART_COLORS.axis }}
            tickFormatter={(value) => formatVisualTick(lang, Number(value), visual.unit)}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            isAnimationActive={!reducedMotion}
            content={
              <ChartTooltip
                valueFormatter={(value) => formatVisualValue(lang, Number(value), visual.unit)}
              />
            }
          />
          {/* Invisible pedestal that lifts each delta to its running position. */}
          <Bar dataKey="base" stackId="waterfall" fill="transparent" isAnimationActive={false} />
          <Bar
            dataKey="magnitude"
            name={visual.title}
            stackId="waterfall"
            radius={[4, 4, 0, 0]}
            maxBarSize={56}
            isAnimationActive={!reducedMotion}
          >
            {rows.map((row) => (
              <Cell key={row.key} fill={row.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}

interface WaterfallRow {
  key: string;
  label: string;
  value: number;
  role: "start" | "delta" | "total";
  base: number;
  magnitude: number;
  running: number;
  color: string;
}

/**
 * Places each bar on an invisible pedestal at its running position — that
 * pedestal is what makes a stacked bar chart read as a waterfall. Module
 * scope because a cursor reassigned during render trips
 * react-hooks/immutability.
 */
function layoutWaterfall(
  steps: Extract<DashboardVisual, { kind: "waterfall" }>["data"]["steps"],
): WaterfallRow[] {
  return steps.reduce<WaterfallRow[]>((rows, step) => {
    const cursor = rows.at(-1)?.running ?? 0;
    if (step.role === "start" || step.role === "total") {
      return [
        ...rows,
        {
          ...step,
          base: 0,
          magnitude: Math.abs(step.value),
          running: step.value,
          color: step.role === "start" ? CHART_COLORS.qualitative[0] : CHART_COLORS.action,
        },
      ];
    }
    const next = cursor + step.value;
    return [
      ...rows,
      {
        ...step,
        base: Math.min(cursor, next),
        magnitude: Math.abs(step.value),
        running: next,
        color: step.value < 0 ? CHART_COLORS.success : CHART_COLORS.warning,
      },
    ];
  }, []);
}
