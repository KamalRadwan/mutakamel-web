"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Card } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { DASHBOARD_CHART_VISUAL_ITEM_LIMIT } from "./ChartAccessibility";

export type DashboardChartGroupKind = "operations" | "billing";

export interface DashboardChartGroupReservation {
  narrow: number;
  wide: number;
  cards: readonly [number, number, number];
}

interface DashboardChartViewportProps {
  kind: DashboardChartGroupKind;
  reservation: DashboardChartGroupReservation;
  forceRender?: boolean;
  className?: string;
  children: ReactNode;
}

const GROUP_COPY = {
  en: {
    operations: "Operational dashboard charts",
    billing: "Billing dashboard charts",
    loading: (label: string) => `Loading ${label.toLocaleLowerCase("en-US")}…`,
  },
  ar: {
    operations: "الرسوم البيانية التشغيلية للوحة التحكم",
    billing: "الرسوم البيانية للفوترة في لوحة التحكم",
    loading: (label: string) => `جارٍ تحميل ${label}…`,
  },
} as const;

export function DashboardChartViewport({
  kind,
  reservation,
  forceRender = false,
  className = "",
  children,
}: DashboardChartViewportProps) {
  const { lang } = useI18n();
  const rootRef = useRef<HTMLElement>(null);
  const [shouldRender, setShouldRender] = useState(false);
  const copy = GROUP_COPY[lang];
  const label = copy[kind];
  const loadingLabel = copy.loading(label);

  useEffect(() => {
    if (shouldRender || forceRender) return;

    const target = rootRef.current;
    if (!target || typeof window.IntersectionObserver !== "function") {
      let active = true;
      queueMicrotask(() => {
        if (active) setShouldRender(true);
      });
      return () => {
        active = false;
      };
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setShouldRender(true);
        observer.disconnect();
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [forceRender, shouldRender]);

  const renderCharts = forceRender || shouldRender;

  const reservationStyle = {
    "--dashboard-chart-group-narrow": `${reservation.narrow}px`,
    "--dashboard-chart-group-wide": `${reservation.wide}px`,
  } as CSSProperties;

  return (
    <section
      ref={rootRef}
      aria-label={label}
      aria-busy={renderCharts ? undefined : true}
      className={`relative min-h-(--dashboard-chart-group-narrow) lg:min-h-(--dashboard-chart-group-wide) ${className}`}
      style={reservationStyle}
    >
      {renderCharts ? (
        children
      ) : (
        <DashboardChartGroupLoading
          label={loadingLabel}
          cardBlockSizes={reservation.cards}
        />
      )}
    </section>
  );
}

export function DashboardChartChunkLoading({ kind }: { kind: DashboardChartGroupKind }) {
  const { lang } = useI18n();
  const copy = GROUP_COPY[lang];
  const label = copy.loading(copy[kind]);

  return (
    <div aria-busy="true" className="absolute inset-0 flex items-center justify-center">
      <p role="status" aria-live="polite" className="rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function DashboardChartGroupLoading({
  label,
  cardBlockSizes,
}: {
  label: string;
  cardBlockSizes: readonly [number, number, number];
}) {
  return (
    <div className="relative">
      <div aria-hidden="true" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {cardBlockSizes.map((blockSize, index) => (
          <Card key={index} className="bg-muted/35" style={{ minBlockSize: blockSize }} />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <p role="status" aria-live="polite" className="rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
          {label}
        </p>
      </div>
    </div>
  );
}

export function operationalChartGroupReservation({
  tenantStatusCount,
  domainTotal,
  regionCount,
  serverCount,
}: {
  tenantStatusCount: number;
  domainTotal: number;
  regionCount: number;
  serverCount: number;
}): DashboardChartGroupReservation {
  const visibleRegionCount = Math.min(
    Math.max(0, regionCount),
    DASHBOARD_CHART_VISUAL_ITEM_LIMIT,
  );
  const visibleServerCount = Math.min(
    Math.max(0, serverCount),
    DASHBOARD_CHART_VISUAL_ITEM_LIMIT,
  );
  const tenantCard = tenantStatusCount > 0 ? 480 : 340;
  const domainGauge = domainTotal > 0 ? 260 : 220;
  const regionalChart =
    visibleRegionCount > 0
      ? Math.max(160, visibleRegionCount * 32 + 24) + 144
      : 0;
  const domainCard = domainGauge + regionalChart + (regionalChart > 0 ? 16 : 0);
  const serverChart =
    visibleServerCount > 0
      ? Math.max(240, visibleServerCount * 40 + 80) + 240
      : 240;
  const cards = [tenantCard, domainCard, serverChart] as const;

  return {
    cards,
    narrow: cards.reduce((total, value) => total + value, 32),
    wide: Math.max(...cards),
  };
}

export function billingChartGroupReservation({
  subscriptionCount,
  planCount,
}: {
  subscriptionCount: number;
  planCount: number;
}): DashboardChartGroupReservation {
  const subscriptionCard = subscriptionCount > 0 ? 450 : 310;
  const planCard = planCount > 0 ? 450 : 310;
  const collectionCard = 410;
  const cards = [subscriptionCard, planCard, collectionCard] as const;

  return {
    cards,
    narrow: cards.reduce((total, value) => total + value, 32),
    wide: Math.max(...cards),
  };
}
