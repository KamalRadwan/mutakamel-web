"use client";

import { useI18n } from "@/i18n/I18nContext";

export interface CohortData {
  cohortMonth: string;
  users: number;
  retentionRates: number[]; // e.g. [100, 95, 85, 80, 75, 70]
}

interface Props {
  data: CohortData[];
  height?: number;
}

export function SubscriptionRetentionGrid({ data, height = 280 }: Props) {
  const { lang } = useI18n();
  const maxMonths = Math.max(...data.map(d => d.retentionRates.length));

  const getHeatmapColor = (rate: number) => {
    if (rate === 100) return "bg-indigo-600 text-white dark:bg-indigo-500";
    if (rate >= 90) return "bg-indigo-500/80 text-white dark:bg-indigo-400/80";
    if (rate >= 80) return "bg-indigo-400/60 text-indigo-950 dark:bg-indigo-300/60 dark:text-indigo-100";
    if (rate >= 70) return "bg-indigo-300/50 text-indigo-900 dark:bg-indigo-200/50";
    if (rate >= 50) return "bg-indigo-200/40 text-indigo-800 dark:bg-indigo-100/40";
    return "bg-indigo-100/30 text-indigo-700 dark:bg-indigo-50/20 dark:text-indigo-300";
  };

  return (
    <div style={{ height, width: "100%" }} className="overflow-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
      <div className="min-w-[600px] h-full flex flex-col">
        {/* Header Row */}
        <div className="flex text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
          <div className="w-24 shrink-0">{lang === "ar" ? "الفوج" : "Cohort"}</div>
          <div className="w-16 shrink-0 text-right pr-4">{lang === "ar" ? "المستخدمين" : "Users"}</div>
          <div className="flex-1 flex gap-1">
            {Array.from({ length: maxMonths }).map((_, i) => (
              <div key={i} className="flex-1 text-center">M{i}</div>
            ))}
          </div>
        </div>

        {/* Data Rows */}
        <div className="flex-1 flex flex-col gap-1">
          {data.map((row, i) => (
            <div key={i} className="flex text-[11px] items-center">
              <div className="w-24 shrink-0 font-bold text-slate-700 dark:text-slate-300">
                {row.cohortMonth}
              </div>
              <div className="w-16 shrink-0 text-right pr-4 text-slate-500 dark:text-slate-400">
                {row.users.toLocaleString()}
              </div>
              <div className="flex-1 flex gap-1">
                {row.retentionRates.map((rate, j) => (
                  <div 
                    key={j} 
                    className={`flex-1 rounded flex items-center justify-center font-mono py-1.5 transition-colors hover:opacity-80 cursor-default ${getHeatmapColor(rate)}`}
                    title={`Month ${j}: ${rate}% retention`}
                  >
                    {rate}%
                  </div>
                ))}
                {/* Empty padding for missing months */}
                {Array.from({ length: maxMonths - row.retentionRates.length }).map((_, j) => (
                  <div key={`empty-${j}`} className="flex-1 bg-slate-50 dark:bg-slate-800/30 rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
