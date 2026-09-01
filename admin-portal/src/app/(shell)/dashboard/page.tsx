"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AlertTriangle, Lock, RotateCw } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Button, Skeleton } from "@/design-system";
import { DashboardHeader } from "./components/DashboardHeader";
import { DashboardTabsNav } from "./components/DashboardTabsNav";
import { DashboardGroupPanel } from "./components/DashboardGroupPanel";
import { DashboardGroupsOverview } from "./components/DashboardGroupsOverview";
import { DashboardRefreshPauseControl } from "./components/DashboardRefreshPauseControl";
import { preloadDashboardChartGroups } from "./components/DashboardOverviewCharts";
import { useDashboardData } from "./hooks/useDashboardData";
import { useDashboardPrint } from "./hooks/useDashboardPrint";
import { usePrintableDisclosures } from "./hooks/usePrintableDisclosures";
import { getAuthorizedDashboardGroupKeys } from "./utils/dashboard-groups";

export default function DashboardPage() {
  const { t } = useI18n();
  const headerRefreshRegionRef = useRef<HTMLDivElement>(null);
  const dataRefreshRegionRef = useRef<HTMLDivElement>(null);
  const ownedRefreshRegionRefs = useMemo(
    () => [headerRefreshRegionRef, dataRefreshRegionRef],
    [],
  );
  const [autoRefreshMenuOpen, setAutoRefreshMenuOpen] = useState(false);
  const {
    activeTab,
    setActiveTab,
    range,
    setRange,
    autoRefreshInterval,
    setAutoRefreshInterval,
    operatorRefreshPaused,
    setOperatorRefreshPaused,
    isAutoRefreshPaused,
    autoRefreshPauseReasons,
    data,
    isLoading,
    isRefreshing,
    isForbidden,
    isRateLimited,
    error,
    handleRefresh,
    loadAllGroups,
  } = useDashboardData({
    ownedRefreshRegionRefs,
    modalOrMenuOpen: autoRefreshMenuOpen,
  });
  // Charts keep their exact values in collapsed disclosures; printing has to
  // see them.
  usePrintableDisclosures(dataRefreshRegionRef);

  const dashboardPrint = useDashboardPrint({
    hasLazyCharts: activeTab === "overview" && Boolean(data),
    preloadLazyCharts: preloadDashboardChartGroups,
  });

  // The export is the one reader that needs every group at once; tab
  // rendering only ever fetches the group on screen.
  const handlePrintReport = useCallback(async () => {
    await loadAllGroups();
    dashboardPrint.requestPrint();
  }, [dashboardPrint, loadAllGroups]);
  const { markChartGroupReady, readinessCycle } = dashboardPrint;
  const markOperationalChartsReady = useCallback(
    () => {
      void readinessCycle;
      markChartGroupReady("operations");
    },
    [markChartGroupReady, readinessCycle],
  );
  const markBillingChartsReady = useCallback(
    () => {
      void readinessCycle;
      markChartGroupReady("billing");
    },
    [markChartGroupReady, readinessCycle],
  );

  if (isForbidden && !data) {
    return (
      <PageShell>
        <section role="alert" className="mx-auto flex min-h-[55vh] max-w-md flex-col items-center justify-center text-center">
          <div className="flex size-14 items-center justify-center rounded-lg bg-destructive-subtle text-destructive-subtle-foreground">
            <Lock className="size-7" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-foreground">
            {t.dashboard.accessDeniedTitle}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t.dashboard.accessDeniedDesc}
          </p>
        </section>
      </PageShell>
    );
  }

  // Tabs come from the authorized set; the panel's data may still be in
  // flight, because switching tabs is what triggers its fetch.
  const groupKeys = data ? getAuthorizedDashboardGroupKeys(data) : [];
  const activeGroup =
    activeTab === "overview" ? undefined : data?.[activeTab];

  return (
    <PageShell>
      <div ref={headerRefreshRegionRef}>
        <DashboardHeader
          isRefreshing={isRefreshing || isLoading}
          onRefresh={handleRefresh}
          range={range}
          onRangeChange={setRange}
          autoRefreshInterval={autoRefreshInterval}
          autoRefreshPaused={isAutoRefreshPaused}
          onAutoRefreshChange={setAutoRefreshInterval}
          onAutoRefreshMenuOpenChange={setAutoRefreshMenuOpen}
          onPrintReport={handlePrintReport}
          isPreparingPrint={dashboardPrint.isPreparingPrint}
          printFallbackReason={dashboardPrint.printFallbackReason}
        />
      </div>

      <DashboardRefreshPauseControl
        interval={autoRefreshInterval}
        isPaused={isAutoRefreshPaused}
        operatorPaused={operatorRefreshPaused}
        pauseReasons={autoRefreshPauseReasons}
        onOperatorPausedChange={setOperatorRefreshPaused}
      />

      <div ref={dataRefreshRegionRef} className="space-y-5">
        {error && (
          <ErrorBanner
            stale={Boolean(data)}
            rateLimited={isRateLimited}
            message={error.response?.data?.message ?? error.response?.data?.detail ?? error.response?.data?.title ?? error.message}
            code={error.response?.data?.errorCode ?? error.response?.data?.code}
            correlationId={error.response?.data?.correlationId}
            onRetry={handleRefresh}
          />
        )}

        {isLoading && !data ? (
          <DashboardSkeleton />
        ) : data ? (
          <>
            <DashboardTabsNav
              activeTab={activeTab}
              onTabChange={setActiveTab}
              groups={groupKeys}
            />
            {activeTab === "overview" ? (
              <DashboardGroupsOverview
                data={data}
                onOpenGroup={setActiveTab}
                forceRenderCharts={dashboardPrint.forceRenderCharts}
                printChartsReady={dashboardPrint.chartsReady}
                onOperationalChartsReady={markOperationalChartsReady}
                onBillingChartsReady={markBillingChartsReady}
              />
            ) : activeGroup ? (
              <DashboardGroupPanel
                groupKey={activeTab}
                group={activeGroup}
                rangeLabel={data.range.label}
              />
            ) : (
              <DashboardGroupSkeleton />
            )}
          </>
        ) : null}
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="w-full space-y-5">{children}</div>;
}

function ErrorBanner({
  stale,
  rateLimited,
  message,
  code,
  correlationId,
  onRetry,
}: {
  stale: boolean;
  rateLimited: boolean;
  message: string;
  code?: string;
  correlationId?: string;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  return (
    <section
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive-subtle p-4 text-destructive-subtle-foreground sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold">
            {stale ? t.dashboard.staleRefreshTitle : t.dashboard.loadFailedTitle}
          </h2>
          <p className="mt-1 text-xs leading-5 opacity-90">
            {rateLimited ? t.dashboard.rateLimitedMessage : message}
          </p>
          {(code || correlationId) && (
            <p className="mt-2 font-mono text-xs opacity-70">
              {[code, correlationId].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onRetry} className="shrink-0 border-destructive/40 text-destructive">
        <RotateCw className="size-3.5" aria-hidden="true" />
        {t.dashboard.retryButton}
      </Button>
    </section>
  );
}

/** Shown while a tab's own group is still being fetched. */
function DashboardGroupSkeleton() {
  const { t } = useI18n();
  return (
    <div
      className="space-y-4"
      aria-label={t.dashboard.visuals.chartsAriaLabel}
      aria-busy="true"
    >
      <Skeleton className="h-20 w-full" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-64 w-full" />
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading dashboard" aria-busy="true">
      <Skeleton className="h-14 w-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-36 w-full" />
        ))}
      </div>
    </div>
  );
}
