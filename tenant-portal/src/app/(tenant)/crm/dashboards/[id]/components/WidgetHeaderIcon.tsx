"use client";
import { Activity, AlertTriangle, BarChart3, Briefcase, Filter, Layers, PieChart, Target, TrendingUp, Users } from "lucide-react";
import type { CrmVisualization } from "../../widget-contract";

export function WidgetHeaderIcon({
  visualizationType,
  metricKey,
}: {
  visualizationType: CrmVisualization;
  metricKey: string | null;
}) {
  const key = metricKey ?? "";
  if (visualizationType === "ALERT_LIST" || key.includes(".overdue") || key.includes(".stale")) {
    return <AlertTriangle className="size-4" aria-hidden="true" />;
  }
  if (visualizationType === "ACTIVITY_FEED" || key.includes("activities") || key.includes("calendar")) {
    return <Activity className="size-4" aria-hidden="true" />;
  }
  if (
    visualizationType === "SEMI_CIRCLE_GAUGE" ||
    visualizationType === "THREE_QUARTER_GAUGE" ||
    visualizationType === "CIRCULAR_PROGRESS_GAUGE" ||
    visualizationType === "DETAILED_SPEEDOMETER" ||
    visualizationType === "PROGRESS_CARD" ||
    visualizationType === "BULLET"
  ) {
    return <Target className="size-4" aria-hidden="true" />;
  }
  if (visualizationType === "FUNNEL") return <Filter className="size-4" aria-hidden="true" />;
  if (visualizationType === "DONUT" || visualizationType === "PIE") {
    return <PieChart className="size-4" aria-hidden="true" />;
  }
  if (visualizationType === "LINE" || visualizationType === "AREA" || visualizationType === "LINE_AREA") {
    return <TrendingUp className="size-4" aria-hidden="true" />;
  }
  if (visualizationType === "STACKED_BAR" || visualizationType === "STACKED_BAR_100") {
    return <Layers className="size-4" aria-hidden="true" />;
  }
  if (key.includes("leads") || key.includes("customer_profiles")) {
    return <Users className="size-4" aria-hidden="true" />;
  }
  if (key.includes("opportunities")) {
    return <Briefcase className="size-4" aria-hidden="true" />;
  }
  return <BarChart3 className="size-4" aria-hidden="true" />;
}


