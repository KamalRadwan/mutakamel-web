"use client";

import { useRef } from "react";
import type { DashboardMetricTone, DashboardRegionItem } from "@/types/dashboard";
import { useI18n } from "@/i18n/I18nContext";
import { useDashboardChartGroupReady } from "../../hooks/useDashboardChartGroupReady";
import { UnavailableDashboardPanel } from "../DashboardDataState";
import { DashboardChartCard } from "./DashboardChartCard";
import type { DashboardChartGroupReservation } from "./DashboardChartViewport";
import { DomainHealthGaugeChart } from "./DomainHealthGaugeChart";
import { RegionalDistributionBarChart } from "./RegionalDistributionBarChart";
import { ServerCapacityChart } from "./ServerCapacityChart";
import { TenantStatusDonutChart } from "./TenantStatusDonutChart";

interface TenantLifecycleItem {
  key: string;
  label: string;
  value: number;
  description?: string;
  ratio: number;
  tone: DashboardMetricTone;
}

interface DatabaseCapacityItem {
  id: string;
  name: string;
  currentTenants: number;
  maxTenants: number;
  utilization: number;
  tone?: DashboardMetricTone;
}

export interface DashboardOperationalChartsGroupProps {
  tenantLifecycleItems: TenantLifecycleItem[];
  tenantLifecycleTotal: number;
  domainHealth: {
    verifiedDomains: number;
    invalidDomains: number;
    totalDomains: number;
  };
  domainRegions: DashboardRegionItem[];
  databaseCapacityItems: DatabaseCapacityItem[];
  reservation: DashboardChartGroupReservation;
  onReady?: () => void;
}

export function DashboardOperationalChartsGroup({
  tenantLifecycleItems,
  tenantLifecycleTotal,
  domainHealth,
  domainRegions,
  databaseCapacityItems,
  reservation,
  onReady,
}: DashboardOperationalChartsGroupProps) {
  const { t } = useI18n();
  const groupRef = useRef<HTMLDivElement>(null);
  useDashboardChartGroupReady(groupRef, onReady);

  return (
    <div ref={groupRef} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <DashboardChartCard
        title={t.dashboard.tenantsTab.statusBreakdownTitle}
        subtitle={t.dashboard.tenantsTab.statusDistributionSubtitle}
        style={{ minBlockSize: reservation.cards[0] }}
      >
        <TenantStatusDonutChart
          title={t.dashboard.tenantsTab.statusBreakdownTitle}
          items={tenantLifecycleItems.map((item) => ({
            key: item.key,
            label: item.label,
            count: item.value,
            description: item.description ?? "",
            ratio: item.ratio,
            tone: item.tone,
          }))}
          total={tenantLifecycleTotal}
        />
      </DashboardChartCard>

      <DashboardChartCard
        title={t.dashboard.tenantsTab.domainHealthTitle}
        style={{ minBlockSize: reservation.cards[1] }}
      >
        <div className="space-y-4">
          <DomainHealthGaugeChart
            title={t.dashboard.tenantsTab.domainHealthTitle}
            verified={domainHealth.verifiedDomains}
            invalid={domainHealth.invalidDomains}
            total={domainHealth.totalDomains}
          />
          {domainRegions.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                {t.dashboard.tenantsTab.regionalDistributionTitle}
              </p>
              <RegionalDistributionBarChart
                regions={domainRegions}
                title={t.dashboard.tenantsTab.regionalDistributionTitle}
                height={160}
              />
            </div>
          )}
        </div>
      </DashboardChartCard>

      <DashboardChartCard
        title={t.dashboard.serversTab.capacityComparisonTitle}
        subtitle={t.dashboard.serversTab.capacityComparisonSubtext}
        style={{ minBlockSize: reservation.cards[2] }}
      >
        {databaseCapacityItems.length > 0 ? (
          <ServerCapacityChart
            servers={databaseCapacityItems}
            title={t.dashboard.serversTab.capacityComparisonTitle}
          />
        ) : (
          <UnavailableDashboardPanel
            title={t.dashboard.serversTab.capacityComparisonTitle}
            className="min-h-0"
          />
        )}
      </DashboardChartCard>
    </div>
  );
}
