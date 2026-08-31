"use client";

import { useRef } from "react";
import type { DashboardMetricTone } from "@/types/dashboard";
import { useI18n } from "@/i18n/I18nContext";
import { useDashboardChartGroupReady } from "../../hooks/useDashboardChartGroupReady";
import { DashboardChartCard } from "./DashboardChartCard";
import type { DashboardChartGroupReservation } from "./DashboardChartViewport";
import { CollectionGaugeChart } from "./CollectionGaugeChart";
import {
  qualitativeColor,
  STATUS_TONE_COLOR,
} from "./ChartAccessibility";
import { MetricDonutChart, type DonutSegment } from "./MetricDonutChart";

interface BreakdownItem {
  key: string;
  label: string;
  value: number;
  tone: DashboardMetricTone;
}

export interface DashboardBillingChartsGroupProps {
  subscriptionStatusItems: BreakdownItem[];
  subscriptionTotal: number;
  billingSummaryItems: BreakdownItem[];
  collectedRatio: number;
  reservation: DashboardChartGroupReservation;
  onReady?: () => void;
}

export function DashboardBillingChartsGroup({
  subscriptionStatusItems,
  subscriptionTotal,
  billingSummaryItems,
  collectedRatio,
  reservation,
  onReady,
}: DashboardBillingChartsGroupProps) {
  const { t } = useI18n();
  const groupRef = useRef<HTMLDivElement>(null);
  useDashboardChartGroupReady(groupRef, onReady);

  return (
    <div ref={groupRef} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <DashboardChartCard
        title={t.dashboard.billingTab.subscriptionLifecycleTitle}
        style={{ minBlockSize: reservation.cards[0] }}
      >
        <BreakdownDonut
          items={subscriptionStatusItems}
          total={subscriptionTotal}
          title={t.dashboard.billingTab.subscriptionLifecycleTitle}
          colorMode="status"
        />
      </DashboardChartCard>

      <DashboardChartCard
        title={t.dashboard.overviewTab.revenueByPlanTitle}
        subtitle={t.dashboard.overviewTab.revenueByPlanSubtext}
        style={{ minBlockSize: reservation.cards[1] }}
      >
        <BreakdownDonut
          items={billingSummaryItems}
          total={billingSummaryItems.reduce((sum, item) => sum + item.value, 0)}
          title={t.dashboard.overviewTab.revenueByPlanTitle}
          colorMode="qualitative"
        />
      </DashboardChartCard>

      <DashboardChartCard
        title={t.dashboard.billingTab.collectionRatioTitle}
        subtitle={t.dashboard.billingTab.collectionRatioSubtext}
        style={{ minBlockSize: reservation.cards[2] }}
      >
        <CollectionGaugeChart
          collectedRatio={collectedRatio}
          title={t.dashboard.billingTab.collectionRatioTitle}
        />
      </DashboardChartCard>
    </div>
  );
}

function BreakdownDonut({
  items,
  total,
  title,
  colorMode,
}: {
  items: BreakdownItem[];
  total: number;
  title: string;
  colorMode: "qualitative" | "status";
}) {
  const segments: DonutSegment[] = items.map((item, index) => ({
    key: item.key,
    name: item.label,
    value: item.value,
    color: colorMode === "status" ? STATUS_TONE_COLOR[item.tone] : qualitativeColor(index),
  }));

  return <MetricDonutChart data={segments} title={title} centerValue={total} />;
}
