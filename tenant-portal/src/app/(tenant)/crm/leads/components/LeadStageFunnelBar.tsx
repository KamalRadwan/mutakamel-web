"use client";

import { cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { LeadItem, LeadStage } from "../hooks/useLeads";

export interface LeadStageFunnelBarProps {
  stages: readonly LeadStage[];
  leads: readonly LeadItem[];
  selectedStageId?: string;
  onSelectStage: (stageId: string | undefined) => void;
  disabled?: boolean;
}

/**
 * Full-width segmented Stage Funnel Ribbon for Card View & Table View
 * matching Screens 05, 06, and 07 (`All Leads 48 | New 14 | Contacted 11 | ...`).
 */
export function LeadStageFunnelBar({
  stages,
  leads,
  selectedStageId,
  onSelectStage,
  disabled,
}: LeadStageFunnelBarProps) {
  const { lang } = useI18n();
  const isAr = lang === "ar";

  const countByStageId = new Map<string, number>();
  for (const lead of leads) {
    countByStageId.set(lead.stageId, (countByStageId.get(lead.stageId) ?? 0) + 1);
  }

  const isAllActive = !selectedStageId;

  return (
    <div
      role="navigation"
      aria-label={isAr ? "تصفية حسب المرحلة" : "Stage funnel filter"}
      className="flex w-full items-stretch divide-x divide-slate-200 overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-2xs dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900"
    >
      <button
        type="button"
        disabled={disabled}
        aria-pressed={isAllActive}
        onClick={() => onSelectStage(undefined)}
        className={cn(
          "flex min-w-32 flex-1 items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold transition-colors",
          isAllActive
            ? "bg-blue-600 text-white"
            : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/70",
        )}
      >
        <span className="truncate">{isAr ? "كل العملاء" : "All Leads"}</span>
        <span
          className={cn(
            "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
            isAllActive
              ? "bg-white/20 text-white"
              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
          )}
        >
          {leads.length}
        </span>
      </button>

      {stages.map((stage) => {
        const isActive = selectedStageId === stage.id;
        const count = countByStageId.get(stage.id) ?? 0;
        const topAccent =
          stage.flag === "QUALIFIED" || stage.flag === "CONVERTED"
            ? "border-t-2 border-t-emerald-500"
            : stage.flag === "DISQUALIFIED"
              ? "border-t-2 border-t-red-500"
              : "";

        return (
          <button
            key={stage.id}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => onSelectStage(isActive ? undefined : stage.id)}
            className={cn(
              "flex min-w-28 flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors",
              topAccent,
              isActive
                ? "bg-blue-600 text-white"
                : stage.flag === "QUALIFIED"
                  ? "bg-emerald-50/40 text-emerald-800 hover:bg-emerald-50/80 dark:bg-emerald-950/20 dark:text-emerald-300"
                  : stage.flag === "DISQUALIFIED"
                    ? "bg-white text-slate-700 hover:bg-red-50/40 dark:bg-slate-900 dark:text-slate-200"
                    : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/70",
            )}
          >
            <span className="truncate">{localizedName(stage, lang)}</span>
            <span
              className={cn(
                "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
                isActive
                  ? "bg-white/20 text-white"
                  : stage.flag === "QUALIFIED"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                    : stage.flag === "DISQUALIFIED"
                      ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
