"use client";

import { RotateCw, Calendar, Printer, Clock, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { DateRangePreset } from "../hooks/useDashboardData";

export type AutoRefreshInterval = "off" | "30s" | "60s" | "5m";

interface DashboardHeaderProps {
  isRefreshing: boolean;
  onRefresh: () => void;
  rangePreset: DateRangePreset;
  onRangeChange: (preset: DateRangePreset) => void;
  customRange?: { from?: string; to?: string };
  onCustomRangeChange?: (range: { from?: string; to?: string }) => void;
  autoRefreshInterval?: AutoRefreshInterval;
  onAutoRefreshChange?: (interval: AutoRefreshInterval) => void;
  onPrintReport?: () => void;
}

export function DashboardHeader({
  isRefreshing,
  onRefresh,
  rangePreset,
  onRangeChange,
  customRange,
  onCustomRangeChange,
  autoRefreshInterval = "off",
  onAutoRefreshChange,
  onPrintReport,
}: DashboardHeaderProps) {
  const { t, lang } = useI18n();

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl border border-indigo-500/20 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      {/* Background glow accents */}
      <div className="absolute top-0 end-0 -mt-10 -me-10 w-72 h-72 bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/0 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
            <Sparkles className="w-4.5 h-4.5 text-cyan-400" />
            <span>{t.dashboard.title}</span>
          </h1>
          <span className="bg-indigo-500/25 text-indigo-300 border border-indigo-400/30 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md">
            Live Platform Telemetry
          </span>
        </div>
        <p className="text-[11px] text-indigo-200/80 mt-0.5 leading-tight">
          {t.dashboard.welcome}
        </p>
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-2">
        {/* Date Range Selector Pill */}
        <div className="inline-flex items-center gap-1 p-1 bg-white/10 backdrop-blur-md rounded-xl text-xs border border-white/10">
          <Calendar className="w-3.5 h-3.5 text-cyan-300 ms-1.5" />
          <button
            onClick={() => onRangeChange("thisMonth")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              rangePreset === "thisMonth"
                ? "bg-white text-slate-950 shadow-xs"
                : "text-slate-200 hover:text-white hover:bg-white/10"
            }`}
          >
            {t.dashboard.thisMonth}
          </button>
          <button
            onClick={() => onRangeChange("lastMonth")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              rangePreset === "lastMonth"
                ? "bg-white text-slate-950 shadow-xs"
                : "text-slate-200 hover:text-white hover:bg-white/10"
            }`}
          >
            {t.dashboard.lastMonth}
          </button>
          <button
            onClick={() => onRangeChange("custom")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              rangePreset === "custom"
                ? "bg-white text-slate-950 shadow-xs"
                : "text-slate-200 hover:text-white hover:bg-white/10"
            }`}
          >
            {lang === "ar" ? "مخصص" : "Custom"}
          </button>
        </div>

        {rangePreset === "custom" && onCustomRangeChange && (
          <div className="inline-flex items-center gap-2 rounded-xl bg-white/10 p-1 text-xs border border-white/10 backdrop-blur-md">
            <input
              type="date"
              value={customRange?.from ?? ""}
              onChange={(event) =>
                onCustomRangeChange({
                  ...customRange,
                  from: event.target.value || undefined,
                })
              }
              aria-label={lang === "ar" ? "من تاريخ" : "From date"}
              className="min-h-7 rounded-lg border-0 bg-slate-900 px-2 text-xs text-white outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <span className="text-slate-300" aria-hidden="true">
              –
            </span>
            <input
              type="date"
              value={customRange?.to ?? ""}
              min={customRange?.from}
              onChange={(event) =>
                onCustomRangeChange({
                  ...customRange,
                  to: event.target.value || undefined,
                })
              }
              aria-label={lang === "ar" ? "إلى تاريخ" : "To date"}
              className="min-h-7 rounded-lg border-0 bg-slate-900 px-2 text-xs text-white outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        )}

        {/* Auto Refresh Interval Selector */}
        {onAutoRefreshChange && (
          <div className="inline-flex items-center gap-1 p-1 bg-white/10 backdrop-blur-md border border-white/10 rounded-xl text-xs">
            <Clock className="w-3.5 h-3.5 text-amber-300 ms-1" />
            <select
              value={autoRefreshInterval}
              onChange={(e) => onAutoRefreshChange(e.target.value as AutoRefreshInterval)}
              className="bg-transparent border-none text-xs font-semibold text-white focus:outline-none cursor-pointer pr-1"
            >
              <option value="off" className="bg-slate-900 text-white">{t.dashboard.autoRefreshOff}</option>
              <option value="30s" className="bg-slate-900 text-white">{t.dashboard.autoRefresh30s}</option>
              <option value="60s" className="bg-slate-900 text-white">{t.dashboard.autoRefresh60s}</option>
              <option value="5m" className="bg-slate-900 text-white">{t.dashboard.autoRefresh5m}</option>
            </select>
          </div>
        )}

        {/* Print Report Action */}
        <button
          onClick={onPrintReport || (() => window.print())}
          className="p-2 rounded-xl border border-white/15 bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer backdrop-blur-md"
          title={t.dashboard.printPdfReport}
        >
          <Printer className="w-4 h-4 text-cyan-300" />
        </button>

        {/* Refresh Action Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-xl border border-white/15 bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer disabled:opacity-50 backdrop-blur-md"
          title={t.dashboard.refresh}
        >
          <RotateCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-cyan-400" : "text-emerald-400"}`} />
        </button>
      </div>
    </div>
  );
}
