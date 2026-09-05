"use client";

import {
  CartesianGrid,
  Cell,
  Label,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { useI18n } from "@/i18n/I18nContext";
import type { DashboardVisual } from "@/types/dashboard";
import { ChartTooltip } from "../../charts/ChartTooltip";
import {
  CHART_COLORS,
  ChartEmptyState,
  ChartFigure,
  dashboardChartVisualItems,
  getChartCopy,
  useReducedMotion,
} from "../../charts/ChartAccessibility";
import { formatVisualTick, formatVisualValue, visualColor } from "../visual-format";

type ScatterModel = Extract<DashboardVisual, { kind: "scatter" }>;

/** Radius bounds, in px. Area, not radius, should track the measure. */
const MIN_AREA = 40;
const MAX_AREA = 400;

/**
 * Two measures per subject, plotted against each other.
 *
 * The shape exists for the question a ranking cannot answer: a 70% failure
 * rate on twelve requests is noise and the same rate on twelve thousand is an
 * incident. A bar chart of rates puts them side by side as equals; only
 * position on two axes separates them.
 *
 * Colour is never the only encoding — the exact-value table below carries
 * every point by name with both coordinates, which is also the only way a
 * screen-reader user can read a cloud of marks at all.
 */
export function ScatterVisual({
  visual,
  height = 300,
}: {
  visual: ScatterModel;
  height?: number;
}) {
  const { dir, lang } = useI18n();
  const reducedMotion = useReducedMotion();
  const copy = getChartCopy(lang);
  const source = visual.data.points;

  if (source.length === 0) {
    return <ChartEmptyState title={visual.title} lang={lang} height={height} />;
  }

  // Bounded like every other visual: the SVG draws at most the house limit,
  // while the table keeps every point Core sent.
  const drawn = dashboardChartVisualItems(source);
  const marks = drawn.map((point, index) => ({
    ...point,
    color: visualColor(index, point.tone),
    // Recharts needs the size field present on every row for `ZAxis` to
    // resolve a domain; a subject with no third measure sits at the floor.
    z: point.size ?? 0,
  }));

  const sized = marks.some((mark) => mark.z > 0);
  // The mark that is furthest up the y axis is the one worth naming, and on
  // a tie the larger subject wins — a high rate matters more at volume.
  const worst = source.reduce(
    (highest, point) =>
      point.y > highest.y || (point.y === highest.y && (point.size ?? 0) > (highest.size ?? 0))
        ? point
        : highest,
    source[0],
  );

  const summary =
    lang === "ar"
      ? `${visual.title}: ${source.length} عنصر، ${visual.data.xLabel} على المحور الأفقي و${visual.data.yLabel} على الرأسي. الأعلى ${worst.label} عند ${formatVisualValue(lang, worst.y, "ratio")} على ${formatVisualValue(lang, worst.x, visual.unit)}.`
      : `${visual.title}: ${source.length} subjects, ${visual.data.xLabel} across and ${visual.data.yLabel} up. Highest is ${worst.label} at ${formatVisualValue(lang, worst.y, "ratio")} on ${formatVisualValue(lang, worst.x, visual.unit)}.`;

  return (
    <ChartFigure
      title={visual.title}
      summary={summary}
      lang={lang}
      height={height}
      columns={[copy.category, visual.data.xLabel, visual.data.yLabel]}
      rows={source.map((point) => ({
        key: point.key,
        cells: [
          point.label,
          formatVisualValue(lang, point.x, visual.unit),
          formatVisualValue(lang, point.y, "ratio"),
        ],
      }))}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ScatterChart
          accessibilityLayer={false}
          margin={{ top: 12, right: 28, left: 24, bottom: 24 }}
        >
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 13, fill: CHART_COLORS.axis }}
            tickFormatter={(value) => formatVisualTick(lang, Number(value), visual.unit)}
          >
            <Label
              value={visual.data.xLabel}
              position="insideBottom"
              offset={-12}
              style={{ fontSize: 13, fill: CHART_COLORS.axis }}
            />
          </XAxis>
          <YAxis
            type="number"
            dataKey="y"
            orientation={dir === "rtl" ? "right" : "left"}
            tickLine={false}
            axisLine={false}
            width={64}
            tick={{ fontSize: 13, fill: CHART_COLORS.axis }}
            tickFormatter={(value) => formatVisualTick(lang, Number(value), "ratio")}
          />
          {/* Area scales with the measure, so a subject ten times the size
              reads as ten times the ink rather than a hundred. */}
          {sized && <ZAxis type="number" dataKey="z" range={[MIN_AREA, MAX_AREA]} />}
          <Tooltip
            isAnimationActive={!reducedMotion}
            content={
              <ChartTooltip
                // A scatter's payload carries x, y and z together, and they
                // are not the same measure: y is a rate. One formatter bound
                // to the chart's unit rendered it as `0.7` while the table and
                // the summary beside it both said `70%`.
                valueFormatter={(value, item) =>
                  formatVisualValue(
                    lang,
                    Number(value),
                    item.dataKey === "y" ? "ratio" : visual.unit,
                  )
                }
              />
            }
          />
          <Scatter
            data={marks}
            name={visual.title}
            isAnimationActive={!reducedMotion}
          >
            {marks.map((mark) => (
              <Cell key={mark.key} fill={mark.color} fillOpacity={0.75} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
