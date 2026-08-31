"use client";

import {
  Area,
  AreaChart as RechartsAreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
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
}

export interface CartesianChartProps {
  /** Rows keyed by `xKey` plus one key per series. Values are plain numbers, already parsed by the caller. */
  data: Array<Record<string, string | number>>;
  xKey: string;
  series: CartesianSeries[];
  label: string;
  summary: string;
  height?: number;
  /** Stacks bars and areas. Ignored for lines. */
  stacked?: boolean;
  showLegend?: boolean;
  numberFormat?: Intl.NumberFormatOptions;
  className?: string;
}

type Variant = "line" | "bar" | "area";

const CHART_BY_VARIANT = {
  line: RechartsLineChart,
  bar: RechartsBarChart,
  area: RechartsAreaChart,
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
    className,
  } = props;

  const direction = useChartDirection();
  const { format } = useChartNumberFormat(numberFormat);
  // Canonical role order, so caution and negative are never adjacent fills in a
  // stack or a legend — chart-palette.ts#STATUS_DRAW_ORDER.
  const ordered = orderStatusRoles(series);
  const Chart = CHART_BY_VARIANT[variant];

  return (
    <ChartFrame label={label} summary={summary} height={height} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey={xKey}
            reversed={direction.reversed}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: GRID_STROKE }}
          />
          <YAxis
            orientation={direction.valueAxisOrientation}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            tickFormatter={format}
          />
          <Tooltip
            cursor={{ fill: "var(--accent)", fillOpacity: 0.4 }}
            content={({ active, payload, label: axisLabel }) =>
              active && payload?.length ? (
                <ChartTooltipCard
                  dir={direction.dir}
                  title={String(axisLabel ?? "")}
                  entries={payload.map((entry) => ({
                    label: ordered.find((item) => item.key === entry.dataKey)?.label ?? String(entry.name),
                    value: format(Number(entry.value ?? 0)),
                    fill: typeof entry.color === "string" ? entry.color : undefined,
                  }))}
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

          {ordered.map((item) =>
            variant === "line" ? (
              <Line
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stroke={STATUS_FILL[item.role]}
                strokeWidth={2}
                dot={false}
                {...CHART_ANIMATION}
              />
            ) : variant === "area" ? (
              <Area
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stackId={stacked ? "stack" : undefined}
                stroke={STATUS_FILL[item.role]}
                fill={STATUS_FILL[item.role]}
                fillOpacity={0.18}
                strokeWidth={2}
                {...CHART_ANIMATION}
              />
            ) : (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.label}
                stackId={stacked ? "stack" : undefined}
                fill={STATUS_FILL[item.role]}
                radius={2}
                {...CHART_ANIMATION}
              />
            ),
          )}
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
