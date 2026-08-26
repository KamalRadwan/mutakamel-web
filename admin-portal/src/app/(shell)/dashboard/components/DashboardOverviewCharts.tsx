"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";
import type { DashboardResponse } from "@/types/dashboard";
import { KpiCard } from "./KpiCard";
import { UnavailableDashboardPanel } from "./DashboardDataState";
import { TenantGrowthRevenueChart } from "./charts/TenantGrowthRevenueChart";
import { TenantStatusDonutChart } from "./charts/TenantStatusDonutChart";
import { DomainHealthGaugeChart } from "./charts/DomainHealthGaugeChart";
import { RegionalDistributionBarChart } from "./charts/RegionalDistributionBarChart";
import { ServerCapacityChart } from "./charts/ServerCapacityChart";
import { CollectionGaugeChart } from "./charts/CollectionGaugeChart";
import { MetricDonutChart, type DonutSegment } from "./charts/MetricDonutChart";
import { BillingCashFlowComposedChart } from "./charts/BillingCashFlowComposedChart";
import { BillingAgingReportBarChart } from "./charts/BillingAgingReportBarChart";
import { SubscriptionTargetGauge } from "./charts/SubscriptionTargetGauge";
import { SubscriptionARPUSplineChart } from "./charts/SubscriptionARPUSplineChart";
import { SubscriptionChurnComposedChart } from "./charts/SubscriptionChurnComposedChart";
import { SubscriptionRenewalsBarChart } from "./charts/SubscriptionRenewalsBarChart";
import { BillingDSOAreaChart } from "./charts/BillingDSOAreaChart";
import { BillingRevenueByProductRadar } from "./charts/BillingRevenueByProductRadar";
import { BillingGatewaySplitDonut } from "./charts/BillingGatewaySplitDonut";
import { BillingFailureReasonsBarChart } from "./charts/BillingFailureReasonsBarChart";
import { BillingTaxDistributionPie } from "./charts/BillingTaxDistributionPie";
import { BillingForecastSplineChart } from "./charts/BillingForecastSplineChart";
import type { DashboardDataset, DashboardMetricTone, DashboardNamedValue } from "@/types/dashboard";

const NAMED_VALUE_PALETTE = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#06b6d4", "#ef4444"];

function paletteColor(index: number): string {
  return NAMED_VALUE_PALETTE[index % NAMED_VALUE_PALETTE.length];
}

function namedValuesToDonut(items: DashboardNamedValue[]): DonutSegment[] {
  return items.map((item, index) => ({
    key: item.key,
    name: item.label,
    value: item.value,
    color: paletteColor(index),
  }));
}

const TONE_COLOR: Record<DashboardMetricTone, string> = {
  green: "#10b981",
  blue: "#3b82f6",
  amber: "#f59e0b",
  red: "#ef4444",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
};

interface DashboardOverviewChartsProps {
  data: DashboardResponse;
}

export function DashboardOverviewCharts({ data }: DashboardOverviewChartsProps) {
  const { t, lang } = useI18n();
  const { overview, panels, analytics } = data;

  return (
    <div className="space-y-5">
      {overview.kpis.length > 0 && (
        <section>
          <SectionHeading title={t.dashboard.overviewTab.kpisTitle} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {overview.kpis.map((kpi) => (
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
            points={overview.tenantBillingGrowth.points}
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
          <RecentTenantsList items={overview.recentTenants.items} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title={t.dashboard.tenantsTab.statusBreakdownTitle} subtitle={t.dashboard.tenantsTab.statusDistributionSubtitle}>
          <TenantStatusDonutChart
            items={overview.tenantLifecycle.items.map((item) => ({
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
            {overview.domainHealth.regions.length > 0 && (
              <div>
                <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t.dashboard.tenantsTab.regionalDistributionTitle}
                </p>
                <RegionalDistributionBarChart regions={overview.domainHealth.regions} height={160} />
              </div>
            )}
          </div>
        </ChartCard>

        <ChartCard title={t.dashboard.serversTab.capacityComparisonTitle} subtitle={t.dashboard.serversTab.capacityComparisonSubtext}>
          {panels.databaseCapacity.items.length > 0 ? (
            <ServerCapacityChart servers={panels.databaseCapacity.items} />
          ) : (
            <UnavailableDashboardPanel title={t.dashboard.serversTab.capacityComparisonTitle} className="min-h-0" />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title={t.dashboard.billingTab.subscriptionLifecycleTitle}>
          <BreakdownDonut items={overview.subscriptionStatus.items} total={overview.subscriptionStatus.total} />
        </ChartCard>

        <ChartCard title={t.dashboard.overviewTab.revenueByPlanTitle} subtitle={t.dashboard.overviewTab.revenueByPlanSubtext}>
          <BreakdownDonut
            items={overview.billingSummary.items}
            total={overview.billingSummary.items.reduce((sum, item) => sum + item.value, 0)}
          />
        </ChartCard>

        <ChartCard title={t.dashboard.billingTab.collectionRatioTitle} subtitle={t.dashboard.billingTab.collectionRatioSubtext}>
          <CollectionGaugeChart collectedRatio={overview.billingSummary.collectedRatio} />
        </ChartCard>
      </div>

      {analytics && (
        <>
          <SectionHeading title={lang === "ar" ? "تحليلات الاشتراكات" : "Subscription analytics"} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <AnalyticsChartCard title={lang === "ar" ? "الهدف السنوي للإيرادات" : "ARR target"} dataset={analytics.subscriptions.arrTarget}>
              {(value) => <SubscriptionTargetGauge actualARR={value.actual} targetARR={value.target} />}
            </AnalyticsChartCard>

            <AnalyticsChartCard title={lang === "ar" ? "متوسط الإيراد المحصل" : "Average collected revenue"} dataset={analytics.subscriptions.averageCollectedRevenue}>
              {(value) => (
                <SubscriptionARPUSplineChart
                  data={value.points.map((point) => ({ month: point.label, arpu: point.value }))}
                  metricLabel={lang === "ar" ? "الإيراد المحصل" : "Collected revenue"}
                />
              )}
            </AnalyticsChartCard>

            <AnalyticsChartCard title={lang === "ar" ? "صحة المدفوعات" : "Payment health"} dataset={analytics.subscriptions.paymentHealth}>
              {(value) => <MetricDonutChart data={namedValuesToDonut(value)} />}
            </AnalyticsChartCard>

            <AnalyticsChartCard title={lang === "ar" ? "الاستحواذ والمغادرة" : "Acquisition vs. churn"} dataset={analytics.subscriptions.churnAndAcquisition} className="lg:col-span-2">
              {(value) => (
                <SubscriptionChurnComposedChart
                  data={value.points.map((point) => ({
                    month: point.label,
                    newAcquisitions: point.primary,
                    churned: point.secondary,
                  }))}
                />
              )}
            </AnalyticsChartCard>

            <AnalyticsChartCard title={lang === "ar" ? "التجديدات القادمة" : "Upcoming renewals"} dataset={analytics.subscriptions.upcomingRenewals}>
              {(value) => (
                <SubscriptionRenewalsBarChart
                  data={value.points.map((point) => ({ month: point.label, renewals: point.value }))}
                />
              )}
            </AnalyticsChartCard>
          </div>

          <SectionHeading title={lang === "ar" ? "تحليلات الفوترة" : "Billing analytics"} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <AnalyticsChartCard title={lang === "ar" ? "التدفق النقدي" : "Cash flow"} dataset={analytics.billing.cashFlow}>
              {(value) => (
                <BillingCashFlowComposedChart
                  data={value.points.map((point) => ({
                    month: point.label,
                    expected: point.primary,
                    actual: point.secondary,
                  }))}
                />
              )}
            </AnalyticsChartCard>

            <AnalyticsChartCard title={lang === "ar" ? "تقادم المستحقات" : "Receivables aging"} dataset={analytics.billing.aging}>
              {(value) => (
                <BillingAgingReportBarChart
                  data={value.items.map((item) => ({ bucket: item.label, amount: item.value }))}
                />
              )}
            </AnalyticsChartCard>

            <AnalyticsChartCard title={lang === "ar" ? "أيام المبيعات غير المحصلة" : "Days sales outstanding"} dataset={analytics.billing.daysSalesOutstanding}>
              {(value) => (
                <BillingDSOAreaChart data={value.points.map((point) => ({ month: point.label, dso: point.value }))} />
              )}
            </AnalyticsChartCard>

            <AnalyticsChartCard title={lang === "ar" ? "الإيرادات حسب الغرض" : "Revenue by purpose"} dataset={analytics.billing.revenueByPurpose}>
              {(value) => (
                <BillingRevenueByProductRadar data={value.items.map((item) => ({ product: item.label, revenue: item.value }))} />
              )}
            </AnalyticsChartCard>

            <AnalyticsChartCard title={lang === "ar" ? "توزيع بوابات الدفع" : "Payment gateway split"} dataset={analytics.billing.paymentProviders}>
              {(value) => (
                <BillingGatewaySplitDonut
                  data={value.map((item, index) => ({ gateway: item.label, volume: item.value, color: paletteColor(index) }))}
                />
              )}
            </AnalyticsChartCard>

            <AnalyticsChartCard title={lang === "ar" ? "أسباب فشل الدفع" : "Payment failure reasons"} dataset={analytics.billing.paymentFailureReasons}>
              {(value) => (
                <BillingFailureReasonsBarChart data={value.map((item) => ({ reason: item.label, count: item.value }))} />
              )}
            </AnalyticsChartCard>

            <AnalyticsChartCard title={lang === "ar" ? "توزيع الضرائب حسب الدولة" : "Tax by country"} dataset={analytics.billing.taxByCountry}>
              {(value) => (
                <BillingTaxDistributionPie
                  data={value.items.map((item, index) => ({ region: item.label, amount: item.value, color: paletteColor(index) }))}
                />
              )}
            </AnalyticsChartCard>

            <AnalyticsChartCard title={lang === "ar" ? "توقعات التجديد" : "Renewal forecast"} dataset={analytics.billing.renewalForecast}>
              {(value) => (
                <BillingForecastSplineChart data={value.points.map((point) => ({ month: point.label, forecast: point.value }))} />
              )}
            </AnalyticsChartCard>
          </div>
        </>
      )}
    </div>
  );
}

function AnalyticsChartCard<T>({
  title,
  dataset,
  className,
  children,
}: {
  title: string;
  dataset: DashboardDataset<T>;
  className?: string;
  children: (value: T) => React.ReactNode;
}) {
  return (
    <ChartCard title={title} className={className}>
      {dataset.available ? (
        children(dataset.data)
      ) : (
        <UnavailableDashboardPanel title={title} dataset={dataset} className="min-h-0" />
      )}
    </ChartCard>
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
