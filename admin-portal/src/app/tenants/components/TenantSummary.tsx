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
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-semibold">{t.tenants.totalTenants}</span>
          <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
          {metrics.total}
        </div>
      </div>

      {/* Active Tenants */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-semibold">{t.tenants.activeTenants}</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
          {metrics.active}
        </div>
      </div>

      {/* Provisioning Queue */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-semibold">{t.tenants.provisioningQueue}</span>
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
        </div>
        <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
          {metrics.provisioning}
        </div>
      </div>

      {/* Suspended Tenants */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-semibold">{t.tenants.suspendedTenants}</span>
          <PauseCircle className="w-4 h-4 text-amber-500" />
        </div>
        <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
          {metrics.suspended}
        </div>
      </div>

      {/* Failed Provisioning */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1 col-span-2 sm:col-span-1">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-semibold">{t.tenants.failedTenants}</span>
          <AlertTriangle className="w-4 h-4 text-rose-500" />
        </div>
        <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">
          {metrics.failed}
        </div>
      </div>
    </div>
  );
}
