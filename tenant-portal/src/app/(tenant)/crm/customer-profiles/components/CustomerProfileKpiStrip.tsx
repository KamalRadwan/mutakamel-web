"use client";

import { Activity, Check, Flame } from "lucide-react";
import { cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { crmActivityState } from "../../shared/crm-activity-tone";
import type {
  CustomerProfileItem,
  CustomerProfileStatus,
} from "../hooks/useCustomerProfiles";

export type CustomerKpiFilterPreset =
  | "ALL"
  | "PROSPECT"
  | "HOT_3_STAR"
  | "OVERDUE_ACTIVITY"
  | "ACTIVE_CUSTOMER";

export interface CustomerProfileKpiStripProps {
  items: readonly CustomerProfileItem[];
  statusTotals: ReadonlyMap<CustomerProfileStatus, number>;
  listTotal?: number;
  isLoading?: boolean;
  activePreset: CustomerKpiFilterPreset;
  onSelectPreset: (preset: CustomerKpiFilterPreset) => void;
}

/**
 * Executive inline KPI filter pills matching Leads `LeadKpiStrip` (Screens 01..08 & 16).
 *
 * Renders inside the top command bar (`slot="actions"`) so the Board, Card, and
 * Table views get maximum vertical viewport height while keeping 1-click funnel
 * filtering (`Total`, `Prospect`, `★ Hot (3★)`, `Overdue`, `✓ Active`)
 * immediately accessible.
 */
export function CustomerProfileKpiStrip({
  items,
  statusTotals,
  listTotal,
  activePreset,
  onSelectPreset,
}: CustomerProfileKpiStripProps) {
  const { lang } = useI18n();
  const isAr = lang === "ar";

  const prospectCount =
    statusTotals.get("PROSPECT") ??
    items.filter((item) => item.status === "PROSPECT").length;
  const activeCount =
    statusTotals.get("ACTIVE_CUSTOMER") ??
    items.filter((item) => item.status === "ACTIVE_CUSTOMER").length;
  const inactiveCount =
    statusTotals.get("INACTIVE") ??
    items.filter((item) => item.status === "INACTIVE").length;
  const blacklistedCount =
    statusTotals.get("BLACKLISTED") ??
    items.filter((item) => item.status === "BLACKLISTED").length;

  const boardSum =
    prospectCount + activeCount + inactiveCount + blacklistedCount;
  const totalCount = Math.max(boardSum, listTotal ?? 0, items.length);

  let hotCount = 0;
  let overdueCount = 0;
  for (const item of items) {
    if ((item.rating ?? 0) >= 3) hotCount += 1;
    if (crmActivityState(item.nextActivity) === "OVERDUE") overdueCount += 1;
  }

  function handleToggle(preset: CustomerKpiFilterPreset) {
    if (activePreset === preset && preset !== "ALL") {
      onSelectPreset("ALL");
    } else {
      onSelectPreset(preset);
    }
  }

  return (
    <div
      role="region"
      aria-label={
        isAr
          ? "مؤشرات مسار ملفات العملاء"
          : "Customer profiles pipeline KPI filters"
      }
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

      {/* 2. Prospect */}
      <button
        type="button"
        aria-pressed={activePreset === "PROSPECT"}
        onClick={() => handleToggle("PROSPECT")}
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition-all",
          activePreset === "PROSPECT"
            ? "border-blue-600 bg-blue-50/90 text-blue-800 ring-1 ring-blue-600/30 dark:border-blue-400 dark:bg-blue-950/70 dark:text-blue-200"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
        )}
      >
        <span>{isAr ? "عميل محتمل" : "Prospect"}</span>
        <span className="font-bold tabular-nums text-blue-600 dark:text-blue-400">
          {prospectCount}
        </span>
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

      {/* 5. Active Customer */}
      <button
        type="button"
        aria-pressed={activePreset === "ACTIVE_CUSTOMER"}
        onClick={() => handleToggle("ACTIVE_CUSTOMER")}
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold transition-all",
          activePreset === "ACTIVE_CUSTOMER"
            ? "border-emerald-600 bg-emerald-100 text-emerald-900 ring-1 ring-emerald-600/40 dark:border-emerald-500 dark:bg-emerald-950/80 dark:text-emerald-200"
            : "border-emerald-200 bg-emerald-50/90 text-emerald-700 hover:bg-emerald-100/80 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300",
        )}
      >
        <Check className="size-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <span>{isAr ? "عميل نشط" : "Active"}</span>
        <span className="font-bold tabular-nums">{activeCount}</span>
      </button>
    </div>
  );
}
