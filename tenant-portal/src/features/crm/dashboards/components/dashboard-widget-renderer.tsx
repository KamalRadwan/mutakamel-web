"use client";

import { useMemo } from "react";
import type { CrmDashboardWidget, DashboardWidgetResult, DashboardVisualizationType } from "../models/dashboard-types";
import type { DashboardPointSelection } from "./renderers/dashboard-echarts-options";
import { WidgetSkeleton } from "./WidgetSkeleton";
import { WidgetEmpty } from "./WidgetEmpty";
import {
  BarChart3,
  LineChart,
  PieChart,
  Table as TableIcon,
  Trophy,
  Activity,
  Target,
  Gauge,
  TrendingUp,
  SlidersHorizontal,
  Layers,
  Sparkles,
} from "lucide-react";

// Renderers
import { DashboardECharts } from "./renderers/dashboard-echarts-adapter";
import { buildEchartsOption } from "./renderers/dashboard-echarts-options";
import { MetricCardRenderer } from "./renderers/MetricCardRenderer";
import { ProgressCardRenderer } from "./renderers/ProgressCardRenderer";
import { TableRenderer } from "./renderers/TableRenderer";
import { LeaderboardRenderer } from "./renderers/LeaderboardRenderer";

interface DashboardWidgetRendererProps {
  widget: CrmDashboardWidget;
  result?: DashboardWidgetResult;
  loading?: boolean;
  onPointSelect?: (selection: DashboardPointSelection) => void;
  className?: string;
}

function getWidgetIcon(type: DashboardVisualizationType) {
  switch (type) {
    case "METRIC_CARD":
      return TrendingUp;
    case "PROGRESS_CARD":
      return Target;
    case "TABLE":
      return TableIcon;
    case "LEADERBOARD":
      return Trophy;
    case "LINE":
    case "AREA":
    case "LINE_AREA":
      return LineChart;
    case "COLUMN":
    case "BAR":
    case "STACKED_BAR":
    case "STACKED_BAR_100":
    case "COMBO":
      return BarChart3;
    case "PIE":
    case "DONUT":
      return PieChart;
    case "SCATTER":
    case "BUBBLE":
    case "HEATMAP":
      return Activity;
    case "FUNNEL":
      return SlidersHorizontal;
    case "SEMI_CIRCLE_GAUGE":
    case "THREE_QUARTER_GAUGE":
    case "CIRCULAR_PROGRESS_GAUGE":
    case "DETAILED_SPEEDOMETER":
      return Gauge;
    default:
      return Layers;
  }
}

export function DashboardWidgetRenderer({
  widget,
  result,
  loading,
  onPointSelect,
  className = "",
}: DashboardWidgetRendererProps) {
  const type = widget.visualizationType;
  const Icon = getWidgetIcon(type);

  const content = useMemo(() => {
    if (loading || !result) {
      return <WidgetSkeleton type={type} />;
    }

    if (result.error) {
      return <WidgetEmpty message={result.error.message} />;
    }

    const isEchartsEmpty =
      type !== "METRIC_CARD" &&
      type !== "PROGRESS_CARD" &&
      type !== "TABLE" &&
      type !== "LEADERBOARD" &&
      (!result.series ||
        result.series.length === 0 ||
        result.series.every((s) => !s.points || s.points.length === 0));

    if (isEchartsEmpty) {
      return <WidgetEmpty />;
    }

    switch (type) {
      case "METRIC_CARD":
        return <MetricCardRenderer widget={widget} result={result} />;

      case "PROGRESS_CARD":
        return <ProgressCardRenderer widget={widget} result={result} />;

      case "TABLE":
        return <TableRenderer widget={widget} result={result} />;

      case "LEADERBOARD":
        return <LeaderboardRenderer widget={widget} result={result} />;

      case "LINE":
      case "AREA":
      case "LINE_AREA":
      case "COLUMN":
      case "BAR":
      case "STACKED_BAR":
      case "STACKED_BAR_100":
      case "COMBO":
      case "PIE":
      case "DONUT":
      case "SCATTER":
      case "BUBBLE":
      case "FUNNEL":
      case "HEATMAP":
      case "SEMI_CIRCLE_GAUGE":
      case "THREE_QUARTER_GAUGE":
      case "CIRCULAR_PROGRESS_GAUGE":
      case "DETAILED_SPEEDOMETER": {
        const option = buildEchartsOption(widget, result);
        if (!option) return <WidgetEmpty />;
        return (
          <DashboardECharts
            option={option}
            ariaLabel={widget.name}
            summary={[]}
            onPointSelect={onPointSelect}
          />
        );
      }

      default:
        return <WidgetEmpty message={`Unsupported visualization: ${type}`} />;
    }
  }, [type, widget, result, loading, onPointSelect]);

  return (
    <div
      className={`group w-full h-full bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-2xl shadow-sm hover:shadow-xl hover:border-slate-300 dark:hover:border-slate-700/80 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden flex flex-col ${className}`}
    >
      {/* Standardized Card Header */}
      <div className="h-[42px] px-4 border-b border-slate-200/50 dark:border-slate-800/40 bg-slate-50/40 dark:bg-slate-900/40 flex items-center justify-between flex-shrink-0 select-none transition-colors group-hover:bg-slate-50/80 dark:group-hover:bg-slate-900/60">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="p-1.5 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/20 text-blue-600 dark:text-blue-400 flex-shrink-0 shadow-sm border border-blue-100/50 dark:border-blue-800/30">
            <Icon className="w-3.5 h-3.5" />
          </span>
          <h3
            className="text-[13px] sm:text-sm font-semibold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 text-transparent bg-clip-text truncate"
            title={widget.name}
            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
          >
            {widget.name}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ms-3 opacity-70 group-hover:opacity-100 transition-opacity">
          <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm">
            {type.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Card Content Body */}
      <div className="flex-1 min-h-0 w-full relative p-2 overflow-hidden">
        {content}
      </div>
    </div>
  );
}
