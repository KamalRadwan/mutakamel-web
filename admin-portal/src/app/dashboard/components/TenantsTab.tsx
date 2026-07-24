"use client";

import { Building2, Globe, ShieldCheck, Users, Server, CreditCard, Activity, TrendingUp, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { DashboardBreakdownItem, DashboardMetricTone, DashboardMetric } from "@/types/dashboard";
import { toneToColorClass, formatDashboardMetric } from "../utils/formatters";
import { SparklineChart } from "./charts/SparklineChart";
import { TenantStatusDonutChart } from "./charts/TenantStatusDonutChart";
import { RegionalDistributionBarChart } from "./charts/RegionalDistributionBarChart";
import { DomainHealthGaugeChart } from "./charts/DomainHealthGaugeChart";
import { TenantGrowthRevenueChart } from "./charts/TenantGrowthRevenueChart";
import { TenantTreemapChart } from "./charts/TenantTreemapChart";
import { DashboardViewMode } from "./DashboardHeader";

interface TenantsTabProps {
  lifecycle: {
    total: number;
    current: number;
    deleted: number;
    items: DashboardBreakdownItem[];
    stats: any[]; // Or DashboardMetric[]
  };

  domainHealth: {
    totalDomains: number;
    verifiedDomains: number;
    unverifiedDomains?: number;
    invalidDomains: number;
    regions: Array<{
      key: string;
      countryName: string;
      countryIsoCode: string;
      count: number;
      ratio: number; // 0..1
      tone: DashboardMetricTone;
    }>;
  };
  tenantStatus: {
    title: string;
    subtitle: string;
    items: Array<{
      key: string;
      label: string;
      count: number;
      description: string;
      ratio: number; // 0..1
      tone: DashboardMetricTone;
    }>;
  };
  subscriptionStatus?: any;
  billingGrowth?: any;
  databaseCapacity?: any;
}

export function TenantsTab({ 
  lifecycle, 
  domainHealth, 
  tenantStatus, 
  subscriptionStatus,
  billingGrowth,
  databaseCapacity
}: TenantsTabProps) {
  const { t, lang } = useI18n();

  // Helper for KPI Icons
  const getKpiIcon = (key: string) => {
    const k = key.toLowerCase();
    if (k.includes("user") || k.includes("staff")) return <Users className="w-4 h-4" />;
    if (k.includes("server") || k.includes("db") || k.includes("capacity")) return <Server className="w-4 h-4" />;
    if (k.includes("revenue") || k.includes("bill") || k.includes("invoice")) return <CreditCard className="w-4 h-4" />;
    if (k.includes("active") || k.includes("health")) return <Activity className="w-4 h-4" />;
    return <Building2 className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">

      {/* Net Acquisition vs Churn Visualizer (Full Width - Top) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Net Tenant Acquisition vs. Churn</span>
          </h3>
          <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-200/60 dark:border-emerald-800/60">
            Selected Range
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl space-y-1">
            <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
              <span>New Tenants Joined</span>
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
              +{lifecycle.current || 0}
            </div>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Newly provisioned in range</p>
          </div>

          <div className="p-4 bg-red-50/50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40 rounded-xl space-y-1">
            <div className="text-xs font-semibold text-red-700 dark:text-red-400 flex items-center justify-between">
              <span>Churned / Deleted</span>
              <Trash2 className="w-3.5 h-3.5" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
              -{lifecycle.deleted || 0}
            </div>
            <p className="text-[10px] text-red-600 dark:text-red-400">Decommissioned tenants</p>
          </div>

          <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 rounded-xl space-y-1">
            <div className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center justify-between">
              <span>Net Growth</span>
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
              {(lifecycle.current || 0) - (lifecycle.deleted || 0)}
            </div>
            <p className="text-[10px] text-blue-600 dark:text-blue-400">Net active tenant delta</p>
          </div>
        </div>
      </div>

      {/* Unified Tenant Status Dashboard (Row List + Stacked Progress Bar) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{tenantStatus?.title || t.dashboard.tenantsTab.statusBreakdownTitle}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {tenantStatus?.subtitle || t.dashboard.tenantsTab.statusDistributionSubtitle}
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-200/60 dark:border-blue-800/60 self-start sm:self-auto font-mono">
            {t.dashboard.tenantsTab.totalTenantsLabel}: {lifecycle.total}
          </span>
        </div>

        {/* 100% Stacked Horizontal Distribution Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-semibold text-slate-400">
            <span>Overall Lifecycle Distribution</span>
            <span>{lifecycle.total > 0 ? `${lifecycle.total} Total` : "No Active Tenants"}</span>
          </div>
          <div className="h-3.5 w-full bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden flex p-0.5 border border-slate-200/50 dark:border-slate-800 gap-0.5">
            {(() => {
              const items = tenantStatus?.items || [];
              const total = lifecycle.total || items.reduce((acc, i) => acc + i.count, 0);

              const colorMap: Record<string, string> = {
                green: "bg-emerald-500",
                blue: "bg-blue-500",
                amber: "bg-amber-500",
                red: "bg-red-500",
                purple: "bg-purple-500",
                cyan: "bg-cyan-500",
              };

              if (total === 0 || items.length === 0) {
                return <div className="h-full w-full bg-slate-200/50 dark:bg-slate-700/30 rounded-full" />;
              }

              return items.map((item) => {
                const widthPercent = total > 0 ? (item.count / total) * 100 : 0;
                if (widthPercent <= 0) return null;
                const bg = colorMap[item.tone] || "bg-blue-500";
                return (
                  <div
                    key={item.key}
                    style={{ width: `${Math.max(widthPercent, 2)}%` }}
                    className={`h-full ${bg} transition-all duration-300 first:rounded-l-full last:rounded-r-full`}
                    title={`${item.label}: ${item.count} (${widthPercent.toFixed(1)}%)`}
                  />
                );
              });
            })()}
          </div>
        </div>

        {/* Row-Based Status List with Inline Mini Progress Bars */}
        <div className="space-y-2 pt-1">
          {(() => {
            const rawItems = tenantStatus?.items || [];
            const defaultItems = [
              { key: "ACTIVE", label: "Active", description: "Tenants operating normally", tone: "green", count: 0, ratio: 0 },
              { key: "PROVISIONING", label: "Provisioning", description: "Environments being set up", tone: "blue", count: 0, ratio: 0 },
              { key: "SUSPENDED", label: "Suspended", description: "Temporarily suspended tenants", tone: "amber", count: 0, ratio: 0 },
              { key: "FAILED", label: "Failed", description: "Setup or provisioning failed", tone: "red", count: 0, ratio: 0 },
              { key: "DELETED", label: "Deleted / Archiving", description: "Decommissioned tenants", tone: "purple", count: 0, ratio: 0 },
            ];

            // Ensure all statuses are displayed even if backend returned 0 items
            const existingKeys = new Set(rawItems.map((i) => i.key.toUpperCase()));
            const mergedItems = [
              ...rawItems,
              ...defaultItems.filter((d) => !existingKeys.has(d.key.toUpperCase())),
            ];

            const colorMap: Record<string, { dot: string; bar: string; text: string; bg: string }> = {
              green: { dot: "bg-emerald-500", bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
              blue: { dot: "bg-blue-500", bar: "bg-blue-500", text: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30" },
              amber: { dot: "bg-amber-500", bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" },
              red: { dot: "bg-red-500", bar: "bg-red-500", text: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30" },
              purple: { dot: "bg-purple-500", bar: "bg-purple-500", text: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/30" },
              cyan: { dot: "bg-cyan-500", bar: "bg-cyan-500", text: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-950/30" },
            };

            return mergedItems.map((item) => {
              const theme = colorMap[item.tone] || colorMap.blue;
              const pct = (item.ratio * 100).toFixed(1);

              return (
                <div
                  key={item.key}
                  className="p-3 sm:p-3.5 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/50 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <span className={`w-2.5 h-2.5 rounded-full ${theme.dot} shrink-0`} />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{item.label}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</p>
                    </div>
                  </div>

                  {/* Inline Mini Progress Bar */}
                  <div className="flex-1 max-w-xs hidden md:block px-4">
                    <div className="h-1.5 w-full bg-slate-200/60 dark:bg-slate-700/40 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.max(item.ratio * 100, item.count > 0 ? 5 : 0)}%` }}
                        className={`h-full ${theme.bar} transition-all duration-300`}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-auto">
                    <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 font-mono">
                      {item.count}
                    </span>
                    <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md ${theme.bg} ${theme.text}`}>
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Grid for Domain Health + Regional Distribution Horizontal Bar Chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Domain Health Box */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t.dashboard.tenantsTab.domainHealthTitle}</span>
          </h3>

          <div className="space-y-3 pt-1">
            <DomainHealthGaugeChart
              verified={domainHealth.verifiedDomains}
              invalid={domainHealth.invalidDomains}
              total={domainHealth.totalDomains}
              height={30}
            />
          </div>
        </div>

        {/* Regional Distribution Interactive Bar Chart Box */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>{t.dashboard.tenantsTab.regionalDistributionTitle}</span>
          </h3>

          <div className="pt-1">
            <RegionalDistributionBarChart regions={domainHealth.regions || []} height={200} />
          </div>
        </div>
      </div>
    </div>
  );
}
