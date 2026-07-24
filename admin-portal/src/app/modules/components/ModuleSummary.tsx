"use client";

import { Package, Award, Sparkles, DollarSign } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export interface ModuleSummaryProps {
  metrics: {
    totalModules: number;
    activeTiers: number;
    totalFeatures: number;
    activeCurrencies: number;
  };
}

export function ModuleSummary({ metrics }: ModuleSummaryProps) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Modules Card */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">{t.modules.totalModules}</span>
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Package className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
          {metrics.totalModules}
        </div>
        <p className="text-[11px] text-slate-400 font-mono">core, crm, trade, worker</p>
      </div>

      {/* Active Tiers Card */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">{t.modules.activeTiers}</span>
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <Award className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
          {metrics.activeTiers}
        </div>
        <p className="text-[11px] text-slate-400">Starter, Business, Pro, Enterprise</p>
      </div>

      {/* Total Features Card */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">{t.modules.totalFeatures}</span>
          <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
          {metrics.totalFeatures}
        </div>
        <p className="text-[11px] text-slate-400">Boolean & Numeric Limits</p>
      </div>

      {/* Currency FX Rates Card */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">{t.modules.currencyRates}</span>
          <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
          {metrics.activeCurrencies} Active
        </div>
        <p className="text-[11px] text-slate-400 font-mono">USD, EGP, SAR, AED, EUR</p>
      </div>
    </div>
  );
}
