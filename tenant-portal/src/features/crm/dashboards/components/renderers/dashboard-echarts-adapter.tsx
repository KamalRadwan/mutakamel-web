"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart, FunnelChart, GaugeChart, HeatmapChart, LineChart, PieChart, ScatterChart, TreemapChart } from "echarts/charts";
import {
  AriaComponent,
  CalendarComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  TransformComponent,
  VisualMapComponent,
  ToolboxComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import type { EChartsType } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import type { DashboardPointSelection } from "../../models/dashboard-types";
import styles from "./dashboard-echarts.module.css";

echarts.use([
  AriaComponent,
  BarChart,
  CalendarComponent,
  FunnelChart,
  GaugeChart,
  GridComponent,
  HeatmapChart,
  LegendComponent,
  LineChart,
  PieChart,
  ScatterChart,
  SVGRenderer,
  TooltipComponent,
  TransformComponent,
  TreemapChart,
  VisualMapComponent,
  ToolboxComponent,
]);

export function DashboardECharts({
  option,
  ariaLabel,
  summary,
  onPointSelect,
}: {
  option: EChartsOption;
  ariaLabel: string;
  summary: Array<string | { label: string; selection: DashboardPointSelection }>;
  onPointSelect?: (selection: DashboardPointSelection) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const selectionHandlerRef = useRef(onPointSelect);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    selectionHandlerRef.current = onPointSelect;
  }, [onPointSelect]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(preference.matches);
    update();
    preference.addEventListener?.("change", update);
    return () => preference.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = echarts.init(host, undefined, { 
      renderer: "svg",
      width: host.clientWidth || 200,
      height: host.clientHeight || 200
    });
    chartRef.current = chart;
    const clickHandler = (parameters: unknown) => {
      const selection = pointSelectionFromEvent(parameters);
      if (selection) selectionHandlerRef.current?.(selection);
    };
    chart.on("click", clickHandler);

    const resize = () => chart.resize();
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(resize);
    resizeObserver?.observe(host);
    if (!resizeObserver) window.addEventListener("resize", resize);

    const root = document.documentElement;
    const themeObserver = typeof MutationObserver === "undefined"
      ? undefined
      : new MutationObserver(() => {
          host.dir = root.dir === "rtl" ? "rtl" : "ltr";
          chart.resize();
        });
    host.dir = root.dir === "rtl" ? "rtl" : "ltr";
    themeObserver?.observe(root, { attributes: true, attributeFilter: ["class", "dir", "data-theme"] });

    return () => {
      themeObserver?.disconnect();
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener("resize", resize);
      chart.off("click", clickHandler);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(reduceMotion ? withoutMotion(option) : option, { notMerge: true, lazyUpdate: false });
  }, [option, reduceMotion]);

  return (
    <div className={styles.frame}>
      <div
        ref={hostRef}
        className={`${styles.chart}${onPointSelect ? ` ${styles.interactive}` : ""}`}
        role="img"
        aria-label={ariaLabel}
        data-chart-engine="echarts-svg"
      />
      <ul className={styles.summary} aria-label={`${ariaLabel} data`}>
        {summary.map((entry, index) => {
          const label = typeof entry === "string" ? entry : entry.label;
          return (
            <li key={`${index}:${label}`}>
              {typeof entry === "string" || !onPointSelect
                ? label
                : (
                    <button
                      type="button"
                      data-point-key={entry.selection.pointKey}
                      data-series-key={entry.selection.seriesKey}
                      onClick={() => onPointSelect(entry.selection)}
                    >
                      {label}
                    </button>
                  )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function withoutMotion(option: EChartsOption): EChartsOption {
  return {
    ...option,
    animation: false,
    animationDuration: 0,
    animationDurationUpdate: 0,
  };
}

export function pointSelectionFromEvent(parameters: unknown): DashboardPointSelection | undefined {
  if (!parameters || typeof parameters !== "object") return undefined;
  const data = (parameters as { data?: unknown }).data;
  if (!data || typeof data !== "object") return undefined;
  const candidate = data as {
    drilldownCapable?: unknown;
    pointKey?: unknown;
    seriesKey?: unknown;
  };
  if (candidate.drilldownCapable !== true || typeof candidate.pointKey !== "string") return undefined;
  return {
    pointKey: candidate.pointKey,
    ...(typeof candidate.seriesKey === "string" ? { seriesKey: candidate.seriesKey } : {}),
  };
}
