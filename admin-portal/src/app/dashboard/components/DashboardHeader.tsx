"use client";

import { RotateCw, Calendar, Printer, BarChart2, LayoutGrid, Clock } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { DateRangePreset } from "../hooks/useDashboardData";

export type AutoRefreshInterval = "off" | "30s" | "60s" | "5m";
export type DashboardViewMode = "charts" | "cards";

interface DashboardHeaderProps {
  isRefreshing: boolean;
  onRefresh: () => void;
  rangePreset: DateRangePreset;
  onRangeChange: (preset: DateRangePreset) => void;
  autoRefreshInterval?: AutoRefreshInterval;
  onAutoRefreshChange?: (interval: AutoRefreshInterval) => void;
  onPrintReport?: () => void;
}

export function DashboardHeader({
  isRefreshing,
  onRefresh,
  rangePreset,
  onRangeChange,
  autoRefreshInterval = "off",
  onAutoRefreshChange,
  onPrintReport,
}: DashboardHeaderProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.dashboard.title}
          </h1>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {t.dashboard.welcome}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Date Range Selector Pill */}
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs">
          <Calendar className="w-3.5 h-3.5 text-slate-400 ms-1.5" />
          <button
            onClick={() => onRangeChange("thisMonth")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              rangePreset === "thisMonth"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            {t.dashboard.thisMonth}
          </button>
          <button
            onClick={() => onRangeChange("lastMonth")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              rangePreset === "lastMonth"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            {t.dashboard.lastMonth}
          </button>
        </div>

        {/* Auto Refresh Interval Selector */}
        {onAutoRefreshChange && (
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs">
            <Clock className="w-3.5 h-3.5 text-slate-400 ms-1" />
            <select
              value={autoRefreshInterval}
              onChange={(e) => onAutoRefreshChange(e.target.value as AutoRefreshInterval)}
              className="bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer pr-1"
            >
              <option value="off">{t.dashboard.autoRefreshOff}</option>
              <option value="30s">{t.dashboard.autoRefresh30s}</option>
              <option value="60s">{t.dashboard.autoRefresh60s}</option>
              <option value="5m">{t.dashboard.autoRefresh5m}</option>
            </select>
          </div>
        )}

        {/* Print Report Action */}
        <button
          onClick={onPrintReport || (() => window.print())}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title={t.dashboard.printPdfReport}
        >
          <Printer className="w-4 h-4" />
        </button>


        {/* Refresh Action Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          title={t.dashboard.refresh}
        >
          <RotateCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-blue-600" : ""}`} />
        </button>
      </div>
    </div>
  );
}
