"use client";

import {
  Area,
  AreaChart as RechartsAreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  ComposedChart as RechartsComposedChart,
  Legend,
  LabelList,
  Line,
  LineChart as RechartsLineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS_TICK,
  CHART_ANIMATION,
  ChartFrame,
  ChartTooltipCard,
  GRID_STROKE,
  useChartDirection,
  useChartNumberFormat,
} from "./chart-common";
import { orderStatusRoles, STATUS_FILL, type ChartRole } from "./chart-palette";

export interface CartesianSeries {
  /** Key into each row of `data`. */
  key: string;
  /** Already translated — this pattern never reads the dictionary. */
  label: string;
  /**
   * The role this series means.
   *
   * **A series is coloured by outcome, never by identity.** Three products do
   * not get three hues; that is a qualitative breakdown and it belongs in
   * `DonutChart` or a stacked bar built from `topNWithOther`. See
   * docs/design/tokens.md#charts.
   */
  role: ChartRole;
  /** Optional CSS variable token fill when stacking or separating multi-series lines/bars. */
  fill?: string;
  axis?: "LEFT" | "RIGHT";
  kind?: "line" | "bar" | "area";
  strokeDasharray?: string;
  opacity?: number;
  stackKey?: string;
  diverging?: boolean;
  valueFormatter?: (value: number) => string;
}

export interface CartesianChartProps {
  /** Rows keyed by `xKey` plus one key per series. Values are plain numbers, already parsed by the caller. */
  data: Array<Record<string, string | number | null>>;
  xKey: string;
  series: CartesianSeries[];
  label: string;
  summary: string;
  height?: number;
  /** Stacks bars and areas. Ignored for lines. */
  stacked?: boolean;
  showLegend?: boolean;
  numberFormat?: Intl.NumberFormatOptions;
  /** Overrides number formatting consistently for axes, tooltips and value labels. */
  valueFormatter?: (value: number) => string;
  showPoints?: boolean;
  showValues?: boolean;
  className?: string;
  /** Horizontal bars put categories on y; this is not a CSS rotation. */
  horizontal?: boolean;
  axisLabels?: Partial<Record<"LEFT" | "RIGHT", string>>;
  valueAxes?: Partial<Record<"LEFT" | "RIGHT", { integers?: boolean; domain?: [number, number] }>>;
  onPointSelect?: (rowIndex: number) => void;
}

type Variant = "line" | "bar" | "area" | "composed";

const CHART_BY_VARIANT = {
  line: RechartsLineChart,
  bar: RechartsBarChart,
  area: RechartsAreaChart,
  composed: RechartsComposedChart,
} as const;

function CartesianChart({ variant, ...props }: CartesianChartProps & { variant: Variant }) {
  const {
    data,
    xKey,
    series,
    label,
    summary,
    height,
    stacked,
    showLegend = true,
    numberFormat,
    valueFormatter,
    showPoints = false,
    showValues = false,
    className,
    horizontal = false,
    axisLabels,
    valueAxes,
    onPointSelect,
  } = props;

  const direction = useChartDirection();
  const { format: defaultFormat } = useChartNumberFormat(numberFormat);
  const format = valueFormatter ?? defaultFormat;
  // Canonical role order, so caution and negative are never adjacent fills in a
  // stack or a legend — chart-palette.ts#STATUS_DRAW_ORDER.
  const ordered = orderStatusRoles(series);
  const Chart = CHART_BY_VARIANT[variant];
  const seriesFormat = (item?: CartesianSeries) => item?.valueFormatter ?? format;
  const axisFormat = (axis: "LEFT" | "RIGHT") => seriesFormat(ordered.find((item) => (item.axis ?? "LEFT") === axis));
  const diverging = horizontal && ordered.some((item) => item.diverging);
  const valueLabel = (item: CartesianSeries) => {
    if (!showValues) return null;
    const signed = horizontal && item.diverging;
    // For a signed bar Recharts positions "right" beyond x + width, where width can be negative.
    const end = signed || !direction.reversed ? "right" : "left";
    return <LabelList dataKey={item.key} position={horizontal ? end : "top"}
      formatter={(value: unknown) => typeof value === "number"
        ? `${signed && value > 0 ? "+" : ""}${seriesFormat(item)(value)}` : ""}
      fill={AXIS_TICK.fill} fontSize={AXIS_TICK.fontSize} />;
  };

  return (
    <ChartFrame label={label} summary={summary} height={height} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} layout={horizontal ? "vertical" : "horizontal"} accessibilityLayer
          onClick={(event) => { const rawIndex = event.activeTooltipIndex; const index = Number(rawIndex); if (rawIndex !== null && rawIndex !== "" && Number.isInteger(index) && index >= 0 && index < data.length) onPointSelect?.(index); }}
          margin={{ top: showValues ? 20 : 4, right: diverging && showValues ? 36 : 12, bottom: 0, left: diverging && showValues ? 36 : 12 }}>
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey={horizontal ? undefined : xKey}
            type={horizontal ? "number" : "category"}
            tickFormatter={horizontal ? axisFormat("LEFT") : undefined}
            allowDecimals={horizontal ? !valueAxes?.LEFT?.integers : undefined}
            domain={horizontal ? valueAxes?.LEFT?.domain : undefined}
            reversed={direction.reversed}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: GRID_STROKE }}
          />
          {(horizontal || ordered.some((item) => (item.axis ?? "LEFT") === "LEFT")) && <YAxis
            yAxisId="LEFT"
            type={horizontal ? "category" : "number"}
            dataKey={horizontal ? xKey : undefined}
            width={horizontal ? 104 : "auto"}
            orientation={direction.valueAxisOrientation}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            tickFormatter={horizontal ? undefined : axisFormat("LEFT")}
            allowDecimals={horizontal ? undefined : !valueAxes?.LEFT?.integers}
            domain={horizontal ? undefined : valueAxes?.LEFT?.domain}
            label={!horizontal && axisLabels?.LEFT ? { value: axisLabels.LEFT, angle: direction.reversed ? 90 : -90, position: direction.reversed ? "insideRight" : "insideLeft", fill: AXIS_TICK.fill, fontSize: AXIS_TICK.fontSize } : undefined}
          />}
          {!horizontal && ordered.some((item) => item.axis === "RIGHT") && <YAxis yAxisId="RIGHT"
            orientation={direction.valueAxisOrientation === "left" ? "right" : "left"}
            allowDecimals={!valueAxes?.RIGHT?.integers} domain={valueAxes?.RIGHT?.domain}
            tick={AXIS_TICK} tickLine={false} axisLine={false} width="auto" tickFormatter={axisFormat("RIGHT")}
            label={axisLabels?.RIGHT ? { value: axisLabels.RIGHT, angle: direction.reversed ? -90 : 90, position: direction.reversed ? "insideLeft" : "insideRight", fill: AXIS_TICK.fill, fontSize: AXIS_TICK.fontSize } : undefined} />}
          <Tooltip
            cursor={{ fill: "var(--accent)", fillOpacity: 0.4 }}
            content={({ active, payload, label: axisLabel }) =>
              active && payload?.length ? (
                <ChartTooltipCard
                  dir={direction.dir}
                  title={String(axisLabel ?? "")}
                  entries={payload.filter((entry) => typeof entry.value === "number" && Number.isFinite(entry.value)).map((entry) => {
                    const item = ordered.find((item) => item.key === entry.dataKey);
                    const value = Number(entry.value);
                    return {
                      label: item?.label ?? String(entry.name),
                      value: seriesFormat(item)(value),
                      fill: item?.diverging && value < 0 ? STATUS_FILL.negative : typeof entry.color === "string" ? entry.color : undefined,
                    };
                  })}
                />
              ) : null
            }
          />
          {showLegend && (
            <Legend
              align={direction.legendAlign}
              verticalAlign="bottom"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ direction: direction.dir, fontSize: 11, paddingTop: 8 }}
            />
          )}

          {ordered.map((item) => {
            const color = item.fill ?? STATUS_FILL[item.role];
            const kind = item.kind ?? (variant === "composed" ? "bar" : variant);
            const axis = horizontal ? "LEFT" : item.axis ?? "LEFT";
            const stackId = stacked ? item.stackKey ?? axis : undefined;
            return kind === "line" ? (
              <Line
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                yAxisId={axis}
                stroke={color}
                strokeWidth={2}
                strokeDasharray={item.strokeDasharray}
                strokeOpacity={item.opacity}
                dot={showPoints}
                connectNulls={false}
                {...CHART_ANIMATION}
              >
                {valueLabel(item)}
              </Line>
            ) : kind === "area" ? (
              <Area
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                yAxisId={axis}
                stackId={stackId}
                stroke={color}
                fill={color}
                fillOpacity={item.opacity ?? 0.22}
                strokeWidth={2}
                strokeDasharray={item.strokeDasharray}
                dot={showPoints}
                connectNulls={false}
                {...CHART_ANIMATION}
              >
                {valueLabel(item)}
              </Area>
            ) : (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.label}
                yAxisId={axis}
                stackId={stackId}
                fill={color}
                fillOpacity={item.opacity ?? 1}
                radius={[3, 3, 0, 0]}
                {...CHART_ANIMATION}
              >
                {item.diverging && data.map((row, index) => {
                  const value = row[item.key];
                  return <Cell key={index} fill={typeof value === "number" && value < 0 ? STATUS_FILL.negative : color} />;
                })}
                {valueLabel(item)}
              </Bar>
            );
          })}
          {diverging && <ReferenceLine x={0} yAxisId="LEFT" stroke={AXIS_TICK.fill} />}
        </Chart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** A trend over time. One line per outcome role. */
export function LineChart(props: CartesianChartProps) {
  return <CartesianChart {...props} variant="line" />;
}

/** A comparison across categories. Stack only when the parts sum to a meaningful whole. */
export function BarChart(props: CartesianChartProps) {
  return <CartesianChart {...props} variant="bar" />;
}

/** A trend where the filled volume is the point — a pipeline value over time. */
export function AreaChart(props: CartesianChartProps) {
  return <CartesianChart {...props} variant="area" />;
}

/** A declared combination of geometries with separately formatted numeric axes. */
export function ComposedChart(props: CartesianChartProps) {
  return <CartesianChart {...props} variant="composed" />;
}
