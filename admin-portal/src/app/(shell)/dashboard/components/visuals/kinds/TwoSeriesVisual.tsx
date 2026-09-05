"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
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
import {
  formatVisualExactValue,
  formatVisualTick,
  formatVisualValue,
} from "../visual-format";

type TwoSeriesModel = Extract<
  DashboardVisual,
  { kind: "comparison" | "diverging" | "stacked" | "dual-axis" }
>;

const PRIMARY = CHART_COLORS.qualitative[0];
const SECONDARY = CHART_COLORS.qualitative[1];

/**
 * One renderer for the four two-metric shapes, because they share an axis
 * model and differ only in how the second series is placed:
 *
 *   comparison — side-by-side bars, same unit, same axis
 *   stacked    — segments that genuinely sum to a whole
 *   diverging  — second series mirrored below a zero baseline
 *   dual-axis  — bars plus a line when the two units differ
 */
export function TwoSeriesVisual({
  visual,
  height = 300,
}: {
  visual: TwoSeriesModel;
  height?: number;
}) {
  const { dir, lang } = useI18n();
  const reducedMotion = useReducedMotion();
  const copy = getChartCopy(lang);
  const { pairs, primaryLabel, secondaryLabel } = visual.data;

  if (pairs.length === 0) {
    return <ChartEmptyState title={visual.title} lang={lang} height={height} />;
  }

  const diverging = visual.kind === "diverging";
  const stacked = visual.kind === "stacked";
  const dualAxis = visual.kind === "dual-axis";
  const secondaryUnit = visual.secondaryUnit ?? visual.unit;

  const rows = pairs.map((pair) => ({
    ...pair,
    // Diverging mirrors the second series below the baseline; the tooltip and
    // the exact-value table both re-absolute it so no reader sees a negative
    // count that does not exist in the source.
    plotted: diverging ? -Math.abs(pair.secondary) : pair.secondary,
  }));

  const primaryTotal = pairs.reduce((sum, pair) => sum + pair.primary, 0);
  const secondaryTotal = pairs.reduce((sum, pair) => sum + pair.secondary, 0);
  const rotateLabels = rows.length > 6;
  // A daily range puts 31 categories on this axis. Forcing every label makes
  // them overlap into noise, so past a dozen the axis thins itself and the
  // exact-value table carries the rest.
  const crowded = rows.length > 12;

  const summary =
    lang === "ar"
      ? `${visual.title}: مقارنة ${primaryLabel} (${formatVisualValue(lang, primaryTotal, visual.unit)}) مع ${secondaryLabel} (${formatVisualValue(lang, secondaryTotal, secondaryUnit)}) عبر ${rows.length} فئة.`
      : `${visual.title}: ${primaryLabel} (${formatVisualValue(lang, primaryTotal, visual.unit)}) compared with ${secondaryLabel} (${formatVisualValue(lang, secondaryTotal, secondaryUnit)}) across ${rows.length} categories.`;

  return (
    <ChartFigure
      title={visual.title}
      summary={summary}
      lang={lang}
      height={height}
      legend={[
        { key: "primary", label: primaryLabel, color: PRIMARY },
        { key: "secondary", label: secondaryLabel, color: SECONDARY },
      ]}
      columns={[copy.category, primaryLabel, secondaryLabel]}
      rows={pairs.map((pair) => ({
        key: pair.key,
        cells: [
          pair.label,
          formatVisualExactValue(lang, pair.primary, visual.unit),
          formatVisualExactValue(lang, pair.secondary, secondaryUnit),
        ],
      }))}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart
          accessibilityLayer={false}
          data={rows}
          margin={{ top: 8, right: dualAxis ? 52 : 16, left: 52, bottom: 0 }}
          stackOffset={diverging ? "sign" : undefined}
        >
          <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            reversed={dir === "rtl"}
            interval={crowded ? "preserveStartEnd" : 0}
            minTickGap={crowded ? 24 : 0}
            angle={rotateLabels ? -28 : 0}
            textAnchor={rotateLabels ? "end" : "middle"}
            height={rotateLabels ? 68 : 30}
            tick={{ fontSize: 13, fill: CHART_COLORS.axis }}
          />
          <YAxis
            yAxisId="primary"
            orientation={dir === "rtl" ? "right" : "left"}
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fontSize: 13, fill: CHART_COLORS.axis }}
            tickFormatter={(value) =>
              formatVisualTick(lang, Math.abs(Number(value)), visual.unit)
            }
          />
          {dualAxis && (
            <YAxis
              yAxisId="secondary"
              orientation={dir === "rtl" ? "left" : "right"}
              tickLine={false}
              axisLine={false}
              width={52}
              tick={{ fontSize: 13, fill: CHART_COLORS.axis }}
              tickFormatter={(value) => formatVisualTick(lang, Number(value), secondaryUnit)}
            />
          )}
          {diverging && (
            <ReferenceLine yAxisId="primary" y={0} stroke={CHART_COLORS.axis} strokeWidth={1} />
          )}
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            isAnimationActive={!reducedMotion}
            content={
              <ChartTooltip
                valueFormatter={(value, item) =>
                  item.dataKey === "plotted"
                    ? formatVisualValue(lang, Math.abs(Number(value)), secondaryUnit)
                    : formatVisualValue(lang, Number(value), visual.unit)
                }
              />
            }
          />
          <Bar
            yAxisId="primary"
            dataKey="primary"
            name={primaryLabel}
            fill={PRIMARY}
            stackId={stacked || diverging ? "two-series" : undefined}
            radius={stacked ? [0, 0, 0, 0] : [4, 4, 0, 0]}
            maxBarSize={40}
            isAnimationActive={!reducedMotion}
          />
          {dualAxis ? (
            <Line
              yAxisId="secondary"
              type="monotone"
              dataKey="plotted"
              name={secondaryLabel}
              stroke={SECONDARY}
              strokeWidth={2.5}
              dot={{ r: 3, fill: SECONDARY, strokeWidth: 0 }}
              isAnimationActive={!reducedMotion}
            />
          ) : (
            <Bar
              yAxisId="primary"
              dataKey="plotted"
              name={secondaryLabel}
              fill={SECONDARY}
              stackId={stacked || diverging ? "two-series" : undefined}
              radius={stacked ? [4, 4, 0, 0] : [4, 4, 0, 0]}
              maxBarSize={40}
              isAnimationActive={!reducedMotion}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
