"use client";

import { Server, CheckCircle2, AlertTriangle, PieChart } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

interface DatabaseServerSummaryProps {
  metrics: {
    totalServers: number;
    activeServers: number;
    drainingServers: number;
    totalTenantsPlaced: number;
    maxCapacity: number;
    platformUtilizationRatio: number;
  };
}

export function DatabaseServerSummary({ metrics }: DatabaseServerSummaryProps) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total DB Hosts */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-xs font-semibold">{t.dbServers.totalServers}</span>
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Server className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
          {metrics.totalServers}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          سيرفرات مفحوصة ومسجلة
        </p>
      </div>

      {/* Active Placement Targets */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-xs font-semibold">{t.dbServers.activePlacement}</span>
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
          {metrics.activeServers}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          جاهزة لتسكين شركات جديدة
        </p>
      </div>

      {/* Draining Hosts */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-xs font-semibold">{t.dbServers.drainingServers}</span>
          <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
          {metrics.drainingServers}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          صيانة أو يمنع التسكين الجديد
        </p>
      </div>

      {/* Global Capacity Utilization */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-xs font-semibold">{t.dbServers.platformCapacity}</span>
          <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
            <PieChart className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {metrics.platformUtilizationRatio}%
          </span>
          <span className="text-xs font-semibold text-slate-500">
            {metrics.totalTenantsPlaced} / {metrics.maxCapacity}
          </span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
          <div
            className="bg-purple-600 dark:bg-purple-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${metrics.platformUtilizationRatio}%` }}
          />
        </div>
      </div>
    </div>
  );
}
