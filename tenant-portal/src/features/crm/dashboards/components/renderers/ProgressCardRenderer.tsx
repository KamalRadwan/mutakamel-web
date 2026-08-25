"use client";

import { useI18n } from "@/i18n/I18nContext";
import type { DashboardWidgetResult, CrmDashboardWidget } from "../../models/dashboard-types";
import { formatDashboardValue } from "../../models/dashboard-utils";

interface ProgressCardRendererProps {
  widget: CrmDashboardWidget;
  result: DashboardWidgetResult;
}

export function ProgressCardRenderer({ result }: ProgressCardRendererProps) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";
  const value = result.value ?? 0;
  const target = result.target ?? 100;

  const percentage = Math.min(100, Math.max(0, (value / (target || 1)) * 100));
  const isComplete = percentage >= 100;

  const formattedValue = formatDashboardValue(value, { compact: true });
  const formattedTarget = formatDashboardValue(target, { compact: true });

  const barColor = isComplete
    ? "bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-[length:200%_200%] animate-gradient-x shadow-[0_0_12px_rgba(16,185,129,0.5)]"
    : "bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-500 bg-[length:200%_200%] animate-gradient-x shadow-[0_0_12px_rgba(59,130,246,0.4)]";

  return (
    <div className="flex flex-col h-full justify-between p-4 sm:p-5 relative overflow-hidden">
      <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-gradient-to-tl from-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="flex items-baseline justify-between mb-3 z-10">
        <div
          className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 text-transparent bg-clip-text drop-shadow-sm"
          style={{ fontFamily: "Outfit, Inter, sans-serif" }}
        >
          {formattedValue}
        </div>
        <div className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/50 px-2 py-1 rounded-md border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm">
          <span className="text-slate-400 dark:text-slate-500 me-1.5 opacity-80 uppercase text-[10px] tracking-wider">
            {isRtl ? "the goal:" : "Target:"}
          </span>
          {formattedTarget}
        </div>
      </div>

      <div className="w-full bg-slate-200/50 dark:bg-slate-800/60 h-4 rounded-full overflow-hidden p-[3px] shadow-inner backdrop-blur-sm border border-slate-300/30 dark:border-slate-700/30 z-10">
        <div
          className={`h-full ${barColor} transition-all duration-1000 ease-out rounded-full shadow-xs`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs font-semibold z-10">
        <span className="text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px]">
          {isRtl ? "Completion rate" : "Completion Rate"}
        </span>
        <span
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border backdrop-blur-md ${
            isComplete
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
              : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]"
          }`}
          dir="ltr"
        >
          {percentage.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
