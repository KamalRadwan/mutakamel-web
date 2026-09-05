"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import {
  Badge,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system";
import type { DashboardResponse } from "@/types/dashboard";
import {
  billingValueItems,
  collectedRatio,
  databaseServerRows,
  domainHealth as readDomainHealth,
  subscriptionStatusItems as readSubscriptionStatusItems,
  subscriptionTotal as readSubscriptionTotal,
  tenantLifecycleTotal as readTenantLifecycleTotal,
  tenantRegions,
  tenantStatusItems,
} from "../utils/overview-sources";
import { KpiCard } from "./KpiCard";
import { TenantGrowthRevenueChart } from "./charts/TenantGrowthRevenueChart";
import { DashboardChartCard } from "./charts/DashboardChartCard";
import {
  billingChartGroupReservation,
  DashboardChartChunkLoading,
  DashboardChartViewport,
  operationalChartGroupReservation,
} from "./charts/DashboardChartViewport";
import type { DashboardOperationalChartsGroupProps } from "./charts/DashboardOperationalChartsGroup";
import type { DashboardBillingChartsGroupProps } from "./charts/DashboardBillingChartsGroup";
import {
  formatChartCurrency,
  formatChartNumber,
  formatChartPercent,
  getChartCopy,
} from "./charts/ChartAccessibility";

const loadOperationalChartsGroup = () =>
  import("./charts/DashboardOperationalChartsGroup");
const loadBillingChartsGroup = () => import("./charts/DashboardBillingChartsGroup");

export async function preloadDashboardChartGroups(): Promise<void> {
  await Promise.all([loadOperationalChartsGroup(), loadBillingChartsGroup()]);
}

const LazyOperationalChartsGroup = dynamic<DashboardOperationalChartsGroupProps>(
  () =>
    loadOperationalChartsGroup().then(
      (module) => module.DashboardOperationalChartsGroup,
    ),
  { loading: () => <DashboardChartChunkLoading kind="operations" /> },
);

const LazyBillingChartsGroup = dynamic<DashboardBillingChartsGroupProps>(
  () =>
    loadBillingChartsGroup().then(
      (module) => module.DashboardBillingChartsGroup,
    ),
  { loading: () => <DashboardChartChunkLoading kind="billing" /> },
);

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
  forceRenderLazyCharts?: boolean;
  printChartsReady?: boolean;
  onOperationalChartsReady?: () => void;
  onBillingChartsReady?: () => void;
}

export function DashboardOverviewCharts({
  data,
  forceRenderLazyCharts = false,
  printChartsReady = false,
  onOperationalChartsReady,
  onBillingChartsReady,
}: DashboardOverviewChartsProps) {
  const { lang, t } = useI18n();
  const { overview } = data;

  const kpis = safeArray(overview.kpis);
  // Core drops both of these when the actor lacks the permission behind them
  // — growth needs tenants *and* billing. An operator with only one of the two
  // is a normal case, not a broken response, so the panels that read them are
  // simply not rendered rather than crashing the whole overview.
  const recentTenants = safeArray(overview.recentTenants?.items);
  const growth = overview.tenantBillingGrowth;
  const tenantGrowthPoints = safeArray(growth?.points);

  // Every chart input below comes from the group that owns it. The parallel
  // overview/panels structures these used to read were deleted with the
  // legacy payload.
  const tenantLifecycleItems = tenantStatusItems(data);
  const tenantLifecycleTotal = readTenantLifecycleTotal(data);
  const domainHealth = readDomainHealth(data);
  const domainRegions = tenantRegions(data);
  const databaseCapacityItems = databaseServerRows(data);
  const subscriptionStatusItems = readSubscriptionStatusItems(data);
  const subscriptionTotal = readSubscriptionTotal(data);
  const billingSummaryItems = billingValueItems(data);
  const billingCollectedRatio = collectedRatio(data);
  const billingTotalAmount = billingSummaryItems.reduce(
    (sum, item) => sum + item.value,
    0,
  );

  const operationalReservation = operationalChartGroupReservation({
    tenantStatusCount: tenantLifecycleItems.length,
    domainTotal: domainHealth.totalDomains,
    regionCount: domainRegions.length,
    serverCount: databaseCapacityItems.length,
  });
  const billingReservation = billingChartGroupReservation({
    subscriptionCount: subscriptionStatusItems.length,
    planCount: billingSummaryItems.length,
  });

  useEffect(() => {
    // Start fetching the two below-fold chunks without mounting their Recharts
    // trees. Viewport-lazy DOM/render behavior is preserved, while explicit
    // export is less likely to wait on network after the operator requests it.
    void preloadDashboardChartGroups().catch(() => undefined);
  }, []);

  const printSections: PrintValueSection[] = [
    {
      key: "tenant-growth",
      title: t.dashboard.overviewTab.growthTitle,
      rows: tenantGrowthPoints.map((point, index) => ({
        key: `${point.month}-${index}`,
        label: point.month || formatChartNumber(lang, index + 1),
        value: `${t.dashboard.overviewTab.tenantCount}: ${formatChartNumber(lang, point.tenants)} · ${t.dashboard.overviewTab.collectedRevenue}: ${formatChartCurrency(lang, point.collected, growth?.currencyCode ?? "USD")}`,
      })),
    },
    {
      key: "tenant-lifecycle",
      title: t.dashboard.tenantsTab.statusBreakdownTitle,
      rows: [
        ...tenantLifecycleItems.map((item) => ({
          key: item.key,
          label: item.label,
          value: formatChartNumber(lang, item.value),
        })),
        {
          key: "tenant-total",
          label: t.dashboard.tenantsTab.totalTenantsLabel,
          value: formatChartNumber(lang, tenantLifecycleTotal),
        },
      ],
    },
    {
      key: "domain-health",
      title: t.dashboard.tenantsTab.domainHealthTitle,
      rows: [
        {
          key: "verified",
          label: t.dashboard.domainVerifiedActive,
          value: formatChartNumber(lang, domainHealth.verifiedDomains),
        },
        {
          key: "unverified",
          label: t.dashboard.tenantsTab.unverifiedDomains,
          value: formatChartNumber(
            lang,
            Math.max(
              0,
              domainHealth.totalDomains -
                domainHealth.verifiedDomains -
                domainHealth.invalidDomains,
            ),
          ),
        },
        {
          key: "invalid",
          label: t.dashboard.domainPendingInvalid,
          value: formatChartNumber(lang, domainHealth.invalidDomains),
        },
        {
          key: "domain-total",
          label: getChartCopy(lang).total,
          value: formatChartNumber(lang, domainHealth.totalDomains),
        },
      ],
    },
    {
      key: "regions",
      title: t.dashboard.tenantsTab.regionalDistributionTitle,
      rows: domainRegions.map((region) => ({
        key: region.key,
        label: region.countryName || region.countryIsoCode || region.key,
        value: `${formatChartNumber(lang, region.count)} · ${formatChartPercent(lang, region.ratio)}`,
      })),
    },
    {
      key: "database-capacity",
      title: t.dashboard.serversTab.capacityComparisonTitle,
      rows: databaseCapacityItems.map((server) => ({
        key: server.id,
        label: server.name || server.id,
        value: `${t.dashboard.serversTab.activeTenants}: ${formatChartNumber(lang, server.currentTenants)} · ${t.dashboard.serversTab.availableCapacity}: ${formatChartNumber(lang, Math.max(0, server.maxTenants - server.currentTenants))} · ${getChartCopy(lang).utilization}: ${formatChartPercent(lang, server.utilization)}`,
      })),
    },
    {
      key: "subscriptions",
      title: t.dashboard.billingTab.subscriptionLifecycleTitle,
      rows: [
        ...subscriptionStatusItems.map((item) => ({
          key: item.key,
          label: item.label,
          value: formatChartNumber(lang, item.value),
        })),
        {
          key: "subscription-total",
          label: getChartCopy(lang).total,
          value: formatChartNumber(lang, subscriptionTotal),
        },
      ],
    },
    {
      key: "billing",
      title: t.dashboard.overviewTab.revenueByPlanTitle,
      rows: [
        ...billingSummaryItems.map((item) => ({
          key: item.key,
          label: item.label,
          value: formatChartNumber(lang, item.value),
        })),
        {
          key: "billing-total",
          label: getChartCopy(lang).total,
          value: formatChartNumber(lang, billingTotalAmount),
        },
        {
          key: "collection-ratio",
          label: t.dashboard.billingTab.collectionRatioTitle,
          value: formatChartPercent(lang, billingCollectedRatio),
        },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      {kpis.length > 0 && (
        <section>
          <SectionHeading title={t.dashboard.overviewTab.kpisTitle} />
          {/* Denser than the default stat grid: six cards that each now carry
              a chart would otherwise push the real charts below the fold. */}
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
            {kpis.map((kpi) => (
              <KpiCard key={kpi.key} card={kpi} compact />
            ))}
          </div>
        </section>
      )}

      {/* An absent field means the actor may not see that data at all, so the
          card is withheld rather than drawn empty — an empty frame reads as
          "no tenants" when the truth is "not yours to see". */}
      {(growth || overview.recentTenants) && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {growth && (
            <DashboardChartCard
              className="xl:col-span-2"
              title={t.dashboard.overviewTab.growthTitle}
              subtitle={t.dashboard.overviewTab.growthSubtext}
            >
              <TenantGrowthRevenueChart
                points={tenantGrowthPoints}
                title={t.dashboard.overviewTab.growthTitle}
                currencyCode={growth.currencyCode}
              />
            </DashboardChartCard>
          )}

          {overview.recentTenants && (
            <DashboardChartCard
              className={growth ? undefined : "xl:col-span-3"}
              title={t.dashboard.overviewTab.recentTenantsTitle}
              action={
                <Link
                  href="/tenants"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {t.dashboard.overviewTab.viewAllTenants}
                </Link>
              }
            >
              <RecentTenantsList items={recentTenants} />
            </DashboardChartCard>
          )}
        </div>
      )}

      <DashboardChartViewport
        kind="operations"
        reservation={operationalReservation}
        forceRender={forceRenderLazyCharts}
        className={printChartsReady ? undefined : "print:hidden"}
      >
        <LazyOperationalChartsGroup
          tenantLifecycleItems={tenantLifecycleItems}
          tenantLifecycleTotal={tenantLifecycleTotal}
          domainHealth={domainHealth}
          domainRegions={domainRegions}
          databaseCapacityItems={databaseCapacityItems}
          reservation={operationalReservation}
          onReady={onOperationalChartsReady}
        />
      </DashboardChartViewport>

      <DashboardChartViewport
        kind="billing"
        reservation={billingReservation}
        forceRender={forceRenderLazyCharts}
        className={printChartsReady ? undefined : "print:hidden"}
      >
        <LazyBillingChartsGroup
          subscriptionStatusItems={subscriptionStatusItems}
          subscriptionTotal={subscriptionTotal}
          billingSummaryItems={billingSummaryItems}
          collectedRatio={billingCollectedRatio}
          reservation={billingReservation}
          onReady={onBillingChartsReady}
        />
      </DashboardChartViewport>

      {/* A titled section with no rows prints as a heading over blank paper,
          which reads as "nothing happened" rather than "you were not shown
          this". Same reason the cards above are withheld. */}
      <DashboardPrintExactValues
        sections={printSections.filter((section) => section.rows.length > 0)}
        visibleInPrint={!printChartsReady}
      />
    </div>
  );
}

interface PrintValueSection {
  key: string;
  title: string;
  rows: Array<{ key: string; label: string; value: string }>;
}

function DashboardPrintExactValues({
  sections,
  visibleInPrint,
}: {
  sections: PrintValueSection[];
  visibleInPrint: boolean;
}) {
  const { lang } = useI18n();
  const copy = getChartCopy(lang);

  return (
    <section
      data-dashboard-print-fallback
      aria-label={copy.exactValues}
      className={visibleInPrint ? "hidden space-y-5 print:block" : "hidden"}
    >
      <h2 className="text-lg font-semibold text-foreground">{copy.exactValues}</h2>
      {sections.map((section) => (
        <div key={section.key} className="break-inside-avoid space-y-2">
          <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
          {section.rows.length > 0 ? (
            <Table className="w-full border-collapse text-xs">
              <TableCaption className="sr-only">{section.title}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="text-start">
                    {copy.category}
                  </TableHead>
                  <TableHead scope="col" className="text-end">
                    {copy.value}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="text-start">{row.label}</TableCell>
                    <TableCell className="text-end font-mono tabular-nums" dir="auto">
                      {row.value}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-xs text-muted-foreground">{copy.noData}</p>
          )}
        </div>
      ))}
    </section>
  );
}

function RecentTenantsList({
  items,
}: {
  items: Array<{ id: string; name: string; status: string; plan: string; createdAt: string }>;
}) {
  const { t } = useI18n();
  if (items.length === 0) {
    return (
      <p className="rounded-md bg-muted p-4 text-xs text-muted-foreground">
        {t.dashboard.noRecentTenants}
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.slice(0, 6).map((tenant) => (
        <li key={tenant.id}>
          {/* The whole row is the target rather than the name alone: at this
              size a text-width hit area is a miss most of the time, and the
              status badge is part of what the reader is pointing at. */}
          <Link
            href={`/tenants/${tenant.id}`}
            className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transition-none"
          >
            <span className="min-w-0">
              {/* A tenant name is a proper noun, so `dir="auto"` keeps a Latin
                  name readable inside the Arabic page. */}
              <span
                className="block truncate text-xs font-semibold text-foreground"
                dir="auto"
              >
                {tenant.name}
              </span>
              <span className="block text-xs text-muted-foreground">{tenant.plan}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <Badge tone="neutral">{tenant.status}</Badge>
              <ChevronLeft
                className="size-4 text-muted-foreground rtl:block ltr:hidden"
                aria-hidden="true"
              />
              <ChevronRight
                className="size-4 text-muted-foreground ltr:block rtl:hidden"
                aria-hidden="true"
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SectionHeading({ title }: { title: string }) {
  return <h2 className="mb-3 px-1 text-sm font-semibold text-foreground">{title}</h2>;
}
