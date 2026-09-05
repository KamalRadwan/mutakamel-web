"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { useI18n } from "@/i18n/I18nContext";
import type { DashboardVisual } from "@/types/dashboard";
import {
  CHART_COLORS,
  ChartFigure,
  formatChartPercent,
  getChartCopy,
  useReducedMotion,
} from "../../charts/ChartAccessibility";
import { bandColor, clampRatio, formatVisualValue } from "../visual-format";

type GaugeVisualModel = Extract<DashboardVisual, { kind: "gauge" }>;

/**
 * A ratio against a real maximum, with named threshold bands. The bands are
 * listed as text in the legend and the table — colour is never the only thing
 * saying whether a reading is healthy.
 */
export function GaugeVisual({
  visual,
  height = 200,
}: {
  visual: GaugeVisualModel;
  height?: number;
}) {
  const { lang, t } = useI18n();
  const reducedMotion = useReducedMotion();
  const copy = getChartCopy(lang);
  const { value, maximum } = visual.data;
  const ratio = clampRatio(maximum > 0 ? value / maximum : 0);
  const bands = visual.reference?.bands ?? [];
  const band = bands.find((candidate) => ratio <= candidate.upTo);
  const fill = band ? bandColor(band.tone) : CHART_COLORS.action;
  const remaining = Math.max(0, maximum - value);
  // What the gap means. Absent, it is simply "not yet" and stays the neutral
  // grid grey; `danger` says the shortfall is itself the defect — an
  // unverified domain, not merely an unfilled one — so the unreached arc
  // reads red while the filled part keeps whatever its band earned.
  const shortfallIsTheProblem = visual.reference?.remainderTone === "danger";
  const restColor = shortfallIsTheProblem ? CHART_COLORS.danger : CHART_COLORS.grid;

  const arc = [
    { key: "value", name: visual.title, value: ratio, color: fill },
    { key: "rest", name: t.dashboard.visuals.remaining, value: 1 - ratio, color: restColor },
  ];

  const statusText = band
    ? t.dashboard.visuals.bandTone[band.tone]
    : t.dashboard.visuals.noThreshold;
  // Colour is never the only encoding: a red gap is also said in words.
  const shortfallText = shortfallIsTheProblem
    ? ` ${t.dashboard.visuals.remainderNeedsAttention}`
    : "";

  const summary =
    lang === "ar"
      ? `${visual.title}: ${formatVisualValue(lang, value, visual.unit)} من ${formatVisualValue(lang, maximum, visual.unit)}، أي ${formatChartPercent(lang, ratio)}. الحالة: ${statusText}.${shortfallText}`
      : `${visual.title}: ${formatVisualValue(lang, value, visual.unit)} of ${formatVisualValue(lang, maximum, visual.unit)}, or ${formatChartPercent(lang, ratio)}. Status: ${statusText}.${shortfallText}`;

  return (
    <ChartFigure
      title={visual.title}
      summary={summary}
      lang={lang}
      height={height}
      legend={[
        {
          key: "current",
          label: t.dashboard.visuals.current,
          color: fill,
          value: formatVisualValue(lang, value, visual.unit),
        },
        {
          key: "remaining",
          label: t.dashboard.visuals.remaining,
          color: restColor,
          value: formatVisualValue(lang, remaining, visual.unit),
        },
      ]}
      columns={[copy.category, copy.value]}
      rows={[
        { key: "current", cells: [t.dashboard.visuals.current, formatVisualValue(lang, value, visual.unit)] },
        { key: "maximum", cells: [t.dashboard.visuals.maximum, formatVisualValue(lang, maximum, visual.unit)] },
        { key: "remaining", cells: [t.dashboard.visuals.remaining, formatVisualValue(lang, remaining, visual.unit)] },
        { key: "utilization", cells: [t.dashboard.visuals.utilization, formatChartPercent(lang, ratio)] },
        { key: "status", cells: [t.dashboard.visuals.status, statusText] },
        ...bands.map((entry) => ({
          key: `band-${entry.tone}`,
          cells: [
            `${t.dashboard.visuals.threshold} · ${t.dashboard.visuals.bandTone[entry.tone]}`,
            `≤ ${formatChartPercent(lang, entry.upTo)}`,
          ],
        })),
      ]}
    >
      <div className="relative flex size-full items-center justify-center">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart accessibilityLayer={false} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Pie
              data={arc}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="78%"
              startAngle={180}
              endAngle={0}
              innerRadius="62%"
              outerRadius="92%"
              stroke="none"
              isAnimationActive={!reducedMotion}
            >
              {arc.map((slice) => (
                <Cell key={slice.key} fill={slice.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute bottom-3 flex flex-col items-center text-center">
          <span
            className="font-mono text-2xl font-semibold tracking-tight"
            style={{ color: fill }}
            dir="auto"
          >
            {formatChartPercent(lang, ratio)}
          </span>
          <span className="text-xs font-semibold text-muted-foreground" dir="auto">
            {formatVisualValue(lang, value, visual.unit)} / {formatVisualValue(lang, maximum, visual.unit)}
          </span>
        </div>
      </div>
    </ChartFigure>
  );
}
