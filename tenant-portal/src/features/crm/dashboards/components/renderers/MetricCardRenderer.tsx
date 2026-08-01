"use client";

import { useI18n } from "@/i18n/I18nContext";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { DashboardWidgetResult, CrmDashboardWidget } from "../../models/dashboard-types";
import { formatDashboardValue } from "../../models/dashboard-utils";

interface MetricCardRendererProps {
  widget: CrmDashboardWidget;
  result: DashboardWidgetResult;
  onClick?: () => void;
}

export function MetricCardRenderer({ widget, result, onClick }: MetricCardRendererProps) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";
  const value = result.value ?? 0;
  const previousValue = result.previousValue ?? 0;
  const unit = result.meta?.unit;
  const currency = result.meta?.currency;

  const percentFormat = unit === "PERCENT" || widget.displaySpec.numberFormat === "percent";
  const currencyFormat = unit === "MONEY";

  const formattedValue = formatDashboardValue(value, {
    compact: widget.displaySpec.numberFormat === "compact",
    precision: widget.displaySpec.options?.precision as number,
    currency: currencyFormat ? currency : undefined,
    suffix: percentFormat ? "%" : undefined,
  });

  const delta = value - previousValue;
  const percentChange = previousValue !== 0 ? (delta / Math.abs(previousValue)) * 100 : 0;
  const isPositive = delta > 0;
  const isNegative = delta < 0;

  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  const trendColor = isPositive
    ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
    : isNegative
    ? "text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
    : "text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/20 shadow-[0_0_15px_rgba(148,163,184,0.1)]";

  return (
    <div
      className="flex flex-col h-full justify-between p-4 sm:p-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all duration-300 cursor-pointer rounded-2xl relative overflow-hidden"
      onClick={onClick}
    >
      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-2xl pointer-events-none" />
      <div className="flex flex-col gap-1.5 my-auto z-10">
        <div
          className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 text-transparent bg-clip-text drop-shadow-sm"
          style={{ fontFamily: "Outfit, Inter, sans-serif" }}
        >
          {formattedValue}
        </div>

        {result.previousValue !== undefined && (
          <div className="flex items-center gap-2 mt-3">
            <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border backdrop-blur-md ${trendColor}`}>
              <TrendIcon className="w-3.5 h-3.5 stroke-[2.5]" />
              <span dir="ltr">{Math.abs(percentChange).toFixed(1)}%</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {isRtl ? "Compared to the previous period" : "vs previous"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
