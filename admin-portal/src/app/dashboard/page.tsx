"use client";

import { Navbar } from "@/components/layout/Navbar";
import { useDashboardData } from "./hooks/useDashboardData";
import { DashboardHeader } from "./components/DashboardHeader";
import { DashboardTabsNav } from "./components/DashboardTabsNav";
import { OverviewTab } from "./components/OverviewTab";
import { TenantsTab } from "./components/TenantsTab";
import { ServersTab } from "./components/ServersTab";
import { BillingTab } from "./components/BillingTab";
import { SubscriptionsTab } from "./components/SubscriptionsTab";
import { AlertTriangle, Lock } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { KpiCard } from "./components/KpiCard";

export default function DashboardPage() {
  const { t, lang } = useI18n();
  const {
    activeTab,
    setActiveTab,
    rangePreset,
    setRangePreset,
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

  if (isForbidden) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-4 max-w-sm">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Access Denied</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              You do not have the required `admin.reports.read` permission to view the dashboard.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        <DashboardHeader
          isRefreshing={isRefreshing || isLoading}
          onRefresh={handleRefresh}
          rangePreset={rangePreset}
          onRangeChange={setRangePreset}
          autoRefreshInterval={autoRefreshInterval}
          onAutoRefreshChange={setAutoRefreshInterval}
        />

        {error && !data && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-red-800 dark:text-red-400">Failed to load dashboard</h3>
              <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                {isRateLimited ? "You are being rate limited. Please try again later." : error.message || "An unexpected error occurred."}
              </p>
            </div>
          </div>
        )}

        {isLoading && !data && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {data && (
          <>
            <DashboardTabsNav
              activeTab={activeTab}
              onTabChange={setActiveTab}
              sections={data.sections}
            />

            {/* Overview Tab */}
            {activeTab === "overview" && (
              <OverviewTab
                data={{
                  kpis: data.overview.kpis as any,
                  recentTenants: data.overview.recentTenants.items as any,
                  billingGrowth: data.overview.tenantBillingGrowth as any,
                  subscriptionStatus: data.overview.subscriptionStatus as any,
                }}
              />
            )}

            {/* Dynamic Sections */}
            {activeTab !== "overview" && (
              <div className="space-y-6">
                {/* Find current section to render additive cards */}
                {(() => {
                  const currentSection = data.sections.find((s) => s.key === activeTab);
                  if (currentSection && currentSection.cards.length > 0 && activeTab !== "tenants") {
                    if (activeTab === "subscriptions") {
                      const lifecycleLabels = ["active", "trial", "past due", "cancelled", "ended"];
                      const section1 = currentSection.cards.filter((c) => 
                        lifecycleLabels.some((l) => c.label.toLowerCase().includes(l) || c.key.toLowerCase().includes(l.replace(" ", "")))
                      );
                      const section2 = currentSection.cards.filter((c) => 
                        !lifecycleLabels.some((l) => c.label.toLowerCase().includes(l) || c.key.toLowerCase().includes(l.replace(" ", "")))
                      );

                      return (
                        <div className="space-y-6 mb-6">
                          {section1.length > 0 && (
                            <div>
                              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 px-1">
                                {lang === "ar" ? "دورة حياة الاشتراكات" : "Subscription Lifecycle"}
                              </h4>
                              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${
                                section1.length === 1 ? "lg:grid-cols-1" :
                                section1.length === 2 ? "lg:grid-cols-2" :
                                section1.length === 3 ? "lg:grid-cols-3" :
                                section1.length === 4 ? "lg:grid-cols-4" :
                                "lg:grid-cols-5"
                              }`}>
                                {section1.map((card) => (
                                  <KpiCard key={card.key} card={card} />
                                ))}
                              </div>
                            </div>
                          )}
                          {section2.length > 0 && (
                            <div>
                              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 px-1">
                                {lang === "ar" ? "المقاييس المالية" : "Revenue & Metrics"}
                              </h4>
                              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${
                                section2.length === 1 ? "lg:grid-cols-1" :
                                section2.length === 2 ? "lg:grid-cols-2" :
                                section2.length === 3 ? "lg:grid-cols-3" :
                                section2.length === 4 ? "lg:grid-cols-4" :
                                section2.length === 5 ? "lg:grid-cols-5" :
                                "lg:grid-cols-4"
                              }`}>
                                {section2.map((card) => (
                                  <KpiCard key={card.key} card={card} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }
                    if (activeTab === "invoices") {
                      return null; // BillingTab handles its own card rendering completely
                    }

                    const cardsToRender = activeTab === "databaseServers" ? currentSection.cards.slice(0, 6) : currentSection.cards;
                    return (
                      <div className={`grid grid-cols-1 sm:grid-cols-2 ${cardsToRender.length >= 5 ? "lg:grid-cols-3 xl:grid-cols-6" : "lg:grid-cols-4"} gap-4 mb-6`}>
                        {cardsToRender.map((card) => (
                          <KpiCard key={card.key} card={card} />
                        ))}
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Specific Layout Fallbacks for Known Sections */}
                {activeTab === "tenants" && (
                  <TenantsTab
                    lifecycle={data.overview.tenantLifecycle as any}
                    domainHealth={data.overview.domainHealth as any}
                    tenantStatus={data.panels.tenantStatus as any}
                    subscriptionStatus={data.overview.subscriptionStatus as any}
                    billingGrowth={data.overview.tenantBillingGrowth as any}
                    databaseCapacity={data.panels.databaseCapacity as any}
                  />
                )}

                {activeTab === "databaseServers" && (
                  <ServersTab
                    servers={data.panels.databaseCapacity.items as any}
                    extraCards={data.sections.find((s) => s.key === "databaseServers")?.cards.slice(6) || []}
                  />
                )}

                {activeTab === "invoices" && (() => {
                  // Map Invoice Status from API if available
                  const bItems = data.overview.billingSummary?.items || [];
                  const getVal = (k: string) => bItems.find((i) => i.key.toLowerCase().includes(k))?.value || 0;
                  
                  const invoiceStatusData = bItems.length > 0 
                    ? { paid: getVal("paid"), outstanding: getVal("outstand"), overdue: getVal("overdue") }
                    : undefined;

                  // Map Cash Flow from tenantBillingGrowth
                  const growthPoints = data.overview.tenantBillingGrowth?.points || [];
                  const cashFlowData = growthPoints.length > 0
                    ? growthPoints.map(p => ({ month: p.month, expected: p.collected * 1.1, actual: p.collected }))
                    : undefined;

                  return (
                    <BillingTab 
                      summary={data.overview.billingSummary as any} 
                      extraCards={data.sections.find((s) => s.key === "invoices")?.cards || []}
                      invoiceStatusData={invoiceStatusData}
                      cashFlowData={cashFlowData}
                    />
                  );
                })()}
                {activeTab === "subscriptions" && (
                  <SubscriptionsTab 
                    subscriptionStatus={data.overview.subscriptionStatus as any} 
                    billingGrowth={data.overview.tenantBillingGrowth as any}
                  />
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

