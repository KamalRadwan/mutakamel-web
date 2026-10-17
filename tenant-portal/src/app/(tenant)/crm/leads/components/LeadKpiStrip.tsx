"use client";

import { Activity, Check, Flame } from "lucide-react";
import { cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { leadActivityState } from "../lead-card-contract";
import type { LeadItem, LeadStage } from "../hooks/useLeads";
import type { LeadKpis } from "../lead-bulk-contract";

export type LeadQuickFilterPreset =
  | "ALL"
  | "NEW_STAGE"
  | "HOT_3_STAR"
  | "OVERDUE_ACTIVITY"
  | "QUALIFIED";

export interface LeadKpiStripProps {
  /**
   * Pipeline-wide figures from `POST /leads/kpis`. When `null` (loading or the
   * read failed) the strip counts `leads` — the rows currently loaded — instead.
   */
  kpis?: LeadKpis | null;
  leads: readonly LeadItem[];
  stages: readonly LeadStage[];
  activePreset: LeadQuickFilterPreset;
  onSelectPreset: (preset: LeadQuickFilterPreset) => void;
}

/**
 * Executive inline KPI filter pills matching Screens 01, 02, 03, 05, 06, 07, 08, and 16.
 *
 * Renders inside the top command bar (`slot="actions"`) so the Board, Card, and
 * Table views get maximum vertical viewport height while keeping 1-click funnel
 * filtering (`Total`, `New Today`, `★ Hot (3★)`, `Overdue`, `✓ Qualified`)
 * immediately accessible.
 */
export function LeadKpiStrip({
  kpis = null,
  leads,
  stages,
  activePreset,
  onSelectPreset,
}: LeadKpiStripProps) {
  const { lang } = useI18n();
  const isAr = lang === "ar";

  const stageById = new Map(stages.map((s) => [s.id, s]));

  let newCount = 0;
  let hotCount = 0;
  let overdueCount = 0;
  let qualifiedCount = 0;

  for (const lead of leads) {
    const stage = stageById.get(lead.stageId);
    if (stage?.flag === "NEW") newCount += 1;
    if (stage?.flag === "QUALIFIED") qualifiedCount += 1;
    if (lead.rating >= 3) hotCount += 1;
    if (leadActivityState(lead.nextActivity) === "OVERDUE") overdueCount += 1;
  }

  const totalCount = kpis ? kpis.totalLeads : leads.length;
  if (kpis) {
    newCount = kpis.newStageLeads;
    hotCount = kpis.hotLeads;
    overdueCount = kpis.overdueActivityLeads;
    qualifiedCount = kpis.qualifiedLeads;
  }

  function handleToggle(preset: LeadQuickFilterPreset) {
    if (activePreset === preset && preset !== "ALL") {
      onSelectPreset("ALL");
    } else {
      onSelectPreset(preset);
    }
  }

  return (
    <div
      role="region"
      aria-label={isAr ? "مؤشرات مسار العملاء المحتملين" : "Leads pipeline KPI filters"}
      className="flex flex-wrap items-center gap-1"
    >
      {/* 1. Total */}
      <button
        type="button"
        aria-pressed={activePreset === "ALL"}
        onClick={() => handleToggle("ALL")}
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition-all",
          activePreset === "ALL"
            ? "border-blue-600 bg-blue-50/90 text-blue-800 ring-1 ring-blue-600/30 dark:border-blue-400 dark:bg-blue-950/70 dark:text-blue-200"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
        )}
      >
        <span>{isAr ? "الإجمالي" : "Total"}</span>
        <span className="font-bold tabular-nums text-slate-900 dark:text-white">
          {totalCount}
        </span>
      </button>

      {/* 2. New Today / New Stage */}
      <button
        type="button"
        aria-pressed={activePreset === "NEW_STAGE"}
        onClick={() => handleToggle("NEW_STAGE")}
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition-all",
          activePreset === "NEW_STAGE"
            ? "border-blue-600 bg-blue-50/90 text-blue-800 ring-1 ring-blue-600/30 dark:border-blue-400 dark:bg-blue-950/70 dark:text-blue-200"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
        )}
      >
        <span>{isAr ? "جديد" : "New"}</span>
        <span className="font-bold tabular-nums text-blue-600 dark:text-blue-400">
          {newCount}
        </span>
        {kpis && kpis.newTodayLeads > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {isAr ? `+${kpis.newTodayLeads} اليوم` : `+${kpis.newTodayLeads} today`}
          </span>
        )}
      </button>

      {/* 3. Hot (3★) */}
      <button
        type="button"
        aria-pressed={activePreset === "HOT_3_STAR"}
        onClick={() => handleToggle("HOT_3_STAR")}
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold transition-all",
          activePreset === "HOT_3_STAR"
            ? "border-amber-500 bg-amber-100 text-amber-900 ring-1 ring-amber-500/40 dark:border-amber-500 dark:bg-amber-950/80 dark:text-amber-200"
            : "border-amber-200 bg-amber-50/90 text-amber-800 hover:bg-amber-100/80 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300",
        )}
      >
        <Flame className="size-3 fill-amber-500 text-amber-600" aria-hidden="true" />
        <span>{isAr ? "عملاء ساخنون (3★)" : "Hot (3★)"}</span>
        <span className="font-bold tabular-nums">{hotCount}</span>
      </button>

      {/* 4. Overdue */}
      <button
        type="button"
        aria-pressed={activePreset === "OVERDUE_ACTIVITY"}
        onClick={() => handleToggle("OVERDUE_ACTIVITY")}
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold transition-all",
          activePreset === "OVERDUE_ACTIVITY"
            ? "border-red-500 bg-red-100 text-red-900 ring-1 ring-red-500/40 dark:border-red-500 dark:bg-red-950/80 dark:text-red-200"
            : "border-red-200 bg-red-50/90 text-red-700 hover:bg-red-100/80 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300",
        )}
      >
        <Activity className="size-3 text-red-600 dark:text-red-400" aria-hidden="true" />
        <span>{isAr ? "متأخرات" : "Overdue"}</span>
        <span className="font-bold tabular-nums">{overdueCount}</span>
      </button>

      {/* 5. Qualified */}
      <button
        type="button"
        aria-pressed={activePreset === "QUALIFIED"}
        onClick={() => handleToggle("QUALIFIED")}
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold transition-all",
          activePreset === "QUALIFIED"
            ? "border-emerald-600 bg-emerald-100 text-emerald-900 ring-1 ring-emerald-600/40 dark:border-emerald-500 dark:bg-emerald-950/80 dark:text-emerald-200"
            : "border-emerald-200 bg-emerald-50/90 text-emerald-700 hover:bg-emerald-100/80 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300",
        )}
      >
        <Check className="size-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <span>{isAr ? "جاهز للتحويل" : "Qualified"}</span>
        <span className="font-bold tabular-nums">{qualifiedCount}</span>
      </button>
    </div>
  );
}

