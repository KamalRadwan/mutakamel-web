"use client";

import { Building2, CheckCircle2, Loader2, PauseCircle, AlertTriangle } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

interface TenantSummaryProps {
  metrics: {
    total: number;
    active: number;
    provisioning: number;
    suspended: number;
    failed: number;
  };
}

export function TenantSummary({ metrics }: TenantSummaryProps) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
      {/* Total Tenants */}
      <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-4 rounded-xl border border-slate-200/80 dark:border-blue-500/20 shadow-sm hover:shadow-md transition-all">
        <div className="absolute top-0 end-0 w-20 h-20 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-xs font-semibold uppercase tracking-wider">{t.tenants.totalTenants}</span>
          <div className="p-1.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-lg">
            <Building2 className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100 font-mono mt-1">
          {metrics.total}
        </div>
      </div>

      {/* Active Tenants */}
      <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-4 rounded-xl border border-slate-200/80 dark:border-emerald-500/20 shadow-sm hover:shadow-md transition-all">
        <div className="absolute top-0 end-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-xs font-semibold uppercase tracking-wider">{t.tenants.activeTenants}</span>
          <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400 font-mono mt-1 flex items-center gap-2">
          {metrics.active}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>
      </div>

      {/* Provisioning Queue */}
      <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-4 rounded-xl border border-slate-200/80 dark:border-cyan-500/20 shadow-sm hover:shadow-md transition-all">
        <div className="absolute top-0 end-0 w-20 h-20 bg-cyan-500/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-xs font-semibold uppercase tracking-wider">{t.tenants.provisioningQueue}</span>
          <div className="p-1.5 bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 rounded-lg">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        </div>
        <div className="text-2xl font-semibold text-cyan-600 dark:text-cyan-400 font-mono mt-1">
          {metrics.provisioning}
        </div>
      </div>

      {/* Suspended Tenants */}
      <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-4 rounded-xl border border-slate-200/80 dark:border-amber-500/20 shadow-sm hover:shadow-md transition-all">
        <div className="absolute top-0 end-0 w-20 h-20 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-xs font-semibold uppercase tracking-wider">{t.tenants.suspendedTenants}</span>
          <div className="p-1.5 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-lg">
            <PauseCircle className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-semibold text-amber-600 dark:text-amber-400 font-mono mt-1">
          {metrics.suspended}
        </div>
      </div>

      {/* Failed Provisioning */}
      <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 p-4 rounded-xl border border-slate-200/80 dark:border-rose-500/20 shadow-sm hover:shadow-md transition-all col-span-2 sm:col-span-1">
        <div className="absolute top-0 end-0 w-20 h-20 bg-rose-500/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-xs font-semibold uppercase tracking-wider">{t.tenants.failedTenants}</span>
          <div className="p-1.5 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-lg">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-semibold text-rose-600 dark:text-rose-400 font-mono mt-1">
          {metrics.failed}
        </div>
      </div>
    </div>
  );
}
