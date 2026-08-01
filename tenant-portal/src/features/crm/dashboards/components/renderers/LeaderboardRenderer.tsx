"use client";

import { useI18n } from "@/i18n/I18nContext";
import { Trophy, Medal, Award } from "lucide-react";
import type { DashboardWidgetResult, CrmDashboardWidget } from "../../models/dashboard-types";
import { formatDashboardValue } from "../../models/dashboard-utils";

interface LeaderboardRendererProps {
  widget: CrmDashboardWidget;
  result: DashboardWidgetResult;
}

export function LeaderboardRenderer({ widget, result }: LeaderboardRendererProps) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";

  if (result.result?.shape !== "ROWS" || result.result.rowKind !== "RANKED") {
    return <div className="p-4 text-xs text-slate-400">Leaderboard data not available</div>;
  }

  const rows = result.result.rows;

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar p-2 flex flex-col gap-2">
      {rows.map((row, i) => {
        const initials = row.label
          ? row.label
              .split(" ")
              .map((n: string) => n[0])
              .slice(0, 2)
              .join("")
          : "REP";

        return (
          <div
            key={row.id || i}
            className="group flex items-center gap-3 p-3 rounded-xl bg-slate-50/40 dark:bg-slate-800/20 border border-slate-200/50 dark:border-slate-800/50 hover:bg-white dark:hover:bg-slate-800/60 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800/50 hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex-shrink-0 w-8 flex justify-center items-center z-10">
              {row.rank === 1 ? (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-100 to-amber-200 dark:from-yellow-900/40 dark:to-amber-900/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)] border border-amber-300/50 dark:border-amber-700/50">
                  <Trophy className="w-4 h-4 drop-shadow-sm" />
                </div>
              ) : row.rank === 2 ? (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-[0_0_10px_rgba(148,163,184,0.2)] border border-slate-400/50 dark:border-slate-500/50">
                  <Medal className="w-4 h-4 drop-shadow-sm" />
                </div>
              ) : row.rank === 3 ? (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-100 to-orange-300 dark:from-orange-900/40 dark:to-orange-800/60 flex items-center justify-center text-orange-700 dark:text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.2)] border border-orange-400/50 dark:border-orange-700/50">
                  <Award className="w-4 h-4 drop-shadow-sm" />
                </div>
              ) : (
                <span className="text-sm font-extrabold text-slate-400/80 dark:text-slate-500">#{row.rank}</span>
              )}
            </div>

            <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold text-[11px] flex items-center justify-center flex-shrink-0 border border-blue-500/20 backdrop-blur-sm z-10">
              {initials}
            </div>

            <div className="flex-1 min-w-0 z-10">
              <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                {row.label}
              </p>
            </div>

            <div className="text-end flex-shrink-0 z-10">
              <div
                className="text-[13px] sm:text-sm font-extrabold bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 text-transparent bg-clip-text"
                style={{ fontFamily: "Outfit, Inter, sans-serif" }}
              >
                {formatDashboardValue(row.primaryMeasure.value, { compact: true })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
