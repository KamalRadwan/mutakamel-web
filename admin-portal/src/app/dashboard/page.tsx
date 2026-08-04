"use client";

import { AlertTriangle, Lock, RotateCw } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { useI18n } from "@/i18n/I18nContext";
import { DashboardHeader } from "./components/DashboardHeader";
import { DashboardTabsNav } from "./components/DashboardTabsNav";
import { DashboardGroupPanel } from "./components/DashboardGroupPanel";
import { DashboardGroupsOverview } from "./components/DashboardGroupsOverview";
import { useDashboardData } from "./hooks/useDashboardData";
import { getAuthorizedDashboardGroups } from "./utils/dashboard-groups";

export default function DashboardPage() {
  const { lang } = useI18n();
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
        <div className="mx-auto flex min-h-[55vh] max-w-md flex-col items-center justify-center text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300">
            <Lock className="size-7" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-xl font-extrabold text-slate-950 dark:text-white">
            {lang === "ar" ? "لا يمكنك فتح لوحة التحكم" : "Dashboard access denied"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {lang === "ar"
              ? "تحتاج إلى صلاحية admin.reports.read لفتح لوحة التحكم."
              : "The admin.reports.read permission is required to open this dashboard."}
          </p>
        </div>
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
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-[#090d16] dark:text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-5 p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
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
  const { lang } = useI18n();
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-extrabold">
            {stale
              ? lang === "ar"
                ? "تعذر تحديث البيانات — المعروض هو آخر رد ناجح"
                : "Refresh failed — showing the last successful response"
              : lang === "ar"
                ? "تعذر تحميل لوحة التحكم"
                : "Dashboard could not be loaded"}
          </h2>
          <p className="mt-1 text-xs leading-5 opacity-90">
            {rateLimited
              ? lang === "ar"
                ? "تم تجاوز حد الطلبات. حاول مرة أخرى لاحقًا."
                : "The request limit was reached. Try again later."
              : message}
          </p>
          {(code || correlationId) && (
            <p className="mt-2 font-mono text-[10px] opacity-70">
              {[code, correlationId].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-red-300 px-3 text-xs font-bold hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-800 dark:hover:bg-red-950/60"
      >
        <RotateCw className="size-3.5" aria-hidden="true" />
        {lang === "ar" ? "إعادة المحاولة" : "Retry"}
      </button>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading dashboard" aria-busy="true">
      <div className="h-14 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
    </div>
  );
}
