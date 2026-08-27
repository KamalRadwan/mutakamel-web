"use client";

import { AlertTriangle, Lock, RotateCw } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Button, Skeleton } from "@/design-system";
import { DashboardHeader } from "./components/DashboardHeader";
import { DashboardTabsNav } from "./components/DashboardTabsNav";
import { DashboardGroupPanel } from "./components/DashboardGroupPanel";
import { DashboardGroupsOverview } from "./components/DashboardGroupsOverview";
import { useDashboardData } from "./hooks/useDashboardData";
import { getAuthorizedDashboardGroups } from "./utils/dashboard-groups";

export default function DashboardPage() {
  const { t } = useI18n();
  const {
    activeTab,
    setActiveTab,
    rangePreset,
    setRangePreset,
    customRange,
    setCustomRange,
    autoRefreshInterval,
    setAutoRefreshInterval,
    data,
    isLoading,
    isRefreshing,
    isForbidden,
    isRateLimited,
    error,
    handleRefresh,
  } = useDashboardData();

  if (isForbidden && !data) {
    return (
      <PageShell>
        <section role="alert" className="mx-auto flex min-h-[55vh] max-w-md flex-col items-center justify-center text-center">
          <div className="flex size-14 items-center justify-center rounded-lg bg-danger-100 text-danger-600 dark:bg-danger-950/40 dark:text-danger-300">
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

  const groups = data ? getAuthorizedDashboardGroups(data) : [];
  const activeGroup =
    activeTab === "overview"
      ? undefined
      : groups.find(([key]) => key === activeTab);

  return (
    <PageShell>
      <DashboardHeader
        isRefreshing={isRefreshing || isLoading}
        onRefresh={handleRefresh}
        rangePreset={rangePreset}
        onRangeChange={setRangePreset}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
        autoRefreshInterval={autoRefreshInterval}
        onAutoRefreshChange={setAutoRefreshInterval}
      />

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
            groups={groups.map(([key]) => key)}
          />
          {activeTab === "overview" ? (
            <DashboardGroupsOverview data={data} onOpenGroup={setActiveTab} />
          ) : activeGroup ? (
            <DashboardGroupPanel
              groupKey={activeGroup[0]}
              group={activeGroup[1]}
              rangeLabel={data.range.label}
            />
          ) : null}
        </>
      ) : null}
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
      className="flex flex-col gap-3 rounded-lg border border-danger-200 bg-danger-50 p-4 text-danger-800 dark:border-danger-900/70 dark:bg-danger-950/30 dark:text-danger-300 sm:flex-row sm:items-start sm:justify-between"
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
      <Button type="button" variant="outline" size="sm" onClick={onRetry} className="shrink-0 border-danger-300 dark:border-danger-800">
        <RotateCw className="size-3.5" aria-hidden="true" />
        {t.dashboard.retryButton}
      </Button>
    </section>
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
