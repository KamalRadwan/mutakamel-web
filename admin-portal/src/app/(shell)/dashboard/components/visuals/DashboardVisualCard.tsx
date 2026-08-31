"use client";

import { useI18n } from "@/i18n/I18nContext";
import type { DashboardVisual } from "@/types/dashboard";
import { localizeVisual } from "./localize-visual";
import { DashboardChartCard } from "../charts/DashboardChartCard";
import { BarVisual } from "./kinds/BarVisual";
import { BulletVisual } from "./kinds/BulletVisual";
import { DonutVisual } from "./kinds/DonutVisual";
import { FunnelVisual } from "./kinds/FunnelVisual";
import { GaugeVisual } from "./kinds/GaugeVisual";
import { HeatmapVisual } from "./kinds/HeatmapVisual";
import { ParetoVisual } from "./kinds/ParetoVisual";
import { TimeSeriesVisual } from "./kinds/TimeSeriesVisual";
import { TwoSeriesVisual } from "./kinds/TwoSeriesVisual";
import { WaterfallVisual } from "./kinds/WaterfallVisual";

/**
 * The one place a `kind` becomes a chart. Adding a kind means adding a case
 * here and a renderer under `kinds/` — call sites never switch on kind.
 */
export function DashboardVisualBody({ visual }: { visual: DashboardVisual }) {
  switch (visual.kind) {
    case "donut":
      return <DonutVisual visual={visual} />;
    case "bar":
      return <BarVisual visual={visual} />;
    case "pareto":
      return <ParetoVisual visual={visual} />;
    case "funnel":
      return <FunnelVisual visual={visual} />;
    case "comparison":
    case "diverging":
    case "stacked":
    case "dual-axis":
      return <TwoSeriesVisual visual={visual} />;
    case "line":
    case "area":
      return <TimeSeriesVisual visual={visual} />;
    case "gauge":
      return <GaugeVisual visual={visual} />;
    case "bullet":
      return <BulletVisual visual={visual} />;
    case "waterfall":
      return <WaterfallVisual visual={visual} />;
    case "heatmap":
      return <HeatmapVisual visual={visual} />;
  }
}

export function DashboardVisualCard({ visual }: { visual: DashboardVisual }) {
  const { lang, t } = useI18n();
  // Resolved once here, so no renderer below ever handles raw English copy.
  const localized = localizeVisual(visual, lang, t);
  return (
    <DashboardChartCard
      title={localized.title}
      subtitle={localized.subtitle}
      className={localized.emphasis === "primary" ? "xl:col-span-2" : undefined}
    >
      <DashboardVisualBody visual={localized} />
    </DashboardChartCard>
  );
}
