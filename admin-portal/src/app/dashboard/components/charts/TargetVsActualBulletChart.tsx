"use client";

import { useI18n } from "@/i18n/I18nContext";

interface TargetVsActualBulletChartProps {
  actual: number;
  target?: number;
  height?: number;
}

export function TargetVsActualBulletChart({
  actual,
  target = 10000,
}: TargetVsActualBulletChartProps) {
  const { lang } = useI18n();

  const percentage = Math.min(100, Math.max(0, target > 0 ? (actual / target) * 100 : 0));

  return (
    <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-800">
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="text-slate-700 dark:text-slate-300">
          {lang === "ar" ? "هدف التحصيل التقديري للفترة" : "Target Collection Quota"}
        </span>
        <span className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">
          ${actual.toLocaleString()} / ${target.toLocaleString()} ({percentage.toFixed(0)}%)
        </span>
      </div>

      {/* Bullet Bar Container */}
      <div className="relative w-full bg-slate-200 dark:bg-slate-700 h-4 rounded-full overflow-hidden">
        {/* Actual Progress */}
        <div
          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
        {/* Target Marker */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-slate-900 dark:bg-white shadow-xs"
          style={{ left: "100%", transform: "translateX(-100%)" }}
          title={lang === "ar" ? "الهدف 100%" : "Target 100%"}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
        <span>$0</span>
        <span>${(target * 0.5).toLocaleString()}</span>
        <span>${target.toLocaleString()}</span>
      </div>
    </div>
  );
}
