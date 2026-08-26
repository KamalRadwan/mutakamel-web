"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";
import type { DashboardMetricTone, DashboardRegionItem, DashboardResponse } from "@/types/dashboard";
import { KpiCard } from "./KpiCard";
import { UnavailableDashboardPanel } from "./DashboardDataState";
import { TenantGrowthRevenueChart } from "./charts/TenantGrowthRevenueChart";
import { TenantStatusDonutChart } from "./charts/TenantStatusDonutChart";
import { DomainHealthGaugeChart } from "./charts/DomainHealthGaugeChart";
import { RegionalDistributionBarChart } from "./charts/RegionalDistributionBarChart";
import { ServerCapacityChart } from "./charts/ServerCapacityChart";
import { CollectionGaugeChart } from "./charts/CollectionGaugeChart";
import { MetricDonutChart, type DonutSegment } from "./charts/MetricDonutChart";

const TONE_COLOR: Record<DashboardMetricTone, string> = {
  green: "#10b981",
  blue: "#3b82f6",
  amber: "#f59e0b",
  red: "#ef4444",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
};

// The dashboard response's declared types (src/types/dashboard.ts) mark
// every array field as always present, but live responses have been
// observed to omit one (overview.domainHealth.regions came back
// `undefined`) — the backend doesn't always match its own documented
// contract. Every array read from `data` in this file goes through this
// so a missing field renders as empty rather than throwing.
function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

interface DashboardOverviewChartsProps {
  data: DashboardResponse;
}

export function DashboardOverviewCharts({ data }: DashboardOverviewChartsProps) {
  const { t } = useI18n();
  const { overview, panels, tenants } = data;

  const kpis = safeArray(overview.kpis);
  const tenantLifecycleItems = safeArray(overview.tenantLifecycle.items);
  const databaseCapacityItems = safeArray(panels.databaseCapacity.items);
  const subscriptionStatusItems = safeArray(overview.subscriptionStatus.items);
  const billingSummaryItems = safeArray(overview.billingSummary.items);
  const recentTenants = safeArray(overview.recentTenants.items);
  const tenantGrowthPoints = safeArray(overview.tenantBillingGrowth.points);
  // overview.domainHealth.regions is never populated — Core's filterOverview
  // (admin-dashboard.service.ts) always strips it before the response
  // leaves the server. The same per-country breakdown is real and does
  // reach the browser, just on the tenants group instead:
  // tenants.breakdowns.byCountry (built from the same countryBreakdown
  // source on the backend, typed DashboardRegionItem[] there too).
  const domainRegions = safeArray(
    tenants?.available ? (tenants.breakdowns.byCountry as DashboardRegionItem[] | undefined) : undefined,
  );

  return (
    <div className="space-y-5">
      {kpis.length > 0 && (
        <section>
          <SectionHeading title={t.dashboard.overviewTab.kpisTitle} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi) => (
              <KpiCard key={kpi.key} card={kpi} />
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title={t.dashboard.overviewTab.growthTitle}
          subtitle={t.dashboard.overviewTab.growthSubtext}
        >
          <TenantGrowthRevenueChart
            points={tenantGrowthPoints}
            currencyCode={overview.tenantBillingGrowth.currencyCode}
          />
        </ChartCard>

        <ChartCard
          title={t.dashboard.overviewTab.recentTenantsTitle}
          action={
            <Link
              href="/tenants"
              className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              {t.dashboard.overviewTab.viewAllTenants}
            </Link>
          }
        >
          <RecentTenantsList items={recentTenants} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title={t.dashboard.tenantsTab.statusBreakdownTitle} subtitle={t.dashboard.tenantsTab.statusDistributionSubtitle}>
          <TenantStatusDonutChart
            items={tenantLifecycleItems.map((item) => ({
              key: item.key,
              label: item.label,
              count: item.value,
              description: item.description ?? "",
              ratio: item.ratio,
              tone: item.tone,
            }))}
            total={overview.tenantLifecycle.total}
          />
        </ChartCard>

        <ChartCard title={t.dashboard.tenantsTab.domainHealthTitle}>
          <div className="space-y-4">
            <DomainHealthGaugeChart
              verified={overview.domainHealth.verifiedDomains}
              invalid={overview.domainHealth.invalidDomains}
              total={overview.domainHealth.totalDomains}
            />
            {domainRegions.length > 0 && (
              <div>
                <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t.dashboard.tenantsTab.regionalDistributionTitle}
                </p>
                <RegionalDistributionBarChart regions={domainRegions} height={160} />
              </div>
            )}
          </div>
        </ChartCard>

        <ChartCard title={t.dashboard.serversTab.capacityComparisonTitle} subtitle={t.dashboard.serversTab.capacityComparisonSubtext}>
          {databaseCapacityItems.length > 0 ? (
            <ServerCapacityChart servers={databaseCapacityItems} />
          ) : (
            <UnavailableDashboardPanel title={t.dashboard.serversTab.capacityComparisonTitle} className="min-h-0" />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title={t.dashboard.billingTab.subscriptionLifecycleTitle}>
          <BreakdownDonut items={subscriptionStatusItems} total={overview.subscriptionStatus.total} />
        </ChartCard>

        <ChartCard title={t.dashboard.overviewTab.revenueByPlanTitle} subtitle={t.dashboard.overviewTab.revenueByPlanSubtext}>
          <BreakdownDonut
            items={billingSummaryItems}
            total={billingSummaryItems.reduce((sum, item) => sum + item.value, 0)}
          />
        </ChartCard>

        <ChartCard title={t.dashboard.billingTab.collectionRatioTitle} subtitle={t.dashboard.billingTab.collectionRatioSubtext}>
          <CollectionGaugeChart collectedRatio={overview.billingSummary.collectedRatio} />
        </ChartCard>
      </div>
    </div>
  );
}

function BreakdownDonut({
  items,
  total,
}: {
  items: Array<{ key: string; label: string; value: number; tone: DashboardMetricTone }>;
  total: number;
}) {
  if (items.length === 0) return null;
  const segments: DonutSegment[] = items.map((item) => ({
    key: item.key,
    name: item.label,
    value: item.value,
    color: TONE_COLOR[item.tone] ?? TONE_COLOR.blue,
  }));
  return <MetricDonutChart data={segments} centerValue={total} />;
}

function RecentTenantsList({
  items,
}: {
  items: Array<{ id: string; name: string; status: string; plan: string; createdAt: string }>;
}) {
  const { lang } = useI18n();
  if (items.length === 0) {
    return (
      <p className="rounded-xl bg-ink-100 p-4 text-xs text-muted-foreground dark:bg-ink-800">
        {lang === "ar" ? "لا يوجد مستأجرون حديثون." : "No recently provisioned tenants."}
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.slice(0, 6).map((tenant) => (
        <li
          key={tenant.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{tenant.name}</p>
            <p className="text-2xs text-muted-foreground">{tenant.plan}</p>
          </div>
          <span className="shrink-0 rounded-md border border-slate-200 px-2 py-0.5 text-2xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {tenant.status}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SectionHeading({ title }: { title: string }) {
  return <h2 className="mb-3 px-1 text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>;
}

function ChartCard({
  title,
  subtitle,
  action,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
